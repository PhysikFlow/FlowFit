const CACHE_NAME = "flowfit-aluno-v18";
const APP_SHELL = [
  "./",
  "./index.html",
  "./assets/icons/app-icon.svg",
  "./css/tokens.css",
  "./css/components.css",
  "./css/app.css",
  "./js/app.js",
  "./js/data/mock-data.js",
  "./js/data/repositories/theme-repository.js",
  "./js/data/repositories/workout-repository.js",
  "./js/config.js",
  "./js/core/brand-theme.js",
  "./js/core/icons.js",
  "./js/core/platform.js",
  "./js/core/store.js",
  "./js/core/theme.js",
  "./js/core/supabase.js",
  "./manifest.webmanifest"
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

const isConfigRequest = (request) => request.url.includes("/js/config.js");

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (isConfigRequest(event.request)) {
    // config.js pode mudar a qualquer momento (chaves do Supabase):
    // sempre tenta a rede primeiro e so usa o cache como fallback offline.
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
