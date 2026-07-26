/**
 * Scribble Board.
 *
 * Strokes are kept as data (points + style) rather than baked pixels, so
 * undo/redo, theme changes and window resizes all just replay the list.
 * Line width tapers with pointer speed — and with real pressure when the
 * device reports it — which is what makes a plain canvas feel like ink.
 */

const canvas = document.getElementById('board');
const wrap = document.getElementById('canvas-wrap');
const ctx = canvas.getContext('2d');
const hint = document.getElementById('hint');
const strokeCount = document.getElementById('stroke-count');

let strokes = [];
let redoStack = [];
let current = null;

let tool = 'brush';
let color = '#F3F4F8';
let size = 6;
let mirror = 1;

const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

function resize() {
  const rect = wrap.getBoundingClientRect();
  canvas.width = Math.max(1, rect.width * dpr());
  canvas.height = Math.max(1, rect.height * dpr());
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  redraw();
}

/* ---------------- Drawing ---------------- */

function boardColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--board').trim() || '#101218';
}

/** Paint one stroke, mirrored as many times as the current symmetry asks. */
function paint(stroke) {
  const { points, color: c, size: s, tool: t, mirror: m } = stroke;
  if (points.length < 2) return;

  const scale = dpr();
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = t === 'eraser' ? boardColor() : c;

  for (let k = 0; k < m; k++) {
    const angle = (k / m) * Math.PI * 2;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.translate(cx / scale, cy / scale);
    ctx.rotate(angle);
    // Odd copies are flipped so even symmetries read as true mirrors.
    if (m > 1 && k % 2 === 1) ctx.scale(1, -1);
    ctx.translate(-cx / scale, -cy / scale);

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const prev = points[i - 1];
      // Quadratic smoothing through the midpoint kills the polygon look.
      const mx = (prev.x + p.x) / 2;
      const my = (prev.y + p.y) / 2;
      ctx.lineWidth = Math.max(0.6, s * p.w);
      ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx, my);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
}

function redraw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = boardColor();
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
  for (const s of strokes) paint(s);
  if (current) paint(current);
  strokeCount.textContent = `${strokes.length} ${strokes.length === 1 ? 'stroke' : 'strokes'}`;
}

/* ---------------- Pointer handling ---------------- */

function pos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

/** Width factor: real pressure if the stylus gives it, else speed-tapered. */
function widthFor(e, prev, point) {
  if (e.pointerType === 'pen' && e.pressure > 0 && e.pressure !== 0.5) {
    return 0.35 + e.pressure * 1.1;
  }
  if (!prev) return 1;
  const d = Math.hypot(point.x - prev.x, point.y - prev.y);
  // Fast strokes thin out, slow strokes stay full — like a real nib.
  return Math.max(0.45, Math.min(1.25, 1.25 - d / 45));
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const p = pos(e);
  current = {
    points: [{ ...p, w: 1 }],
    color,
    size,
    tool,
    mirror
  };
  hint?.classList.add('gone');
});

canvas.addEventListener('pointermove', (e) => {
  if (!current) return;
  const p = pos(e);
  const prev = current.points[current.points.length - 1];
  if (Math.hypot(p.x - prev.x, p.y - prev.y) < 1.1) return;
  current.points.push({ ...p, w: widthFor(e, prev, p) });
  redraw();
});

function endStroke() {
  if (!current) return;
  if (current.points.length > 1) {
    strokes.push(current);
    redoStack = [];
  }
  current = null;
  redraw();
}
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);
canvas.addEventListener('pointerleave', endStroke);

/* ---------------- Controls ---------------- */

function press(nodes, match) {
  nodes.forEach((n) => n.setAttribute('aria-pressed', String(match(n))));
}

const toolBtns = [...document.querySelectorAll('[data-tool]')];
toolBtns.forEach((b) =>
  b.addEventListener('click', () => {
    tool = b.dataset.tool;
    press(toolBtns, (n) => n === b);
  })
);

const swatches = [...document.querySelectorAll('.swatch[data-color]')];
swatches.forEach((b) =>
  b.addEventListener('click', () => {
    color = b.dataset.color;
    tool = 'brush';
    press(toolBtns, (n) => n.dataset.tool === 'brush');
    press(swatches, (n) => n === b);
  })
);

document.getElementById('custom-color').addEventListener('input', (e) => {
  color = e.target.value;
  tool = 'brush';
  press(toolBtns, (n) => n.dataset.tool === 'brush');
  press(swatches, () => false);
});

document.getElementById('size').addEventListener('input', (e) => {
  size = Number(e.target.value);
});

const mirrorBtns = [...document.querySelectorAll('[data-mirror]')];
mirrorBtns.forEach((b) =>
  b.addEventListener('click', () => {
    mirror = Number(b.dataset.mirror);
    press(mirrorBtns, (n) => n === b);
  })
);

function undo() {
  const s = strokes.pop();
  if (s) redoStack.push(s);
  redraw();
}
function redo() {
  const s = redoStack.pop();
  if (s) strokes.push(s);
  redraw();
}

document.getElementById('undo').addEventListener('click', undo);
document.getElementById('redo').addEventListener('click', redo);

document.getElementById('clear').addEventListener('click', () => {
  if (strokes.length && !confirm('Clear the board?')) return;
  strokes = [];
  redoStack = [];
  redraw();
  hint?.classList.remove('gone');
});

document.getElementById('save').addEventListener('click', () => {
  // Export at the canvas's real pixel size, background included.
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const octx = out.getContext('2d');
  octx.fillStyle = boardColor();
  octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(canvas, 0, 0);
  const a = document.createElement('a');
  a.download = 'scribble-board.png';
  a.href = out.toDataURL('image/png');
  a.click();
});

document.getElementById('theme').addEventListener('click', () => {
  const root = document.documentElement;
  const next = root.getAttribute('data-board') === 'light' ? 'dark' : 'light';
  root.setAttribute('data-board', next);
  localStorage.setItem('board-theme', next);
  redraw();
});

/* ---------------- Keyboard ---------------- */

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const meta = e.metaKey || e.ctrlKey;
  if (meta && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
    return;
  }
  const sizeInput = document.getElementById('size');
  switch (e.key.toLowerCase()) {
    case 'b':
      tool = 'brush';
      press(toolBtns, (n) => n.dataset.tool === 'brush');
      break;
    case 'e':
      tool = 'eraser';
      press(toolBtns, (n) => n.dataset.tool === 'eraser');
      break;
    case '[':
      size = Math.max(1, size - 2);
      sizeInput.value = size;
      break;
    case ']':
      size = Math.min(48, size + 2);
      sizeInput.value = size;
      break;
  }
});

/* ---------------- Boot ---------------- */

const saved = localStorage.getItem('board-theme');
if (saved) document.documentElement.setAttribute('data-board', saved);

new ResizeObserver(resize).observe(wrap);
resize();
