// session.v1 — the append-only session event stream (RFC-004 §5).
// THE ONLY RUNTIME WRITE SURFACE: everything the Desk does becomes a typed
// event; a session reconstructs from its stream + pinned artifact versions.

export function memoryStorage() {
  const m = new Map();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v), keys: () => [...m.keys()] };
}

export function browserStorage(prefix = 'problem-runtime:session:') {
  return {
    get: (k) => localStorage.getItem(prefix + k),
    set: (k, v) => localStorage.setItem(prefix + k, v),
    keys: () => Object.keys(localStorage).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)),
  };
}

export function createSessionLog({ sessionId, pins = {}, storage = memoryStorage() }) {
  const events = [];
  let seq = 0;
  const api = {
    sessionId,
    pins,
    events,
    append(type, data = {}) {
      const e = { seq: ++seq, type, data };
      events.push(e);
      storage.set(sessionId, JSON.stringify(api.toJSON()));
      return e;
    },
    toJSON() {
      return { version: 'session.v1', session_id: sessionId, pins, events };
    },
  };
  return api;
}

export function loadSessionLog(storage, sessionId) {
  const raw = storage.get(sessionId);
  return raw ? JSON.parse(raw) : null;
}

export function latestSession(storage) {
  const ids = storage.keys().sort();
  return ids.length ? loadSessionLog(storage, ids[ids.length - 1]) : null;
}
