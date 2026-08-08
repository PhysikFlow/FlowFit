const CACHE_NAME = "flowfit-professor-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js",
  "../appAluno/assets/icons/app-icon.svg",
  "../appAluno/css/tokens.css",
  "../appAluno/css/components.css",
  "../appAluno/js/config.js",
  "../appAluno/js/core/brand-theme.js",
  "../appAluno/js/core/icons.js",
  "../appAluno/js/core/platform.js",
  "../appAluno/js/core/supabase.js",
  "../appAluno/js/data/repositories/auth-repository.js",
  "../appAluno/js/data/repositories/student-repository.js",
  "../appAluno/js/data/repositories/theme-repository.js",
  "../appAluno/js/data/repositories/workout-repository.js",
  "../appAluno/js/data/repositories/session-repository.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const isConfigRequest = (request) => request.url.includes("/appAluno/js/config.js");

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (isConfigRequest(event.request)) {
    event.respondWith(
      fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }))
  );
});
