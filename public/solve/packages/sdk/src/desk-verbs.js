// Desk verbs (M0): Check and Tab — deterministic, event-logged.

// Check — verdict localized to the student's answer (check_result.v1 shape).
export function checkAnswer(session, studentValue) {
  const expected = session.final_answer;
  const pass = studentValue === expected;
  session.events.push(`check.requested → check.returned(answer_correct, ${pass ? 'pass' : 'fail'})`);
  return {
    check_id: `ck-${session.problem.problem_id}`,
    check: 'answer_correct',
    target_ref: session.trace.trace_id,
    verdict: pass ? 'pass' : 'fail',
    expected,
    got: studentValue,
    where: pass ? undefined : { lift_path: 'student_answer' },
    checker: { id: 'arith-eval', version: '0.1.0' },
    hint_ref: pass ? null : `hint:${session.trace.steps[0].step_id}`,
  };
}

// Tab — the ghost step. EXACTLY ONE step; accept is a logged hint descent
// (assisted progress is honest progress, RFC-004 §4).
export function ghostStep(session) {
  const cue = session.board.cues.find((c) => c.actions.some((a) => a.action === 'ghost_write'));
  session.events.push(`ghost.shown(${cue.actions[0].payload.from})`);
  return cue.actions[0].payload;
}
