const CACHE_NAME = "flowfit-professor-v35";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css?v=build-20260812-3",
  "./js/app.js?v=build-20260812-5",
  "../appAluno/assets/icons/apple-touch-icon.png",
  "../appAluno/assets/icons/icon-192.png",
  "../appAluno/assets/icons/icon-512.png",
  "../appAluno/assets/icons/icon-1024.png",
  "../appAluno/assets/icons/icon-maskable-512.png",
  "../appAluno/assets/icons/startup-logo-512.png",
  "../appAluno/css/tokens.css?v=build-20260809-7",
  "../appAluno/css/components.css?v=build-20260811-9",
  "../appAluno/js/config.js?v=build-20260809-6",
  "../appAluno/js/core/brand-theme.js?v=build-20260809-7",
  "../appAluno/js/core/icons.js?v=build-20260809-6",
  "../appAluno/js/core/platform.js?v=build-20260809-6",
  "../appAluno/js/core/supabase.js?v=build-20260812-5",
  "../appAluno/js/data/repositories/auth-repository.js?v=build-20260812-5",
  "../appAluno/js/data/repositories/student-repository.js?v=build-20260812-5",
  "../appAluno/js/data/repositories/theme-repository.js?v=build-20260812-5",
  "../appAluno/js/data/repositories/workout-repository.js?v=build-20260812-1",
  "../appAluno/js/data/repositories/session-repository.js?v=build-20260812-5"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("flowfit-professor-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const isConfigRequest = (request) => request.url.includes("/appAluno/js/config.js");
const isNetworkFirstRequest = (request) => {
  const url = new URL(request.url);
  return request.mode === "navigate"
    || url.pathname.endsWith(".html")
    || url.pathname.endsWith(".js");
};

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (isConfigRequest(event.request) || isNetworkFirstRequest(event.request)) {
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
