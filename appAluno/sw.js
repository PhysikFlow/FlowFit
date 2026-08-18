const CACHE_NAME = "flowfit-aluno-v103";
const APP_SHELL = [
  "./",
  "./index.html",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-1024.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/pwa/screenshots/login.png",
  "./css/tokens.css?v=build-20260816-1",
  "./css/components.css?v=build-20260816-2",
  "./css/fonts.css?v=build-20260817-1",
  "./assets/fonts/anton-400.woff2",
  "./assets/fonts/barlow-condensed-400.woff2",
  "./assets/fonts/barlow-condensed-500.woff2",
  "./assets/fonts/barlow-condensed-600.woff2",
  "./assets/fonts/barlow-condensed-700.woff2",
  "./assets/fonts/bebas-neue-400.woff2",
  "./assets/fonts/oswald-400.woff2",
  "./assets/fonts/oswald-500.woff2",
  "./assets/fonts/oswald-600.woff2",
  "./assets/fonts/oswald-700.woff2",
  "./assets/fonts/rajdhani-400.woff2",
  "./assets/fonts/rajdhani-500.woff2",
  "./assets/fonts/rajdhani-600.woff2",
  "./assets/fonts/rajdhani-700.woff2",
  "./assets/fonts/saira-condensed-400.woff2",
  "./assets/fonts/saira-condensed-500.woff2",
  "./assets/fonts/saira-condensed-600.woff2",
  "./assets/fonts/saira-condensed-700.woff2",
  "./assets/fonts/teko-400.woff2",
  "./assets/fonts/teko-500.woff2",
  "./assets/fonts/teko-600.woff2",
  "./assets/fonts/teko-700.woff2",
  "./css/app.css?v=build-20260817-7",
  "./js/app.js?v=build-20260818-1",
  "./js/components/custom-select.js?v=build-20260816-1",
  "./js/components/feedback.js?v=build-20260816-1",
  "./js/components/install-ui.js?v=build-20260816-3",
  "./js/components/wheel-picker.js?v=build-20260816-2",
  "./js/screens/agenda/agenda-screen.js?v=build-20260816-1",
  "./js/screens/evolution/evolution-screen.js?v=build-20260816-1",
  "./js/screens/history/history-screen.js?v=build-20260816-1",
  "./js/screens/home/home-screen.js?v=build-20260818-1",
  "./js/screens/notifications/notifications-screen.js?v=build-20260816-1",
  "./js/state/app-state.js?v=build-20260816-1",
  "./js/state/workout-session-state.js?v=build-20260816-1",
  "./js/utils/formatters.js?v=build-20260816-1",
  "./js/data/repositories/auth-repository.js?v=build-20260812-6",
  "./js/data/repositories/student-repository.js?v=build-20260813-2",
  "./js/data/repositories/theme-repository.js?v=build-20260818-1",
  "./js/data/repositories/workout-repository.js?v=build-20260813-2",
  "./js/data/repositories/session-repository.js?v=build-20260813-1",
  "./js/config.js?v=build-20260809-6",
  "./js/core/brand-theme.js?v=build-20260818-1",
  "./js/core/install.js?v=build-20260816-2",
  "./js/core/icons.js?v=build-20260810-7",
  "./js/core/platform.js?v=build-20260813-1",
  "./js/core/store.js?v=build-20260813-1",
  "./js/core/session-draft-storage.js?v=build-20260811-2",
  "./js/core/theme.js?v=build-20260818-1",
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
