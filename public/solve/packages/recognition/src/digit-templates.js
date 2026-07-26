// Canonical digit shapes 0–9 as unit-box polylines (y down), hand-authored.
// Templates are DATA with a version — the lane's outputs cite it (RFC-007:
// version everything that judges). Multi-stroke digits list several strokes.

export const TEMPLATE_VERSION = '0.1.0';

const circle = (cx, cy, r, n = 14, from = -Math.PI / 2, dir = 1) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + dir * ((2 * Math.PI * i) / n);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });

const pts = (arr) => arr.map(([x, y]) => ({ x, y }));

export const DIGIT_TEMPLATES = {
  0: [circle(0.5, 0.5, 0.38)],
  1: [pts([[0.5, 0.05], [0.5, 0.95]])],
  2: [pts([[0.16, 0.28], [0.3, 0.08], [0.62, 0.05], [0.82, 0.22], [0.78, 0.42], [0.45, 0.66], [0.16, 0.93], [0.85, 0.93]])],
  3: [pts([[0.2, 0.12], [0.5, 0.05], [0.78, 0.18], [0.72, 0.4], [0.45, 0.48], [0.75, 0.58], [0.8, 0.8], [0.5, 0.95], [0.2, 0.86]])],
  4: [pts([[0.62, 0.05], [0.14, 0.62], [0.88, 0.62]]), pts([[0.62, 0.02], [0.62, 0.97]])],
  5: [pts([[0.8, 0.06], [0.24, 0.06], [0.22, 0.45], [0.55, 0.4], [0.82, 0.56], [0.8, 0.8], [0.52, 0.95], [0.2, 0.86]])],
  6: [pts([[0.72, 0.06], [0.42, 0.3], [0.24, 0.62]]).concat(circle(0.48, 0.72, 0.24, 12, Math.PI, 1))],
  7: [pts([[0.15, 0.08], [0.85, 0.08], [0.4, 0.95]])],
  8: [circle(0.5, 0.28, 0.22).concat(circle(0.5, 0.72, 0.25))],
  9: [circle(0.52, 0.3, 0.24).concat(pts([[0.76, 0.34], [0.7, 0.95]]))],
};

// Operators — the second half of the M0 lane ("digits/operators"). Symbol
// strokes overlap in x, so the x-gap clusterer keeps them as one character.
export const OPERATOR_TEMPLATES = {
  '+': [pts([[0.5, 0.1], [0.5, 0.9]]), pts([[0.1, 0.5], [0.9, 0.5]])],
  '−': [pts([[0.08, 0.5], [0.92, 0.5]])],
  '×': [pts([[0.15, 0.12], [0.85, 0.88]]), pts([[0.85, 0.12], [0.15, 0.88]])],
  '÷': [pts([[0.08, 0.5], [0.92, 0.5]]), pts([[0.48, 0.15], [0.54, 0.2]]), pts([[0.48, 0.8], [0.54, 0.85]])],
};
