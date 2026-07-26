// @problem-runtime/verifier — the gate (RFC-006). Re-derives every step via
// the op's verify(), asserts figure tracing, fills the verification block.
// An unverified trace is unperformable; there is no "show with a warning".

export function verifyTrace(trace, executable, problem, opRegistries) {
  const names = [];
  let passed = 0;
  const discrepancies = [];

  // R3 — every figure traces: valid refs are givens plus outputs of EARLIER nodes.
  const validRefs = new Set(problem.given.map((g) => g.id));

  trace.steps.forEach((step, i) => {
    const reg = opRegistries.find((r) => r.registry === step.registry);
    const op = reg?.ops[step.opcode];

    names.push(`${step.step_id}_figures_trace`);
    if (step.inputs.every((inp) => inp.ref && validRefs.has(inp.ref))) passed += 1;
    else discrepancies.push({ step: step.step_id, kind: 'orphan_figure' });
    validRefs.add(executable.program[i].out);

    names.push(`${step.step_id}_rederives`);
    const values = step.inputs.map((inp) => inp.value);
    if (op && op.verify(values, step.output)) passed += 1;
    else discrepancies.push({ step: step.step_id, kind: 'rederivation_mismatch' });
  });

  // answer_correct: the final program output exists and nothing upstream failed.
  names.push('answer_correct');
  const finalOut = executable.program[executable.program.length - 1].out;
  if (trace._outputs?.[finalOut] !== undefined && discrepancies.length === 0) passed += 1;

  // Key reconciliation (R5): quarantine on mismatch, never silent-fix.
  let key_reconciliation = null;
  if (problem.answer_key) {
    names.push('key_reconciles');
    const expected = problem.answer_key.values?.[0]?.value;
    const got = trace._outputs[finalOut];
    if (expected === got) { passed += 1; key_reconciliation = { matched: '1/1' }; }
    else discrepancies.push({ kind: 'key_mismatch', expected, got });
  }

  const total = names.length;
  return {
    ...trace,
    verification: {
      status: passed === total ? 'passed' : 'quarantined',
      assertions: { passed, total, names },
      key_reconciliation,
      discrepancies,
      versions: { evaluator: 'arith-eval 0.1.0', checkers: { math: '0.1.0' } },
    },
  };
}
