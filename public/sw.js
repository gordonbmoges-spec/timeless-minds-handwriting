const CACHE_NAME = "answering-library-local-app-v32";
const APP_SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/data/personas.js",
  "/modules/ai-client.js",
  "/modules/ink-engine.js",
  "/modules/history-store.js",
  "/modules/persona-memory-store.js",
  "/modules/persona-profile-store.js",
  "/modules/custom-books.js",
  "/modules/book-gestures.js",
  "/modules/reply-presenter.js",
  "/modules/router.js",
  "/manifest.webmanifest",
  "/assets/app-icon.svg",
  "/assets/app-icon-180.png",
  "/assets/app-icon-512.png",
  "/assets/magic/enchanted-archive.png",
  "/assets/magic/archive-with-mirror.webp",
  "/assets/magic/archive-three-shelves.png",
  "/assets/magic/books/confucius.webp",
  "/assets/magic/books/socrates.webp",
  "/assets/magic/books/da-vinci.webp",
  "/assets/magic/books/shakespeare.webp",
  "/assets/magic/books/jung.webp",
  "/assets/magic/books/einstein.webp",
  "/assets/magic/books/tom-riddle.webp",
  "/assets/magic/books/human-parchment.webp",
  "/assets/magic/covers/confucius.webp",
  "/assets/magic/covers/socrates.webp",
  "/assets/magic/covers/da-vinci.webp",
  "/assets/magic/covers/shakespeare.webp",
  "/assets/magic/covers/jung.webp",
  "/assets/magic/covers/einstein.webp",
  "/assets/magic/covers/tom-riddle.webp",
  "/assets/magic/covers/human-parchment.webp",
  "/assets/magic/pages/arcane-inscription.webp",
  "/assets/magic/pages/blank-vellum.webp",
  "/assets/magic/panoramic-parchment.webp",
  "/assets/personas/magic-mirror/background.webp",
  "/assets/magic/antique-leather-spine.png",
  "/assets/magic/blank-parchment.png",
  "/vendor/page-flip.browser.js",
  "/og.png",
  "/assets/fonts/DancingScript.ttf",
  "/assets/fonts/IMFellEnglish-Regular.ttf",
  "/assets/fonts/UncialAntiqua-Regular.ttf",
  "/assets/fonts/ZCOOLXiaoWei-Regular.ttf",
  "/assets/personas/manifest.js",
  "/assets/personas/confucius/background.webp",
  "/assets/personas/confucius/paper.png",
  "/assets/personas/confucius/portrait.webp",
  "/assets/personas/socrates/background.webp",
  "/assets/personas/socrates/paper.png",
  "/assets/personas/socrates/portrait.webp",
  "/assets/personas/da-vinci/background.webp",
  "/assets/personas/da-vinci/paper.png",
  "/assets/personas/da-vinci/portrait.webp",
  "/assets/personas/shakespeare/background.webp",
  "/assets/personas/shakespeare/paper.png",
  "/assets/personas/shakespeare/portrait.webp",
  "/assets/personas/jung/background.webp",
  "/assets/personas/jung/paper.png",
  "/assets/personas/jung/portrait.webp",
  "/assets/personas/einstein/background.webp",
  "/assets/personas/einstein/paper.png",
  "/assets/personas/einstein/portrait.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (new URL(request.url).pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/index.html")))
  );
});
