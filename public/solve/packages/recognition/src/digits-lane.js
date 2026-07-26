// digits-local — the M0 recognition lane (observation.v1 producer).
// Deterministic $P matching over hand-authored templates; multi-digit via
// x-gap stroke clustering. Below threshold → the lift is INCONCLUSIVE and
// the ASK affordance takes over (the contract's path — never a guess).
// TrOCR/ML lanes join the same bus later as SECOND lanes (RFC-TUT-10).

import { recognizeCloud, prepareTemplate } from './pcloud.js';
import { DIGIT_TEMPLATES, OPERATOR_TEMPLATES, TEMPLATE_VERSION } from './digit-templates.js';

export const LANE = { id: 'digits-local', version: '0.2.0', templates: TEMPLATE_VERSION };
export const CONFIDENCE_THRESHOLD = 0.55;

const prepare = (defs) => Object.entries(defs).map(([label, strokes]) => prepareTemplate(label, strokes));
const CHARSETS = {
  digits: prepare(DIGIT_TEMPLATES),
  expression: prepare({ ...DIGIT_TEMPLATES, ...OPERATOR_TEMPLATES }),
};
const EXPRESSION_SHAPE = /^\d{1,2}[+−×÷]\d{1,2}$/;

const bbox = (stroke) => {
  const xs = stroke.points.map((p) => p.x), ys = stroke.points.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
};

// Left-to-right clustering: a horizontal gap wider than ~45% of character
// height starts a new character. Deterministic; tunable; versioned via LANE.
export function clusterStrokes(strokes) {
  const withBox = strokes.map((s) => ({ s, b: bbox(s) })).sort((a, c) => a.b.minX - c.b.minX);
  const clusters = [];
  for (const item of withBox) {
    const cur = clusters[clusters.length - 1];
    const h = cur ? Math.max(cur.maxY - cur.minY, item.b.maxY - item.b.minY, 24) : 24;
    if (cur && item.b.minX - cur.maxX < 0.42 * h) {
      cur.items.push(item.s);
      cur.maxX = Math.max(cur.maxX, item.b.maxX);
      cur.minY = Math.min(cur.minY, item.b.minY);
      cur.maxY = Math.max(cur.maxY, item.b.maxY);
    } else {
      clusters.push({ items: [item.s], maxX: item.b.maxX, minY: item.b.minY, maxY: item.b.maxY });
    }
  }
  return clusters.map((c) => c.items);
}

let obsSeq = 0;

// strokes: ink.v1 strokes → observation.v1 (+ a lift verdict for the Desk)
export function recognizeInk(strokes, { regionId = 'answer_zone', charset = 'digits' } = {}) {
  const templates = CHARSETS[charset];
  if (!templates) throw new Error(`unknown charset: ${charset}`);
  const clusters = clusterStrokes(strokes);
  const chars = clusters.map((cluster) => {
    const ranked = recognizeCloud(cluster.map((s) => s.points), templates);
    return { best: ranked[0], second: ranked[1], ranked };
  });

  const linear = chars.map((c) => c.best.label).join('');
  const confidence = chars.length ? Math.min(...chars.map((c) => c.best.score)) : 0;

  // n-best alternate: swap the least-confident character for its runner-up.
  const alternates = [];
  if (chars.length) {
    const weakest = chars.reduce((m, c, i) => (chars[m].best.score <= c.best.score ? m : i), 0);
    const alt = chars.map((c, i) => (i === weakest ? c.second.label : c.best.label)).join('');
    if (alt !== linear) alternates.push({ payload: { linear: alt }, confidence: chars[weakest].second.score });
  }

  const observation = {
    obs_id: `obs-dl-${++obsSeq}`,
    region: { region_id: regionId, stroke_refs: strokes.map((s) => s.stroke_id) },
    recognizer: { id: LANE.id, version: LANE.version },
    kind: 'math_linear',
    payload: { linear },
    confidence: Math.round(confidence * 100) / 100,
    alternates,
  };

  const shape = charset === 'expression' ? EXPRESSION_SHAPE : /^\d+$/;
  const conclusive = chars.length > 0 && confidence >= CONFIDENCE_THRESHOLD && shape.test(linear);
  const lift = !conclusive
    ? { status: 'inconclusive', guess: linear || null }
    : charset === 'expression'
      ? { status: 'lifted', surface: linear }
      : { status: 'lifted', value: parseInt(linear, 10) };
  return { observation, lift };
}

// Back-compat name for the answer path (digits charset).
export const recognizeAnswer = (strokes, opts = {}) => recognizeInk(strokes, { ...opts, charset: 'digits' });

// Bus-compatible lane wrapper: one digit cluster → ranked digit candidates.
// Lets digits-local sit on the multi-lane bus next to onnx-digits (RFC-TUT-10).
export function localDigitsLane() {
  return {
    id: LANE.id,
    version: LANE.version,
    charset: 'digits',
    async recognizeCluster(clusterStrokes) {
      return recognizeCloud(clusterStrokes.map((s) => s.points), CHARSETS.digits);
    },
  };
}
