// Stroke cluster → MNIST-normalized 28×28 tensor (Option-1 lane input contract).
// Pure JS, deterministic, node-testable. Replicates MNIST preprocessing so the
// rasterized ink matches the training distribution of scripts/export_mnist_onnx.py:
//   fit the ink's longer side into a 20px box, center by CENTER OF MASS in 28×28,
//   white-on-black, pixels [0,1], then (v - 0.1307) / 0.3081.

export const SIZE = 28;
const FIT = 20;
export const MEAN = 0.1307;
export const STD = 0.3081;
const BLANK = (0 - MEAN) / STD;

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// strokes: [{points:[{x,y}]}] for ONE character → Float32Array(784)
export function rasterizeToMnist(strokes, { penRadius = 1.15 } = {}) {
  const pts = strokes.flatMap((s) => s.points);
  const buf = new Float32Array(SIZE * SIZE);
  if (!pts.length) return buf.fill(BLANK);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX || 1, h = maxY - minY || 1;
  const scale = FIT / Math.max(w, h);                 // longer side → 20px
  const offX = (SIZE - w * scale) / 2, offY = (SIZE - h * scale) / 2;
  const tx = (x) => (x - minX) * scale + offX;
  const ty = (y) => (y - minY) * scale + offY;

  const segs = [];
  for (const s of strokes) {
    const P = s.points;
    if (P.length === 1) segs.push([tx(P[0].x), ty(P[0].y), tx(P[0].x), ty(P[0].y)]);
    for (let i = 1; i < P.length; i++) segs.push([tx(P[i - 1].x), ty(P[i - 1].y), tx(P[i].x), ty(P[i].y)]);
  }

  // Anti-aliased stroke: pixel intensity from distance to the nearest segment.
  const ink = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      const cx = j + 0.5, cy = i + 0.5;
      let best = Infinity;
      for (const s of segs) { const d = distToSeg(cx, cy, s[0], s[1], s[2], s[3]); if (d < best) best = d; }
      ink[i * SIZE + j] = Math.max(0, Math.min(1, penRadius + 0.5 - best));
    }
  }

  const centered = recenterByMass(ink);
  for (let k = 0; k < centered.length; k++) buf[k] = (centered[k] - MEAN) / STD;
  return buf;
}

// Integer COM shift so the ink's center of mass sits at (14,14) — MNIST does this.
function recenterByMass(ink) {
  let m = 0, mx = 0, my = 0;
  for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) {
    const v = ink[i * SIZE + j]; m += v; mx += v * j; my += v * i;
  }
  if (m === 0) return ink;
  const shiftX = Math.round(SIZE / 2 - mx / m - 0.5);
  const shiftY = Math.round(SIZE / 2 - my / m - 0.5);
  if (shiftX === 0 && shiftY === 0) return ink;
  const out = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) {
    const si = i + shiftY, sj = j + shiftX;
    if (si >= 0 && si < SIZE && sj >= 0 && sj < SIZE) out[si * SIZE + sj] = ink[i * SIZE + j];
  }
  return out;
}

export function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}
