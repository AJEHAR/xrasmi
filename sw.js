// ============================================================
// sw.js — Service Worker (keperluan teknikal PWA "boleh install")
// ------------------------------------------------------------
// REKA BENTUK SENGAJA: network-first untuk SEMUA — papan ni papar
// keputusan LIVE, jadi data tak boleh "lapuk" dari cache. Cache
// cuma fallback kalau betul-betul offline (elak skrin putih terus).
// ============================================================

const CACHE_NAME = "ktr-shell-v1";
const SHELL_FILES = [
  "./",
  "./assets/style.css",
  "./assets/common.js",
  "./storage.js",
  "./firebase-config.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .catch((e) => console.warn("SW: gagal cache sebahagian shell (tak fatal):", e))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Cuma tangani GET — biar POST/PUT dsb (Firebase writes) terus ke rangkaian tanpa campur tangan
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Simpan salinan (network-first berjaya) utk fallback offline akan datang
        const salinan = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, salinan)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request)) // offline -> guna cache lama (lebih baik drpd skrin putih)
  );
});
