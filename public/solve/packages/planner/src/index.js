// @problem-runtime/planner — execution_trace.v1 → teaching_plan.v1 (RFC-006).
// Groups trace spans (covers), narrates the WHY via the op's explain()
// template, sequences teaching_moves per mode. Static artifact — interaction
// state is the kernel's, never the plan's.

const POLICIES = {
  watch:  { feedback: 'on_milestone', ghost_step: 'disabled', full_solution: 'on_request' },
  guided: { feedback: 'on_request',  ghost_step: 'enabled',  full_solution: 'post_attempt' },
  assess: { feedback: 'on_request',  ghost_step: 'disabled', full_solution: 'never' },
};

export function planTeaching(trace, mode, opRegistries) {
  if (trace.verification.status !== 'passed') {
    throw new Error('unverified trace is unperformable (RFC-006)'); // the gate holds here too
  }
  const policies = POLICIES[mode];
  if (!policies) throw new Error(`unknown mode: ${mode}`);

  const teaching_moves = [];
  for (const step of trace.steps) {
    const op = opRegistries.find((r) => r.registry === step.registry)?.ops[step.opcode];
    const narration = { text: op.explain(step), grounding_refs: [] };
    if (mode === 'watch') {
      teaching_moves.push({ move: 'reveal', covers: [step.step_id], narration });
    } else {
      teaching_moves.push({ move: 'wait', covers: [step.step_id] });
      teaching_moves.push({ move: 'hint', covers: [step.step_id], ladder: ['nudge', 'concept', 'ghost_step', 'reveal'], narration });
      teaching_moves.push({ move: 'checkpoint', covers: [step.step_id], probe: 'answer_correct', on_pass: 'complete', on_fail: `hint:${step.step_id}` });
    }
  }

  return {
    plan_id: `tp-${trace.trace_id}`,
    graph_ref: trace.trace_id,
    mode,
    teaching_moves,
    policies,
    planner_version: '0.1.0',
  };
}
