// @problem-runtime/ink — ink.v1 store (RFC-002 §3 invariants, mechanized):
// INK IS NEVER DESTROYED (append-only; erase = masking stroke) and INK IS
// NEVER SEMANTIC (meaning lives in observations/lifts that cite stroke ids).

let seq = 0;

export function createInkStore(boardRef = 'b-1') {
  const strokes = [];          // append-only, ever
  let current = null;

  return {
    get strokes() { return strokes; },

    begin(tool, point, style = {}) {
      current = {
        stroke_id: `st-${++seq}`,
        board_ref: boardRef,
        tool,
        points: [normalizePoint(point)],
        style: { color: style.color ?? '#1d3557', width: style.width ?? 2.5, ...style },
        provenance: style.provenance ?? 'student',   // student | assisted | system
      };
      return current;
    },

    append(point) {
      if (current) current.points.push(normalizePoint(point));
    },

    end() {
      if (!current) return null;
      const done = current;
      strokes.push(done);
      current = null;
      return done;
    },

    // Erasure is annotation: a mask stroke referencing what it hides.
    mask(strokeIds) {
      const m = {
        stroke_id: `st-${++seq}`,
        board_ref: boardRef,
        tool: 'eraser',
        points: [],
        style: { color: 'transparent', width: 0 },
        masks: [...strokeIds],
      };
      strokes.push(m);
      return m;
    },

    // Visible strokes = everything not masked (replay with masks off recovers all).
    visible({ withMasks = true } = {}) {
      if (!withMasks) return strokes.filter((s) => s.tool !== 'eraser');
      const masked = new Set(strokes.flatMap((s) => s.masks ?? []));
      return strokes.filter((s) => s.tool !== 'eraser' && !masked.has(s.stroke_id));
    },

    toJSON() {
      return { version: 'ink.v1', board_ref: boardRef, strokes };
    },

    // Write-on replay: feeds strokes point-by-point to a draw callback.
    async replay(drawSegment, { pointDelayMs = 6 } = {}) {
      for (const s of this.visible()) {
        for (let i = 1; i < s.points.length; i++) {
          drawSegment(s, s.points[i - 1], s.points[i]);
          if (pointDelayMs) await sleep(pointDelayMs);
        }
      }
    },
  };
}

function normalizePoint(p) {
  return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, t_ms: p.t_ms ?? 0, pressure: p.pressure };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
