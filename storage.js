// ============================================================
// storage.js — Lapisan storan (wrapper Firebase Realtime DB)
// ------------------------------------------------------------
// Dimuatkan SELEPAS firebase SDK (compat) + firebase-config.js.
// Menyediakan window.storage.{get,set,delete,getAllByPrefix}
// dengan Anonymous Authentication automatik.
// ============================================================

firebase.initializeApp(FIREBASE_CONFIG);
const _db = firebase.database();

let _authReady = null;
function _ensureAuth() {
  if (!_authReady) {
    _authReady = new Promise((resolve) => {
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          resolve(user);
        } else {
          firebase.auth().signInAnonymously().catch((err) => {
            console.error("Auth gagal:", err);
            resolve(null);
          });
        }
      });
    });
  }
  return _authReady;
}

window.storage = {
  async get(key, shared = false) {
    await _ensureAuth();
    const path = (shared ? "shared/" : "personal/") + key;
    const snap = await _db.ref(path).once("value");
    if (!snap.exists()) return null;
    return { key, value: snap.val(), shared };
  },

  async set(key, value, shared = false) {
    await _ensureAuth();
    const path = (shared ? "shared/" : "personal/") + key;
    await _db.ref(path).set(value);
    return { key, value, shared };
  },

  async delete(key, shared = false) {
    await _ensureAuth();
    const path = (shared ? "shared/" : "personal/") + key;
    await _db.ref(path).remove();
    return { key, deleted: true, shared };
  },

  // Operasi ATOMIC baca-ubah-tulis — selesaikan race condition bila 2+ client
  // (contoh: 2 admin) cuba ubah rekod SAMA serentak. Firebase automatik ULANG
  // updateFn dengan nilai TERKINI server kalau konflik dikesan (optimistic
  // concurrency) — jadi tiada perubahan yang "hilang senyap" akibat last-write-wins.
  // updateFn(nilaiSemasaDariServer) -> pulangkan nilai BAHARU (atau `undefined` untuk abort).
  async transaction(key, updateFn, shared = false) {
    await _ensureAuth();
    const path = (shared ? "shared/" : "personal/") + key;
    const hasil = await _db.ref(path).transaction(updateFn);
    return { key, value: hasil.snapshot ? hasil.snapshot.val() : null, committed: hasil.committed, shared };
  },

  // Baca SEMUA key+value dengan prefix tertentu dalam SATU panggilan.
  async getAllByPrefix(prefix, shared = false) {
    await _ensureAuth();
    const base = shared ? "shared" : "personal";
    const snap = await _db.ref(base).once("value");
    if (!snap.exists()) return {};
    const all = snap.val();
    const result = {};
    Object.keys(all).forEach((k) => {
      if (!prefix || k.startsWith(prefix)) result[k] = all[k];
    });
    return result;
  }
};
