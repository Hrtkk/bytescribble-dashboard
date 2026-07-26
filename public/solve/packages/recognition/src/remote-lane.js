// Remote expression lane (Option 3): a client for the server-side pix2tex
// service (services/recognize/app.py). Reads a WHOLE hand-written expression
// (2-D-capable, previews M2), where the local digit lanes only do characters.
// The Desk degrades to local lanes if this lane is unreachable — the RFC-TUT-10
// "heavy OCR server-side, graceful degrade" contract.

export function makeRemoteExpressionLane({ endpoint, laneId = 'pix2tex-server', version = '0.1.0', timeoutMs = 15000 } = {}) {
  return {
    id: laneId,
    version,
    kind: 'expression',

    // strokes (ink.v1) → { observation.v1, lift } from the server. Throws on
    // network/timeout/HTTP error so the caller can degrade honestly.
    async recognizeExpression(strokes, { regionId = 'problem_zone' } = {}) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            strokes: strokes.map((s) => ({ points: s.points.map((p) => ({ x: p.x, y: p.y })) })),
            kind: 'expression',
            region_id: regionId,
          }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`server ${res.status}`);
        const out = await res.json();
        if (out.observation) out.observation.region.stroke_refs = strokes.map((s) => s.stroke_id);
        return out;
      } finally {
        clearTimeout(timer);
      }
    },

    async health() {
      try {
        const res = await fetch(endpoint.replace(/\/recognize$/, '/health'), { method: 'GET' });
        return res.ok ? await res.json() : null;
      } catch {
        return null;
      }
    },
  };
}
