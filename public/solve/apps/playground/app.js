// Solve Desk (M0) — wires the SDK pipeline to canvas + ink + Desk verbs.
import { buildUI } from './ui.js';
import { createRuntime } from '../../packages/sdk/src/index.js';
import { mathPlugin } from '../../plugins/math/src/index.js';
import { createCanvas2DAdapter } from '../../packages/canvas/src/canvas2d-adapter.js';
import { createInkStore } from '../../packages/ink/src/index.js';
import { recognizeInk, createBus, localDigitsLane, makeOnnxLane, browserSession, makeRemoteExpressionLane } from '../../packages/recognition/src/index.js';
import { createSessionLog, browserStorage, latestSession, replaySession } from '../../packages/runtime/src/index.js';

// The recognition BUS: digits-local ($P, always ready) + onnx-digits (MNIST CNN,
// lazy-loads the vendored model on first Check). Both emit observation.v1; the
// bus arbitrates per digit (RFC-TUT-10 §4). onnx failure degrades to local only.
// onnxruntime-web loads from jsDelivr (see the import map in solve.astro); ORT
// resolves its wasm relative to that module URL, so only the model is vendored.
const onnxLane = makeOnnxLane(() => browserSession('/solve/models/mnist-cnn.onnx'));
const bus = createBus({ lanes: [localDigitsLane(), onnxLane] });

// The server expression lane (Option 3, pix2tex) needs a backend — GitHub Pages
// has none, so it is absent here. The hand-written-problem path degrades to
// digits-local by design (RFC-TUT-10 graceful degrade). makeRemoteExpressionLane
// stays imported for parity with the dev Desk.
void makeRemoteExpressionLane;
const serverLane = null;

const ui = buildUI();
const rt = createRuntime({ plugins: [mathPlugin] });

// Regions scale with the laid-out canvas (symbolic zones, responsive geometry).
const REGIONS = { problem_line: {}, work_zone: {}, answer_zone: {} };
function layoutRegions() {
  const w = Math.max(ui.board.clientWidth, 320);
  Object.assign(REGIONS.problem_line, { x: 30, y: 96, w: Math.min(240, w * 0.4), h: 60 });
  Object.assign(REGIONS.work_zone, { x: 30, y: 200, w: w - 60, h: 60 });
  Object.assign(REGIONS.answer_zone, { x: Math.max(w * 0.52, 170), y: 58, w: Math.min(190, w * 0.42), h: 88 });
}
layoutRegions();
const port = createCanvas2DAdapter(ui.board, { regions: REGIONS });
let ink = createInkStore();
const sessionStorage_ = browserStorage();
let slog = null;   // session.v1 stream — the only runtime write surface

// Re-measure once styles have laid the canvas out, and on window resize.
window.addEventListener('load', () => { layoutRegions(); port.resize(); redrawAll(); });
window.addEventListener('resize', () => { layoutRegions(); port.resize(); redrawAll(); });

let session = null;
let attempted = false;
let hintRung = 0;
let problemText = '';
let assistedTexts = [];   // accepted ghosts — persistent board objects (provenance=assisted)

const log = (line) => {
  ui.consoleEl.textContent += line + '\n';
  ui.consoleEl.scrollTop = ui.consoleEl.scrollHeight;
};

// ---- ink capture (student writes; every stroke is an event) ----
let lastPoint = null;
port.attachInput({
  onStrokeStart: (p) => { ink.begin('pen', p); lastPoint = p; },
  onStrokePoint: (p) => {
    ink.append(p);
    if (lastPoint) port.drawSegment({ style: { color: '#1d3557', width: 2.5 }, provenance: 'student' }, lastPoint, p);
    lastPoint = p;
  },
  onStrokeEnd: () => {
    lastPoint = null;
    const s = ink.end();
    if (s) {
      log(`ink.stroke_added(${s.stroke_id}, points=${s.points.length})`);
      slog?.append('ink.stroke_added', { stroke: s });
    }
  },
});

function paintProblemInstant() {
  const c = ui.board.getContext('2d');
  c.save();
  c.font = '28px "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive';
  c.fillStyle = '#2b2b2b';
  c.fillText(problemText, REGIONS.problem_line.x, REGIONS.problem_line.y);
  c.restore();
}
function paintAssisted() {
  const c = ui.board.getContext('2d');
  c.save();
  c.font = '28px "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive';
  c.fillStyle = '#7a5cc4';
  for (const a of assistedTexts) {
    const r = REGIONS[a.region];
    c.fillText(a.text, r.x + 14, r.y + 34);
  }
  c.restore();
}
function redrawAll(extra) {
  port.redraw(ink.visible());
  if (session && problemText) paintProblemInstant();
  paintAssisted();
  if (extra) extra();
}

// ---- solve flow ----
async function solveProblem(surface, { fromInk = false, keepStrokes = [] } = {}) {
  session = null; attempted = false; hintRung = 0; problemText = ''; assistedTexts = [];
  ui.watchBtn.disabled = true;
  port.clearGhost();
  ink = createInkStore();                       // fresh session, fresh ink (old store was persisted)
  port.redraw([]);
  const s = rt.solve(surface);
  for (const e of s.events) log(e);
  if (!s.ok) { log(`REFUSED: ${s.error}`); return; }
  session = s;
  slog = createSessionLog({
    sessionId: `s-${Date.now()}`,
    pins: { trace: s.trace.trace_id, plan: s.plan.plan_id, board: s.board.program_id },
    storage: sessionStorage_,
  });
  slog.append('session.opened', { surface, mode: 'guided', from_ink: fromInk });
  for (const st of keepStrokes) {               // a hand-written problem stays on the board
    ink.begin(st.tool, st.points[0], st.style); for (const p of st.points.slice(1)) ink.append(p);
    const kept = ink.end(); slog.append('ink.stroke_added', { stroke: kept });
  }
  problemText = s.understood.replace(' = ?', ' =');
  ui.chip.textContent = `${fromInk ? 'read' : 'understood'}: ${s.understood}`;
  ui.chip.style.display = 'block';
  log(`desk.understood_chip_shown('${s.understood}')`);
  if (fromInk) redrawAll();
  else await port.writeLine(problemText, 'problem_line');
}
function strokesInProblemZone() {
  const limitX = REGIONS.answer_zone.x - 20;
  return ink.visible().filter((s) => {
    const xs = s.points.map((p) => p.x), ys = s.points.map((p) => p.y);
    return (Math.min(...xs) + Math.max(...xs)) / 2 < limitX && (Math.min(...ys) + Math.max(...ys)) / 2 < 175;
  });
}
async function trySolveFromInk() {
  const pz = strokesInProblemZone();
  if (!pz.length) return false;

  // The server expression lane (pix2tex) would go first, but it is absent on the
  // static deploy (no backend) — so the problem read uses digits-local directly.
  let observation, lift, source = 'digits-local';
  if (serverLane) {
    try {
      const r = await serverLane.recognizeExpression(pz);
      if (r.observation) log(`recognition.observed(${r.observation.obs_id}, ${r.observation.recognizer.id}@${r.observation.recognizer.version}, latex='${r.observation.payload.latex ?? ''}', read='${r.observation.payload.linear}', conf=${r.observation.confidence})`);
      if (r.lift.status === 'lifted') { observation = r.observation; lift = r.lift; source = 'pix2tex-server'; }
      else log(`server read '${r.observation?.payload?.linear ?? ''}' inconclusive (${r.lift.reason}) → digits-local`);
    } catch (err) {
      log(`recognition.lane_error(pix2tex-server: ${(err.message || err).toString().split('\n')[0]}) → digits-local`);
    }
  }

  if (!lift || lift.status !== 'lifted') {
    ({ observation, lift } = recognizeInk(pz, { charset: 'expression', regionId: 'problem_zone' }));
    log(`recognition.observed(${observation.obs_id}, ${observation.recognizer.id}@${observation.recognizer.version}, read='${observation.payload.linear}', conf=${observation.confidence})`);
  }

  if (lift.status !== 'lifted') { log(`problem lift inconclusive ('${lift.guess ?? ''}') → type it instead`); return true; }
  log(`semantic.lifted(surface='${lift.surface}') [${source}]`);
  solveProblem(lift.surface, { fromInk: true, keepStrokes: pz });
  return true;
}

// ---- Check: recognition-first; ASK only when the lift is inconclusive ----
function strokesInAnswerZone() {
  const z = REGIONS.answer_zone;
  return ink.visible().filter((s) => {
    const xs = s.points.map((p) => p.x), ys = s.points.map((p) => p.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    return cx >= z.x - 12 && cx <= z.x + z.w + 12 && cy >= z.y - 30 && cy <= z.y + z.h + 12;
  });
}
function runCheck(value) {
  const result = rt.checkAnswer(session, value);
  log(session.events[session.events.length - 1]);
  slog?.append('check.returned', { value, verdict: result.verdict });
  attempted = true;
  ui.watchBtn.disabled = false; // post_attempt policy unlocks
  redrawAll(() => (result.verdict === 'pass' ? port.tick() : port.cross()));
  if (result.verdict === 'fail') log(`hint available: ${result.hint_ref}`);
}
function openAsk(prefill) {
  ui.ask.style.display = 'flex';
  ui.askValue.value = prefill;
  ui.askValue.focus();
}
ui.checkBtn.addEventListener('click', async () => {
  if (!session) return;
  // An accepted ghost is system ink with a known value — no recognition needed.
  if (assistedTexts.length) { runCheck(Number(assistedTexts.at(-1).text)); return; }
  const zone = strokesInAnswerZone();
  if (!zone.length) { log('no ink in the answer zone → ASK'); openAsk(''); return; }

  let observations, arbitrated, lift;
  try {
    ({ observations, arbitrated, lift } = await bus.recognizeDigits(zone));
  } catch (err) {
    // onnx lane failed to load → degrade to digits-local, honestly logged.
    log(`recognition.lane_error(onnx: ${(err.message || err).split('\n')[0]}) → digits-local only`);
    ({ observation: arbitrated, lift } = recognizeInk(zone, { charset: 'digits' }));
    observations = [arbitrated];
  }
  for (const o of observations) log(`recognition.observed(${o.obs_id}, ${o.recognizer.id}@${o.recognizer.version}, read='${o.payload.linear}', conf=${o.confidence})`);
  slog?.append('recognition.observed', { observations, arbitrated });
  if (arbitrated.recognizer?.id === 'bus-arbitrated') {
    log(`bus.arbitrated(read='${arbitrated.payload.linear}', conf=${arbitrated.confidence}, agreement=${arbitrated.agreement}, conflicts=${arbitrated.hard_conflicts})`);
  }
  if (lift.status === 'lifted') {
    log(`semantic.lifted(value=${lift.value})`);
    ui.chip.textContent = `read: ${lift.value} · ${session.understood}`;
    runCheck(lift.value);
  } else {
    log(`lift inconclusive (${lift.reason ?? ''}) → ASK, never guess${lift.guess ? ` (guess '${lift.guess}' offered, not asserted)` : ''}`);
    openAsk(lift.guess ?? '');
  }
});
ui.askOk.addEventListener('click', () => {
  ui.ask.style.display = 'none';
  const v = Number(ui.askValue.value);
  if (ui.askValue.value === '' || Number.isNaN(v)) return;
  log(`student.disambiguation_answered(${v})`);
  runCheck(v);
});

// ---- 💡 ladder: nudge → concept → ghost → reveal ----
ui.hintBtn.addEventListener('click', async () => {
  if (!session) return;
  hintRung = Math.min(hintRung + 1, 4);
  const rungName = ['', 'nudge', 'concept', 'ghost_step', 'reveal'][hintRung];
  log(`hint.descended(rung=${hintRung}:${rungName})`);
  if (hintRung === 1) { redrawAll(); port.highlight('problem_line'); }
  if (hintRung === 2) showExplainer();
  if (hintRung === 3) showGhost();
  if (hintRung === 4) { attempted = true; ui.watchBtn.disabled = false; await watchSolution(); }
});

// ---- ghost step (Tab) ----
function showGhost() {
  if (!session) return;
  const payload = rt.ghostStep(session);
  log(session.events[session.events.length - 1]);
  port.ghostWrite(payload.text, 'answer_zone');
}
function acceptGhost() {
  if (!port.hasGhost()) return;
  const text = port.ghostText();
  port.clearGhost();
  log('ghost.accepted → hint.descended(ghost_step); ink performed with provenance=assisted');
  slog?.append('ghost.accepted', { text });
  assistedTexts.push({ text, region: 'answer_zone' });
  redrawAll();
}
ui.ghostBtn.addEventListener('click', () => (port.hasGhost() ? acceptGhost() : showGhost()));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') { e.preventDefault(); port.hasGhost() ? acceptGhost() : showGhost(); }
  if (e.key === 'Escape' && port.hasGhost()) { port.clearGhost(); redrawAll(); log('ghost.dismissed'); }
});

// ---- step explainer (plan narration + trace justification — zero model calls) ----
function showExplainer() {
  if (!session) return;
  const move = session.plan.teaching_moves.find((m) => m.narration);
  const step = session.trace.steps[0];
  ui.explainer.innerHTML =
    `<div>${move.narration.text}</div>` +
    `<div class="just">justification: ${JSON.stringify(step.justification)} · ` +
    `${step.registry}/${step.opcode}@${step.op_version} · executor ${step.executor.id}@${step.executor.version} (${step.executor.determinism})</div>`;
  log(`widget.step_opened(${step.step_id}) — narration from the plan, no model call`);
}
ui.board.addEventListener('click', () => { if (session) showExplainer(); });

// ---- watch-mode playback (post_attempt policy) ----
async function watchSolution() {
  if (!attempted || !session) return;
  log('widget.solution_opened(mode=watch, policy=post_attempt)');
  const step = session.trace.steps[0];
  const op = mathPlugin.opRegistries[0].ops[step.opcode];
  await port.writeLine(op.render(step), 'work_zone', { color: '#20504a' });
}
ui.watchBtn.addEventListener('click', watchSolution);

// ---- ink replay + erase (INK IS NEVER DESTROYED) ----
ui.replayBtn.addEventListener('click', async () => {
  log(`ink.replay(strokes=${ink.visible().length})`);
  port.redraw([]);
  if (problemText) paintProblemInstant();
  await ink.replay((s, p1, p2) => port.drawSegment(s, p1, p2));
});
ui.eraseBtn.addEventListener('click', () => {
  const last = ink.visible().at(-1);
  if (!last) return;
  ink.mask([last.stroke_id]);
  log(`ink.masked(${last.stroke_id}) — erase is annotation; the stroke survives`);
  redrawAll();
});

// ---- session replay: verify the stream, or restore the last session ----
ui.sessionBtn.addEventListener('click', () => {
  const stream = slog ? slog.toJSON() : latestSession(sessionStorage_);
  if (!stream) { log('no recorded sessions'); return; }
  try {
    const state = replaySession(stream, rt);
    log(`session.replayed(${stream.session_id}: events=${state.events}, checks re-derived=${state.checks.length}, divergence=none)`);
    if (!slog) {
      // Fresh page + stored stream → restore the board from the log.
      session = state.session;
      problemText = session.understood.replace(' = ?', ' =');
      ink = createInkStore();
      for (const st of state.strokes) { ink.begin(st.tool, st.points[0], st.style); for (const p of st.points.slice(1)) ink.append(p); ink.end(); }
      assistedTexts = state.assisted.map((text) => ({ text, region: 'answer_zone' }));
      attempted = state.checks.length > 0;
      ui.watchBtn.disabled = !attempted;
      ui.chip.textContent = `restored: ${session.understood}`;
      ui.chip.style.display = 'block';
      redrawAll(() => { const last = state.checks.at(-1); if (last) (last.verdict === 'pass' ? port.tick() : port.cross()); });
      log(`session.restored(${stream.session_id})`);
    }
  } catch (err) {
    log(`REPLAY FAILED: ${err.message}`);
  }
});

// ---- header wiring ----
ui.solveBtn.addEventListener('click', async () => {
  if (!ui.input.value.trim()) { if (await trySolveFromInk()) return; }   // hand-written problem
  solveProblem(ui.input.value);
});
ui.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') solveProblem(ui.input.value); });
for (const b of ui.quick) b.addEventListener('click', () => { ui.input.value = b.dataset.p; solveProblem(b.dataset.p); });

log('solve-desk ready — pick a problem, then write your answer in ink (digits-local lane live)');

// Dev hook for automated in-browser verification (not part of the product).
window.__desk = {
  ink, REGIONS, redrawAll,
  injectStroke(points) {
    ink.begin('pen', points[0]);
    for (const p of points.slice(1)) ink.append(p);
    const s = ink.end();
    redrawAll();
    log(`ink.stroke_added(${s.stroke_id}, points=${s.points.length})`);
    return s.stroke_id;
  },
};
