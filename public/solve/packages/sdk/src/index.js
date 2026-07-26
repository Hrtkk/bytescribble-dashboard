// @problem-runtime/sdk — the client surface (M0 subset).
// createRuntime wires plugin registrations into the pure pipeline stages;
// solve() runs surface → problem → canonical → executable → trace →
// verification → plan → board. Clients never reach past this.

import { parseProblem } from '../../parser/src/index.js';
import { normalize } from '../../normalizer/src/index.js';
import { compileExecutable } from '../../graph/src/index.js';
import { executeProgram } from '../../vm/src/index.js';
import { verifyTrace } from '../../verifier/src/index.js';
import { planTeaching } from '../../planner/src/index.js';
import { compileBoard } from '../../board-program/src/index.js';
import { checkAnswer, ghostStep } from './desk-verbs.js';

const SYMBOL = { add: '+', sub: '−', mul: '×', div: '÷' };

export function createRuntime({ plugins }) {
  const problemClasses = plugins.flatMap((p) => p.problemClasses);
  const opRegistries = plugins.flatMap((p) => p.opRegistries);

  function solve(surface, { mode = 'guided' } = {}) {
    const events = [];
    const emit = (e) => events.push(e);

    const parsed = parseProblem(surface, problemClasses);
    if (!parsed.ok) return { ok: false, error: parsed.error, events };
    const { problem, cls } = parsed;
    emit(`problem.parsed(${problem.problem_id})`);

    const canonical = normalize(problem, cls);
    emit(`problem.normalized(${canonical.form})`);

    const executable = compileExecutable(problem, canonical, cls, opRegistries);
    emit(`compiler.emitted(${executable.exec_id})`);

    const rawTrace = executeProgram(executable, problem, opRegistries);
    emit(`vm.executed(${rawTrace.trace_id})`);

    const trace = verifyTrace(rawTrace, executable, problem, opRegistries);
    emit(`verifier.${trace.verification.status}(${trace.verification.assertions.passed}/${trace.verification.assertions.total})`);
    if (trace.verification.status !== 'passed') {
      return { ok: false, error: 'trace quarantined', problem, executable, trace, events };
    }

    const plan = planTeaching(trace, mode, opRegistries);
    emit(`planner.compiled(${plan.plan_id}, mode=${mode})`);

    const board = compileBoard(plan, trace, opRegistries);
    emit(`board.compiled(${board.program_id}, cues=${board.cues.length})`);

    // Strip internals at the contract boundary.
    const { _outputs, ...traceOut } = trace;
    const { _symbol, ...problemOut } = problem;
    return {
      ok: true,
      problem: problemOut,
      canonical,
      executable,
      trace: traceOut,
      plan,
      board,
      final_answer: _outputs[executable.program[executable.program.length - 1].out],
      // the Desk's understood-chip text (RFC-004 §4 step 1)
      understood: `${problem.given[0].payload.int} ${SYMBOL[canonical.form.slice(0, 3)]} ${problem.given[1].payload.int} = ?`,
      events,
    };
  }

  return { solve, checkAnswer, ghostStep };
}
