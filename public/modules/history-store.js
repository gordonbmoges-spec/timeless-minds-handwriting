const KEY_PREFIX = "minds-archive-history-v1-";
const MAX_TURNS = 20;

export function createHistoryStore(storage = globalThis.localStorage) {
  function load(personaId) {
    try {
      const value = JSON.parse(storage.getItem(keyFor(personaId)) || "[]");
      if (!Array.isArray(value)) return [];
      return value.map(normalizeTurn).filter(Boolean).slice(0, MAX_TURNS);
    } catch {
      return [];
    }
  }

  function append(personaId, turn) {
    const normalized = normalizeTurn(turn);
    if (!normalized) return load(personaId);
    const turns = [normalized, ...load(personaId)].slice(0, MAX_TURNS);
    try { storage.setItem(keyFor(personaId), JSON.stringify(turns)); } catch {}
    return turns;
  }

  function clear(personaId) {
    try { storage.removeItem(keyFor(personaId)); } catch {}
  }

  return { load, append, clear };
}

function keyFor(personaId) {
  return `${KEY_PREFIX}${String(personaId || "").replace(/[^a-z0-9-]/gi, "")}`;
}

function normalizeTurn(turn) {
  const transcript = clean(turn?.transcript, 900);
  const reply = clean(turn?.reply, 300);
  if (!transcript || !reply) return null;
  const at = Number.isNaN(Date.parse(turn?.at)) ? new Date().toISOString() : new Date(turn.at).toISOString();
  return { transcript, reply, at };
}

function clean(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
