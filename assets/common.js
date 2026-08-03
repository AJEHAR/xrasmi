// ============================================================
// common.js — Logik kongsi antara Board, Admin & Setting
// ============================================================

const PREFIX = "ktr"; // Keputusan Tak Rasmi — ubah kalau nak kongsi 1 Firebase project untuk >1 sistem
const ACARA_PREFIX = PREFIX + ":acara:";
const SETTINGS_KEY = PREFIX + ":settings";

const FIXED_PASSWORD = "ajehar"; // sandaran tertanam dalam kod — Peringkat UI sahaja, BUKAN keselamatan sebenar.

function keyAcara(id) {
  return ACARA_PREFIX + id;
}

function uid() {
  return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// ---------- Keselamatan asas: elak XSS ----------
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------- Peringkat: parsing fleksibel (SA/A/SF/F/Bahasa penuh) ----------
const PERINGKAT_LABEL = {
  separuh_akhir: { ms_singkat: "SA", ms_penuh: "Separuh Akhir", en_singkat: "SF", en_penuh: "Semi-Final" },
  akhir: { ms_singkat: "A", ms_penuh: "Akhir", en_singkat: "F", en_penuh: "Final" }
};

function parsePeringkat(raw) {
  const v = String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
  const SEPARUH_AKHIR = ["sa", "separuh akhir", "sf", "semi-final", "semi final", "semifinal"];
  const AKHIR = ["a", "akhir", "f", "final"];
  if (SEPARUH_AKHIR.includes(v)) return "separuh_akhir";
  if (AKHIR.includes(v)) return "akhir";
  return null;
}

function labelPeringkat(peringkat, gaya = "ms_singkat") {
  if (!peringkat || !PERINGKAT_LABEL[peringkat]) return "?";
  return PERINGKAT_LABEL[peringkat][gaya];
}

// ---------- Countdown / masa ----------
function computeRemainingMs(rekod) {
  if (!rekod || !rekod.calledAt || !rekod.durationMin) return null;
  const masaTamat = rekod.calledAt + rekod.durationMin * 60 * 1000;
  return masaTamat - Date.now();
}

function isTamatMasa(rekod) {
  const r = computeRemainingMs(rekod);
  return r !== null && r <= 0;
}

function formatMMSS(remainingMs) {
  if (remainingMs === null || remainingMs === undefined) return "--:--";
  let ms = remainingMs;
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

// ---------- Auto-transition: countdown -> rasmi (jika TIADA bantahan) ----------
// Pulangkan true jika rekod PATUT ditukar ke status "rasmi" pada saat ini.
function patutAutoRasmi(rekod) {
  if (!rekod || rekod.status !== "countdown") return false;
  if (rekod.adaBantahan) return false;
  return isTamatMasa(rekod);
}

// ---------- Susunan pintar: masa paling genting dulu ----------
function naturalCompare(a, b) {
  return String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" });
}

function sortTidakRasmi(list) {
  return [...list].sort((a, b) => {
    // Bantahan dulu (paling perlu perhatian), kemudian countdown ikut masa tinggal paling sikit
    if (!!a.adaBantahan !== !!b.adaBantahan) return a.adaBantahan ? -1 : 1;
    const ra = computeRemainingMs(a);
    const rb = computeRemainingMs(b);
    if (ra === null && rb === null) return naturalCompare(a.noAcara, b.noAcara);
    if (ra === null) return 1;
    if (rb === null) return -1;
    return ra - rb;
  });
}

function sortRasmi(list) {
  // Terkini DISAHKAN dulu (rasmiAt = masa sebenar jadi Rasmi; fallback calledAt untuk rekod lama sebelum medan ni wujud)
  return [...list].sort((a, b) => (b.rasmiAt || b.calledAt || 0) - (a.rasmiAt || a.calledAt || 0));
}

// ---------- Modal "Tekan untuk Mula" (kebenaran audio automatik) ----------
const AUDIO_UNLOCK_KEY = "ktr_audio_unlocked";

function audioSudahDibenarkan() {
  return localStorage.getItem(AUDIO_UNLOCK_KEY) === "true";
}

function tandaAudioDibenarkan() {
  localStorage.setItem(AUDIO_UNLOCK_KEY, "true");
}

// ---------- Butang "Keputusan" (link sama untuk semua acara, dari Setting) ----------
function urlSelamat(url) {
  // Elak scheme berbahaya (javascript:, data:, vbscript:) — cuma benarkan http/https
  return /^https?:\/\//i.test(url.trim());
}

function keputusanButtonHtml(settingsObj, kelasTambahan) {
  const url = ((settingsObj && settingsObj.linkKeputusan) || "").trim();
  if (!url || !urlSelamat(url)) return "";
  return `<a class="btn btn-keputusan btn-sm${kelasTambahan ? " " + kelasTambahan : ""}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Keputusan ↗</a>`;
}

// ---------- Notifikasi "toast" (mesej kecil timbul di bawah skrin) ----------
let _toastTimeout = null;
function tunjukToast(mesej, jenis = "info") {
  let el = document.getElementById("ktr-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "ktr-toast";
    document.body.appendChild(el);
  }
  el.className = "toast show" + (jenis === "success" ? " toast-success" : jenis === "error" ? " toast-error" : "");
  el.textContent = mesej;
  clearTimeout(_toastTimeout);
  _toastTimeout = setTimeout(() => { el.classList.remove("show"); }, 2600);
}

// ---------- Akses Admin (peringkat UI sahaja) ----------
function sahkanKataLaluan(inputVal, settings) {
  const configured = (settings && settings.adminPassword) || "";
  return inputVal === FIXED_PASSWORD || (configured && inputVal === configured);
}
