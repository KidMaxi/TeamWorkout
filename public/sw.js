// Minimal service worker: makes the app installable. Data is never cached,
// so staff and athletes always see current team data.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
