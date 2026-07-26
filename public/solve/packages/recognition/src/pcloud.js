// $P point-cloud matcher (Vatavu, Anthony, Wobbrock 2012) — deterministic,
// multi-stroke, direction/order invariant. ~90 lines, zero dependencies.
// This is the M0 digits lane's engine: determinism 'strict', replay-exact.

const N = 32; // resample size

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function strokeLength(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += dist(pts[i - 1], pts[i]);
  return d;
}

// Sample k points at equal arc-length positions along one polyline (direct
// interpolation — no mutation, no drift).
function samplePolyline(pts, k) {
  if (pts.length === 1) return Array.from({ length: k }, () => ({ ...pts[0] }));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  const L = cum[cum.length - 1] || 1;
  const out = [];
  for (let j = 0; j < k; j++) {
    const target = (k === 1 ? 0.5 : j / (k - 1)) * L;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < target) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const t = (target - cum[i - 1]) / seg;
    out.push({
      x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x),
      y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y),
    });
  }
  return out;
}

// Resample each stroke proportionally to its length (no interpolation across
// pen lifts), yielding n points total for the whole multi-stroke cloud.
export function resample(strokes, n = N) {
  const lengths = strokes.map(strokeLength);
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  const quotas = strokes.map((_, i) => Math.max(2, Math.round((lengths[i] / total) * n)));
  // Reconcile rounding so quotas sum to n (adjust the longest stroke).
  const diff = n - quotas.reduce((a, b) => a + b, 0);
  const longest = lengths.indexOf(Math.max(...lengths));
  quotas[longest] = Math.max(2, quotas[longest] + diff);
  return strokes.flatMap((pts, i) => samplePolyline(pts, quotas[i]));
}

export function normalize(points) {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const xr = Math.max(...xs) - Math.min(...xs);
  const yr = Math.max(...ys) - Math.min(...ys);
  // Non-uniform unit-box scaling so narrow handwriting matches square
  // templates; the 0.2 floor keeps thin shapes ('1') from exploding noise.
  const sx = Math.max(xr, 0.2 * yr) || 1;
  const sy = Math.max(yr, 0.2 * xr) || 1;
  return points.map((p) => ({ x: (p.x - cx) / sx, y: (p.y - cy) / sy }));
}

function cloudDistance(a, b, start) {
  const n = a.length;
  const matched = new Array(n).fill(false);
  let sum = 0, i = start;
  do {
    let min = Infinity, index = -1;
    for (let j = 0; j < n; j++) {
      if (!matched[j]) {
        const d = dist(a[i], b[j]);
        if (d < min) { min = d; index = j; }
      }
    }
    matched[index] = true;
    sum += (1 - ((i - start + n) % n) / n) * min;
    i = (i + 1) % n;
  } while (i !== start);
  return sum;
}

function greedyMatch(a0, b0) {
  const m = Math.min(a0.length, b0.length);
  const a = a0.slice(0, m), b = b0.slice(0, m);
  const step = Math.max(1, Math.floor(Math.sqrt(m)));
  let min = Infinity;
  for (let start = 0; start < m; start += step) {
    min = Math.min(min, cloudDistance(a, b, start), cloudDistance(b, a, start));
  }
  return min;
}

// strokes: [[{x,y},…],…] · templates: [{label, points (pre-normalized cloud)}]
// → ranked [{label, score ∈ 0..1}]
export function recognizeCloud(strokes, templates) {
  const cloud = normalize(resample(strokes));
  return templates
    .map((t) => ({ label: t.label, score: Math.max(0, (2.0 - greedyMatch(cloud, t.points)) / 2.0) }))
    .sort((p, q) => q.score - p.score);
}

export function prepareTemplate(label, strokes) {
  return { label, points: normalize(resample(strokes)) };
}
