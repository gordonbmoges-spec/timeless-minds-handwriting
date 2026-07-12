export function routeFromPath(pathname) {
  const match = String(pathname || "").match(/^\/persona\/([a-z0-9-]+)\/?$/);
  return match ? { view: "persona", personaId: match[1] } : { view: "archive", personaId: null };
}

export function personaPath(personaId) {
  return `/persona/${encodeURIComponent(personaId)}`;
}

export function navigateTo(path) {
  history.pushState({}, "", path);
  globalThis.dispatchEvent(new PopStateEvent("popstate"));
}
