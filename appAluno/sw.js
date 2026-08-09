const CACHE_NAME = "flowfit-aluno-v48";
const APP_SHELL = [
  "./",
  "./index.html",
  "./assets/icons/app-icon.svg",
  "./css/tokens.css?v=build-20260809-7",
  "./css/components.css?v=build-20260809-8",
  "./css/app.css?v=build-20260809-6",
  "./js/app.js?v=build-20260809-8",
  "./js/data/repositories/auth-repository.js?v=build-20260809-6",
  "./js/data/repositories/student-repository.js?v=build-20260809-6",
  "./js/data/repositories/theme-repository.js?v=build-20260809-7",
  "./js/data/repositories/workout-repository.js?v=build-20260809-6",
  "./js/data/repositories/session-repository.js?v=build-20260809-6",
  "./js/config.js?v=build-20260809-6",
  "./js/core/brand-theme.js?v=build-20260809-7",
  "./js/core/icons.js?v=build-20260809-6",
  "./js/core/platform.js?v=build-20260809-6",
  "./js/core/store.js?v=build-20260809-6",
  "./js/core/theme.js?v=build-20260809-7",
  "./js/core/supabase.js?v=build-20260809-6",
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

const isNetworkFirstRequest = (request) => {
  const url = new URL(request.url);
  return request.mode === "navigate"
    || url.pathname.endsWith(".html")
    || url.pathname.endsWith(".js");
};

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (isNetworkFirstRequest(event.request)) {
    // HTML e JavaScript priorizam a rede para que login, RLS e correcoes de
    // sincronizacao nao fiquem presos em uma versao antiga instalada.
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
