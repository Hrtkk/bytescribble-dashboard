// Replay (RFC-002 §3 invariant 3, with teeth): rebuild desk state from a
// session.v1 stream and RE-DERIVE every check verdict — divergence from the
// record is an error, never a shrug.

export function replaySession(streamJSON, rt) {
  if (streamJSON.version !== 'session.v1') throw new Error(`unknown stream version: ${streamJSON.version}`);
  const state = { surface: null, mode: 'guided', session: null, strokes: [], assisted: [], checks: [], events: streamJSON.events.length };

  for (const e of streamJSON.events) {
    switch (e.type) {
      case 'session.opened': {
        state.surface = e.data.surface;
        state.mode = e.data.mode ?? 'guided';
        state.session = rt.solve(state.surface, { mode: state.mode });
        if (!state.session.ok) throw new Error(`replay: solve refused ${JSON.stringify(state.surface)}`);
        break;
      }
      case 'ink.stroke_added':
        state.strokes.push(e.data.stroke);
        break;
      case 'ghost.accepted':
        state.assisted.push(e.data.text);
        break;
      case 'check.returned': {
        const again = rt.checkAnswer(state.session, e.data.value);
        if (again.verdict !== e.data.verdict) {
          throw new Error(`replay divergence: check(${e.data.value}) re-derived '${again.verdict}', recorded '${e.data.verdict}'`);
        }
        state.checks.push(again);
        break;
      }
      default:
        break; // unknown event types are data, not errors — forward-compatible
    }
  }
  return state;
}
