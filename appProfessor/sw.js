const CACHE_NAME = "flowfit-professor-v56";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css?v=build-20260817-5",
  "./js/app.js?v=build-20260816-8",
  "./js/components/feedback.js?v=build-20260816-1",
  "./js/core/navigation.js?v=build-20260816-1",
  "./js/screens/dashboard/dashboard-screen.js?v=build-20260816-1",
  "./js/screens/appearance/local-assets-editor.js?v=build-20260816-2",
  "./js/screens/workouts/workouts-screen.js?v=build-20260816-1",
  "./js/screens/students/students-screen.js?v=build-20260816-3",
  "./js/state/view-state.js?v=build-20260816-1",
  "./js/utils/formatters.js?v=build-20260816-1",
  "./vendor/cropperjs/cropper.min.css?v=1.6.2",
  "./vendor/cropperjs/cropper.min.js?v=1.6.2",
  "../appAluno/assets/icons/apple-touch-icon.png",
  "../appAluno/assets/icons/icon-192.png",
  "../appAluno/assets/icons/icon-512.png",
  "../appAluno/assets/icons/icon-1024.png",
  "../appAluno/assets/icons/icon-maskable-512.png",
  "../appAluno/assets/icons/startup-logo-512.png",
  "./assets/pwa/screenshots/login.png",
  "../appAluno/css/tokens.css?v=build-20260816-1",
  "../appAluno/css/components.css?v=build-20260816-2",
  "../appAluno/js/components/custom-select.js?v=build-20260816-1",
  "../appAluno/js/config.js?v=build-20260809-6",
  "../appAluno/js/core/brand-theme.js?v=build-20260816-2",
  "../appAluno/js/core/install.js?v=build-20260816-2",
  "../appAluno/js/core/icons.js?v=build-20260809-6",
  "../appAluno/js/core/platform.js?v=build-20260809-6",
  "../appAluno/js/core/supabase.js?v=build-20260812-5",
  "../appAluno/js/data/repositories/auth-repository.js?v=build-20260812-6",
  "../appAluno/js/data/repositories/student-repository.js?v=build-20260813-2",
  "../appAluno/js/data/repositories/theme-repository.js?v=build-20260816-1",
  "../appAluno/js/data/repositories/workout-repository.js?v=build-20260813-2",
  "../appAluno/js/data/repositories/session-repository.js?v=build-20260812-5"
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
