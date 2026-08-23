const CACHE_NAME = "flowfit-professor-v79";
const REPDB_CACHE_NAME = "flowfit-repdb-2026.8.0-v1";
const REPDB_ORIGIN = "https://cdn.jsdelivr.net";
const REPDB_PATH_PREFIX = "/npm/@repdb/exercises@2026.8.0/";
const REPDB_CACHE_LIMIT = 81;
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css?v=build-20260823-2",
  "./js/app.js?v=build-20260823-2",
  "./js/components/feedback.js?v=build-20260816-1",
  "./js/core/navigation.js?v=build-20260816-1",
  "./js/screens/dashboard/dashboard-screen.js?v=build-20260822-1",
  "./js/screens/appearance/local-assets-editor.js?v=build-20260818-1",
  "./js/screens/workouts/workouts-screen.js?v=build-20260816-1",
  "./js/screens/workouts/repdb-picker.js?v=build-20260823-1",
  "./js/pdf/workout-pdf-exporter.js?v=build-20260820-2",
  "./js/pdf/workout-pdf-generator.js?v=build-20260820-2",
  "./js/screens/students/students-screen.js?v=build-20260822-1",
  "./js/state/view-state.js?v=build-20260816-1",
  "./js/utils/formatters.js?v=build-20260816-1",
  "./vendor/cropperjs/cropper.min.css?v=1.6.2",
  "./vendor/cropperjs/cropper.min.js?v=1.6.2",
  "./vendor/pdf-lib/pdf-lib.esm.min.js?v=1.17.1",
  "../appAluno/assets/icons/apple-touch-icon.png",
  "../appAluno/assets/icons/icon-192.png",
  "../appAluno/assets/icons/icon-512.png",
  "../appAluno/assets/icons/icon-1024.png",
  "../appAluno/assets/icons/icon-maskable-512.png",
  "../appAluno/assets/icons/startup-logo-512.png",
  "../appAluno/assets/icons/phosphor/icons.svg",
  "./assets/pwa/screenshots/login.png",
  "../appAluno/css/tokens.css?v=build-20260816-1",
  "../appAluno/css/components.css?v=build-20260822-1",
  "../appAluno/css/fonts.css?v=build-20260817-1",
  "../appAluno/css/date-picker.css?v=build-20260819-1",
  "../appAluno/assets/fonts/anton-400.woff2",
  "../appAluno/assets/fonts/barlow-condensed-400.woff2",
  "../appAluno/assets/fonts/barlow-condensed-500.woff2",
  "../appAluno/assets/fonts/barlow-condensed-600.woff2",
  "../appAluno/assets/fonts/barlow-condensed-700.woff2",
  "../appAluno/assets/fonts/bebas-neue-400.woff2",
  "../appAluno/assets/fonts/oswald-400.woff2",
  "../appAluno/assets/fonts/oswald-500.woff2",
  "../appAluno/assets/fonts/oswald-600.woff2",
  "../appAluno/assets/fonts/oswald-700.woff2",
  "../appAluno/assets/fonts/rajdhani-400.woff2",
  "../appAluno/assets/fonts/rajdhani-500.woff2",
  "../appAluno/assets/fonts/rajdhani-600.woff2",
  "../appAluno/assets/fonts/rajdhani-700.woff2",
  "../appAluno/assets/fonts/saira-condensed-400.woff2",
  "../appAluno/assets/fonts/saira-condensed-500.woff2",
  "../appAluno/assets/fonts/saira-condensed-600.woff2",
  "../appAluno/assets/fonts/saira-condensed-700.woff2",
  "../appAluno/assets/fonts/teko-400.woff2",
  "../appAluno/assets/fonts/teko-500.woff2",
  "../appAluno/assets/fonts/teko-600.woff2",
  "../appAluno/assets/fonts/teko-700.woff2",
  "../appAluno/js/components/custom-select.js?v=build-20260816-1",
  "../appAluno/js/config.js?v=build-20260809-6",
  "../appAluno/js/core/brand-theme.js?v=build-20260818-1",
  "../appAluno/js/core/install.js?v=build-20260816-2",
  "../appAluno/js/core/icons.js?v=build-20260822-1",
  "../appAluno/js/core/platform.js?v=build-20260813-1",
  "../appAluno/js/core/refresh-coordinator.js?v=build-20260820-1",
  "../appAluno/js/core/frozen-backdrop.js?v=build-20260821-3",
  "../appAluno/js/core/date-picker.js?v=build-20260822-1",
  "../appAluno/js/core/supabase.js?v=build-20260812-5",
  "../appAluno/js/data/repositories/auth-repository.js?v=build-20260812-6",
  "../appAluno/js/data/training-domain.js?v=build-20260823-2",
  "../appAluno/js/data/repositories/programming-repository.js?v=build-20260823-2",
  "../appAluno/js/data/repositories/student-repository.js?v=build-20260822-1",
  "../appAluno/js/data/repositories/student-profile-repository.js?v=build-20260822-1",
  "../appAluno/js/data/repositories/theme-repository.js?v=build-20260820-1",
  "../appAluno/js/data/repositories/workout-repository.js?v=build-20260823-2",
  "../appAluno/js/data/repdb/repdb-catalog.js?v=build-20260823-1",
  "../appAluno/js/data/repositories/session-repository.js?v=build-20260823-2",
  "./js/screens/agenda/agenda-planner.js?v=build-20260821-2"
];

const matchCachedRequest = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const exact = await cache.match(request);
  if (exact) return exact;

  const url = new URL(request.url);
  const isVersionedAsset = url.pathname.endsWith(".js")
    || url.pathname.endsWith(".css")
    || url.pathname.endsWith(".webmanifest");
  if (!isVersionedAsset || !url.search) return null;

  const keys = await cache.keys();
  const matchedKey = keys.find((cachedRequest) => new URL(cachedRequest.url).pathname === url.pathname);
  return matchedKey ? cache.match(matchedKey) : null;
};

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
        .filter((key) => (key.startsWith("flowfit-professor-") && key !== CACHE_NAME)
          || (key.startsWith("flowfit-repdb-") && key !== REPDB_CACHE_NAME))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const isConfigRequest = (request) => request.url.includes("/appAluno/js/config.js");
const isRepdbRequest = (url) => url.origin === REPDB_ORIGIN
  && url.pathname.startsWith(REPDB_PATH_PREFIX)
  && (url.pathname === `${REPDB_PATH_PREFIX}exercises.json`
    || (/^\/npm\/@repdb\/exercises@2026[.]8[.]0\/images\/flat\/[a-z0-9-]+-(start|peak|main)[.]webp$/).test(url.pathname));

const trimRepdbCache = async (cache) => {
  const keys = await cache.keys();
  const excess = keys.length - REPDB_CACHE_LIMIT;
  if (excess > 0) await Promise.all(keys.slice(0, excess).map((request) => cache.delete(request)));
};

const repdbCacheFirst = async (request) => {
  const cache = await caches.open(REPDB_CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    try {
      await cache.put(request, response.clone());
      await trimRepdbCache(cache);
    } catch {
      // Quota insuficiente não pode impedir o uso online da ilustração.
    }
  }
  return response;
};
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
    const cached = await matchCachedRequest(request);
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
  if (isRepdbRequest(requestUrl)) {
    event.respondWith(repdbCacheFirst(event.request));
    return;
  }
  if (requestUrl.origin !== self.location.origin) return;

  if (isConfigRequest(event.request) || isNetworkFirstRequest(event.request)) {
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
