// @problem-runtime/board-program — teaching_plan.v1 → board_program.v1
// (RFC-006 §2.2 vocabulary). Symbolic targets only; ghost_write is the Tab
// affordance; geometry/handwriting are the renderer's problem, not ours.

export function compileBoard(plan, trace, opRegistries) {
  const cues = [];
  const stepById = Object.fromEntries(trace.steps.map((s) => [s.step_id, s]));

  for (const move of plan.teaching_moves) {
    const stepId = move.covers[move.covers.length - 1];
    const step = stepById[stepId];
    const op = opRegistries.find((r) => r.registry === step.registry)?.ops[step.opcode];

    if (move.move === 'hint') {
      cues.push({
        cue_id: `c${cues.length + 1}`,
        move_ref: `hint:${stepId}:ghost_step`,
        actions: [{ action: 'ghost_write', paper: 'p1', target: { region: 'answer_zone' }, payload: { text: op.ghost(step), from: stepId }, timing: { after: 'prev', offset_ms: 0 } }],
      });
    }
    if (move.move === 'checkpoint') {
      cues.push({
        cue_id: `c${cues.length + 1}`,
        move_ref: `checkpoint:${stepId}:pass`,
        actions: [{ action: 'tick', paper: 'p1', target: { region: 'answer_zone' }, timing: { after: 'prev', offset_ms: 150 } }],
      });
    }
    if (move.move === 'reveal' || move.move === 'hint') {
      cues.push({
        cue_id: `c${cues.length + 1}`,
        move_ref: `reveal:${stepId}`,
        actions: [{ action: 'write_line', paper: 'p1', target: { region: 'work_zone' }, payload: { text: op.render(step) }, timing: { after: 'narration', offset_ms: 0 } }],
      });
    }
  }

  return {
    program_id: `bp-${plan.plan_id}`,
    plan_ref: plan.plan_id,
    papers: [{ paper_id: 'p1', template: 'worksheet_grid', title: 'Practice' }],
    cues,
  };
}
