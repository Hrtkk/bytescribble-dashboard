// @problem-runtime/canvas — CanvasPort, first adapter: native Canvas 2D.
// THE PORT RULE HOLDS: all engine access goes through this module. tldraw
// remains the intended workspace adapter (RFC-TUT-10 §1.3; blocked on
// registry access + license decision Q1) — this adapter exists so M0 ships
// and so the port is proven with TWO planned implementations from day one.
//
// Port surface (what any adapter must provide):
//   attachInput({onStrokeStart,onStrokePoint,onStrokeEnd})  — student ink in
//   drawSegment(stroke, p1, p2) · redraw(strokes)           — ink rendering
//   writeLine(text, region, opts) · ghostWrite(text, region)
//   tick(region) · cross(region) · highlight(region) · clearGhost()
//   regions: named worksheet zones (SYMBOLIC targets, RFC-006 §2.2)

const HAND_FONT = '28px "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive';

export function createCanvas2DAdapter(canvasEl, { regions }) {
  const ctx = canvasEl.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Size to the LAID-OUT element; callers re-invoke on window load/resize
  // (module scripts can run before stylesheets shape the element).
  function resize() {
    canvasEl.width = canvasEl.clientWidth * dpr;
    canvasEl.height = canvasEl.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  let ghost = null; // {text, region} — the one revocable thing on the board

  function paper() {
    ctx.save();
    ctx.fillStyle = '#fdfcf7';
    ctx.fillRect(0, 0, canvasEl.clientWidth, canvasEl.clientHeight);
    ctx.strokeStyle = '#e3e0d1';
    ctx.lineWidth = 1;
    for (let y = 40; y < canvasEl.clientHeight; y += 36) {
      ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(canvasEl.clientWidth - 16, y); ctx.stroke();
    }
    const az = regions.answer_zone;
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = '#b9c4d6';
    ctx.strokeRect(az.x, az.y, az.w, az.h);
    ctx.setLineDash([]);
    ctx.fillStyle = '#a9b3c4';
    ctx.font = '11px system-ui';
    ctx.fillText('write your answer here', az.x + 8, az.y + az.h - 8);
    ctx.restore();
  }

  function drawSegment(stroke, p1, p2) {
    ctx.save();
    ctx.strokeStyle = stroke.provenance === 'assisted' ? '#7a5cc4' : stroke.style.color;
    ctx.lineWidth = (stroke.style.width ?? 2.5) * (p2.pressure ? 0.6 + p2.pressure : 1);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    ctx.restore();
  }

  function redraw(strokes, extras = []) {
    paper();
    for (const s of strokes) {
      for (let i = 1; i < s.points.length; i++) drawSegment(s, s.points[i - 1], s.points[i]);
    }
    for (const fn of extras) fn(ctx);
    if (ghost) paintGhost();
  }

  // System writing — animated, handwriting-styled (the skin, never the data).
  async function writeLine(text, regionName, { color = '#2b2b2b', charDelayMs = 45 } = {}) {
    const r = regions[regionName];
    ctx.save();
    ctx.font = HAND_FONT;
    ctx.fillStyle = color;
    for (let i = 1; i <= text.length; i++) {
      ctx.save(); ctx.fillStyle = '#fdfcf7';
      ctx.fillRect(r.x - 2, r.y - 26, ctx.measureText(text).width + 12, 34);
      ctx.restore();
      ctx.fillText(text.slice(0, i), r.x, r.y);
      if (charDelayMs) await sleep(charDelayMs);
    }
    ctx.restore();
  }

  function paintGhost() {
    const r = regions[ghost.region];
    ctx.save();
    ctx.font = HAND_FONT;
    ctx.fillStyle = 'rgba(90,100,120,0.38)';
    ctx.fillText(ghost.text, r.x + 14, r.y + 34);
    ctx.restore();
  }

  function ghostWrite(text, region = 'answer_zone') { ghost = { text, region }; paintGhost(); }
  function clearGhost() { ghost = null; }
  function hasGhost() { return !!ghost; }
  function ghostText() { return ghost?.text; }

  function mark(regionName, glyph, color) {
    const r = regions[regionName];
    ctx.save();
    ctx.font = 'bold 30px system-ui';
    ctx.fillStyle = color;
    ctx.fillText(glyph, r.x + r.w - 34, r.y + 36);
    ctx.restore();
  }
  const tick = (region = 'answer_zone') => mark(region, '✓', '#2f8f4e');
  const cross = (region = 'answer_zone') => mark(region, '✗', '#c0392b');

  function highlight(regionName) {
    const r = regions[regionName];
    ctx.save();
    ctx.strokeStyle = '#e9b949'; ctx.lineWidth = 3;
    ctx.strokeRect(r.x - 6, r.y - 30, r.w, r.h);
    ctx.restore();
  }

  function attachInput({ onStrokeStart, onStrokePoint, onStrokeEnd }) {
    let drawing = false;
    const pos = (e) => {
      const rect = canvasEl.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top, t_ms: Math.round(e.timeStamp), pressure: e.pressure || undefined };
    };
    canvasEl.addEventListener('pointerdown', (e) => { drawing = true; canvasEl.setPointerCapture(e.pointerId); onStrokeStart(pos(e)); });
    canvasEl.addEventListener('pointermove', (e) => { if (drawing) onStrokePoint(pos(e)); });
    const up = (e) => { if (drawing) { drawing = false; onStrokeEnd(pos(e)); } };
    canvasEl.addEventListener('pointerup', up);
    canvasEl.addEventListener('pointercancel', up);
  }

  paper();
  return { regions, resize, attachInput, drawSegment, redraw, writeLine, ghostWrite, clearGhost, hasGhost, ghostText, tick, cross, highlight };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
