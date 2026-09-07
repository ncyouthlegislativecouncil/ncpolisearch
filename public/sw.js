// Minimal service worker. Its only real job is to exist with a fetch handler —
// that's what makes Chrome/Android treat this as an installable app. It passes
// every request straight through to the network; the site's actual freshness
// is already handled server-side (ISR/ cache revalidation), so there's no
// offline cache to manage or go stale here.
self.addEventListener("fetch", () => {});
