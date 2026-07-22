const KEY_PREFIX = "minds-archive-persona-profile-v1-";
const MAX_IDENTITY_LENGTH = 500;
const MAX_PERSONALITY_LENGTH = 500;

export function createPersonaProfileStore(storage = globalThis.localStorage) {
  function load(personaId) {
    try {
      const parsed = JSON.parse(storage.getItem(keyFor(personaId)) || "null");
      return normalizePersonaProfile(parsed);
    } catch {
      return null;
    }
  }

  function save(personaId, profile) {
    const normalized = normalizePersonaProfile(profile);
    try {
      if (normalized) storage.setItem(keyFor(personaId), JSON.stringify(normalized));
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

export function normalizePersonaProfile(profile) {
  if (!profile || typeof profile !== "object") return null;
  const identity = cleanText(profile.identity, MAX_IDENTITY_LENGTH);
  const personality = cleanText(profile.personality, MAX_PERSONALITY_LENGTH);
  if (!identity && !personality) return null;
  return { identity, personality };
}

export function applyPersonaProfile(persona, profile) {
  if (!persona) return null;
  const normalized = normalizePersonaProfile(profile);
  if (!normalized) return persona;
  return {
    ...persona,
    identity: normalized.identity || persona.identity,
    personality: normalized.personality || persona.personality,
    hasProfileOverride: true
  };
}

function keyFor(personaId) {
  return `${KEY_PREFIX}${String(personaId || "").replace(/[^a-z0-9-]/gi, "")}`;
}

function cleanText(value, maxLength) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
