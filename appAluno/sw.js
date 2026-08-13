const CACHE_NAME = "flowfit-aluno-v61";
const APP_SHELL = [
  "./",
  "./index.html",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-1024.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/startup-logo-512.png",
  "./css/tokens.css?v=build-20260809-7",
  "./css/components.css?v=build-20260811-9",
  "./css/app.css?v=build-20260812-1",
  "./js/app.js?v=build-20260812-8",
  "./js/data/repositories/auth-repository.js?v=build-20260812-6",
  "./js/data/repositories/student-repository.js?v=build-20260812-5",
  "./js/data/repositories/theme-repository.js?v=build-20260812-5",
  "./js/data/repositories/workout-repository.js?v=build-20260812-1",
  "./js/data/repositories/session-repository.js?v=build-20260812-5",
  "./js/config.js?v=build-20260809-6",
  "./js/core/brand-theme.js?v=build-20260809-7",
  "./js/core/icons.js?v=build-20260810-7",
  "./js/core/platform.js?v=build-20260809-6",
  "./js/core/store.js?v=build-20260812-1",
  "./js/core/session-draft-storage.js?v=build-20260811-2",
  "./js/core/theme.js?v=build-20260809-7",
  "./js/core/supabase.js?v=build-20260812-5",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const freshRequests = APP_SHELL.map((url) => new Request(url, { cache: "reload" }));
    await cache.addAll(freshRequests);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("flowfit-aluno-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const isNetworkFirstRequest = (request) => {
  const url = new URL(request.url);
  return request.mode === "navigate"
    || url.pathname.endsWith(".html")
    || url.pathname.endsWith(".js")
    || url.pathname.endsWith(".css")
    || url.pathname.endsWith(".webmanifest");
};

const networkFirst = async (request) => {
  try {
    // Ignora também o cache HTTP quando existe rede. O Cache Storage continua
    // sendo o fallback offline da PWA.
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      } catch {
        // Falha de quota/cache não pode impedir uma resposta online válida.
      }
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const appShell = await caches.match("./index.html");
      if (appShell) return appShell;
    }
    throw new Error("network_and_cache_unavailable");
  }
};

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (isNetworkFirstRequest(event.request)) {
    event.respondWith(networkFirst(event.request));
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
