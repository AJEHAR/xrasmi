// ============================================================
// storage.js — Lapisan storan (wrapper Firebase Realtime DB)
// ------------------------------------------------------------
// Dimuatkan SELEPAS firebase SDK (compat) + firebase-config.js.
// Menyediakan window.storage.{get,set,delete,getAllByPrefix}
// dengan Anonymous Authentication automatik.
// ============================================================

firebase.initializeApp(FIREBASE_CONFIG);
const _db = firebase.database();

// Bantu diagnosis: kalau CONFIG masih placeholder (belum diisi ikut README), beri amaran JELAS dlm console
if (!FIREBASE_CONFIG || String(FIREBASE_CONFIG.apiKey || "").includes("GANTI_DENGAN")) {
  console.error("[Keputusan Tak Rasmi] firebase-config.js MASIH ada nilai placeholder (GANTI_DENGAN_...). Isi dgn kredential projek Firebase sebenar dulu — rujuk README.md bahagian 2.");
}

function _timeout(ms, mesej) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(mesej)), ms));
}

let _authReady = null;
function _ensureAuth() {
  if (!_authReady) {
    _authReady = Promise.race([
      new Promise((resolve, reject) => {
        try {
          firebase.auth().onAuthStateChanged((user) => {
            if (user) {
              resolve(user);
            } else {
              firebase.auth().signInAnonymously().catch((err) => {
                console.error("[Keputusan Tak Rasmi] Anonymous sign-in gagal — semak Firebase Console > Authentication > Sign-in method > Anonymous mesti Enable:", err);
                reject(err);
              });
            }
          }, (err) => {
            console.error("[Keputusan Tak Rasmi] onAuthStateChanged ralat:", err);
            reject(err);
          });
        } catch (err) { reject(err); }
      }),
      // Elak sistem 'senyap selamanya' — kalau 10 saat tiada respon Firebase, timeout dgn mesej JELAS
      _timeout(10000, "Tiada respon daripada Firebase selepas 10 saat. Semak: (1) firebase-config.js diisi betul, (2) sambungan internet, (3) Firebase Realtime Database wujud & Rules betul.")
    ]);
    _authReady.catch(() => { _authReady = null; }); // benarkan cuba lagi (bukan cache ralat selamanya)
  }
  return _authReady;
}

window.storage = {
  async get(key, shared = false) {
    await _ensureAuth();
    const path = (shared ? "shared/" : "personal/") + key;
    const snap = await Promise.race([_db.ref(path).once("value"), _timeout(10000, "Baca data Firebase tiada respon (10 saat). Semak sambungan internet & Rules.")]);
    if (!snap.exists()) return null;
    return { key, value: snap.val(), shared };
  },

  async set(key, value, shared = false) {
    await _ensureAuth();
    const path = (shared ? "shared/" : "personal/") + key;
    await Promise.race([_db.ref(path).set(value), _timeout(10000, "Tulis data Firebase tiada respon (10 saat). Kemungkinan Rules tolak (semak auth != null) atau sambungan terputus.")]);
    return { key, value, shared };
  },

  async delete(key, shared = false) {
    await _ensureAuth();
    const path = (shared ? "shared/" : "personal/") + key;
    await Promise.race([_db.ref(path).remove(), _timeout(10000, "Padam data Firebase tiada respon (10 saat).")]);
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
    const hasil = await Promise.race([_db.ref(path).transaction(updateFn), _timeout(10000, "Transaction Firebase tiada respon (10 saat).")]);
    return { key, value: hasil.snapshot ? hasil.snapshot.val() : null, committed: hasil.committed, shared };
  },

  // Baca SEMUA key+value dengan prefix tertentu dalam SATU panggilan.
  async getAllByPrefix(prefix, shared = false) {
    await _ensureAuth();
    const base = shared ? "shared" : "personal";
    const snap = await Promise.race([_db.ref(base).once("value"), _timeout(10000, "Baca senarai Firebase tiada respon (10 saat).")]);
    if (!snap.exists()) return {};
    const all = snap.val();
    const result = {};
    Object.keys(all).forEach((k) => {
      if (!prefix || k.startsWith(prefix)) result[k] = all[k];
    });
    return result;
  }
};
