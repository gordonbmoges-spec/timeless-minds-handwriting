const KEY_PREFIX = "minds-archive-memory-v1-";
const MAX_LENGTH = 600;

export function createPersonaMemoryStore(storage = globalThis.localStorage) {
  function load(personaId) {
    try { return String(storage.getItem(keyFor(personaId)) || "").slice(0, MAX_LENGTH); }
    catch { return ""; }
  }

  function save(personaId, value) {
    const memory = String(value || "").replace(/\s+/g, " ").trim().slice(0, MAX_LENGTH);
    try {
      if (memory) storage.setItem(keyFor(personaId), memory);
      else storage.removeItem(keyFor(personaId));
      return true;
    } catch {
      return false;
    }
  }

  function clear(personaId) {
    try {
      storage.removeItem(keyFor(personaId));
      return true;
    } catch {
      return false;
    }
  }

  return { load, save, clear };
}

function keyFor(personaId) {
  return `${KEY_PREFIX}${String(personaId || "").replace(/[^a-z0-9-]/gi, "")}`;
}
