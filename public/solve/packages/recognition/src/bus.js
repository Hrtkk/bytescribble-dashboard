// The recognition bus (RFC-TUT-10 §4): dispatch a region to every registered
// lane, collect their observation.v1 reads, and ARBITRATE per character.
// Disagreement is KEPT (loser stays in alternates) or ASKED (a hard conflict —
// both lanes confident but differ — makes the lift inconclusive). Never silent.

import { clusterStrokes } from './digits-lane.js';

const HARD_CONFLICT = 0.6; // both lanes above this and differing ⇒ ask, don't guess
let obsSeq = 0;

// lanes: [{ id, version, recognizeCluster(clusterStrokes) -> Promise<[{label,score}]> }]
export function createBus({ lanes }) {
  async function recognizeDigits(strokes, { regionId = 'answer_zone', threshold = 0.55 } = {}) {
    const clusters = clusterStrokes(strokes);
    const strokeRefs = strokes.map((s) => s.stroke_id);

    // Each lane reads every cluster.
    const laneReads = await Promise.all(lanes.map(async (lane) => {
      const perChar = await Promise.all(clusters.map((c) => lane.recognizeCluster(c)));
      const linear = perChar.map((r) => r[0]?.label ?? '?').join('');
      const confidence = perChar.length ? Math.min(...perChar.map((r) => r[0]?.score ?? 0)) : 0;
      return { lane, perChar, linear, confidence };
    }));

    // Per-character arbitration.
    const chars = clusters.map((_, i) => {
      const tops = laneReads.map((lr) => lr.perChar[i]?.[0]).filter(Boolean);
      const votes = {};
      for (const t of tops) votes[t.label] = (votes[t.label] || 0) + t.score;
      const ranked = Object.entries(votes).map(([label, score]) => ({ label, score })).sort((a, b) => b.score - a.score);
      const winner = ranked[0] ?? { label: '?', score: 0 };
      const agree = tops.length > 1 && tops.every((t) => t.label === winner.label);
      const hardConflict = !agree && tops.filter((t) => t.label !== winner.label && t.score >= HARD_CONFLICT).length > 0;
      const confidence = agree
        ? Math.min(1, winner.score / tops.length + 0.15)   // concurrence boosts
        : (tops.find((t) => t.label === winner.label)?.score ?? 0); // else the winner's own confidence
      return { label: winner.label, confidence, agree, hardConflict, alternates: ranked.slice(1) };
    });

    const linear = chars.map((c) => c.label).join('');
    const confidence = chars.length ? Math.min(...chars.map((c) => c.confidence)) : 0;
    const hardConflicts = chars.filter((c) => c.hardConflict).length;
    const agreement = chars.length ? chars.filter((c) => c.agree).length / chars.length : 0;

    // Per-lane observations (each lane's own read is kept) + the arbitrated one.
    const observations = laneReads.map((lr) => ({
      obs_id: `obs-${lr.lane.id}-${++obsSeq}`,
      region: { region_id: regionId, stroke_refs: strokeRefs },
      recognizer: { id: lr.lane.id, version: lr.lane.version },
      kind: 'math_linear',
      payload: { linear: lr.linear },
      confidence: round2(lr.confidence),
    }));
    const arbitrated = {
      obs_id: `obs-arb-${++obsSeq}`,
      region: { region_id: regionId, stroke_refs: strokeRefs },
      recognizer: { id: 'bus-arbitrated', version: '0.1.0', lanes: lanes.map((l) => `${l.id}@${l.version}`) },
      kind: 'math_linear',
      payload: { linear },
      confidence: round2(confidence),
      agreement: round2(agreement),
      hard_conflicts: hardConflicts,
      alternates: chars.flatMap((c, i) => c.alternates.map((a) => ({ payload: { char: i, linear: a.label }, confidence: round2(a.score) }))),
    };

    const conclusive = chars.length > 0 && confidence >= threshold && hardConflicts === 0 && /^\d+$/.test(linear);
    const lift = conclusive
      ? { status: 'lifted', value: parseInt(linear, 10) }
      : { status: 'inconclusive', guess: linear || null, reason: hardConflicts ? 'lane_conflict' : 'low_confidence' };

    return { observations, arbitrated, lift };
  }

  return { recognizeDigits, lanes };
}

const round2 = (v) => Math.round(v * 100) / 100;
