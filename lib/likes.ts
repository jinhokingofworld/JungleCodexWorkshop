const PERSONA_STORAGE_KEY = "likedPersonas";
const DEBATE_STORAGE_KEY = "likedDebates";

function readIds(key: string) {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

function writeIds(key: string, ids: Set<string>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify([...ids]));
}

export function hasLikedPersona(id: string) {
  return readIds(PERSONA_STORAGE_KEY).has(id);
}

export function markPersonaLiked(id: string) {
  const ids = readIds(PERSONA_STORAGE_KEY);
  ids.add(id);
  writeIds(PERSONA_STORAGE_KEY, ids);
}

export function unmarkPersonaLiked(id: string) {
  const ids = readIds(PERSONA_STORAGE_KEY);
  ids.delete(id);
  writeIds(PERSONA_STORAGE_KEY, ids);
}

export function hasLikedDebate(id: string) {
  return readIds(DEBATE_STORAGE_KEY).has(id);
}

export function markDebateLiked(id: string) {
  const ids = readIds(DEBATE_STORAGE_KEY);
  ids.add(id);
  writeIds(DEBATE_STORAGE_KEY, ids);
}

export function unmarkDebateLiked(id: string) {
  const ids = readIds(DEBATE_STORAGE_KEY);
  ids.delete(id);
  writeIds(DEBATE_STORAGE_KEY, ids);
}
