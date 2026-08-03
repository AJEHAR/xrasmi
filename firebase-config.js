// ============================================================
// firebase-config.js
// ------------------------------------------------------------
// GANTIKAN nilai di bawah dengan kredential projek Firebase
// awak sendiri (Firebase Console → Project Settings → Your apps
// → SDK setup and configuration → Config).
//
// PENTING:
// - Fail ini WAJIB dimuatkan SEBELUM storage.js pada setiap
//   halaman HTML (index.html, admin/index.html, setting/index.html).
// - Walaupun nilai ini "selamat" untuk didedahkan mengikut reka
//   bentuk Firebase (ia bukan kata laluan), ia tetap unik untuk
//   projek awak — jangan kongsi config projek production dalam
//   repo yang tidak berkaitan.
// - Keselamatan sebenar datang dari Firebase Realtime Database
//   Rules (rujuk README.md) + Firebase Authentication, BUKAN
//   dari merahsiakan fail ini.
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "GANTI_DENGAN_API_KEY_AWAK",
  authDomain: "GANTI_DENGAN_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://GANTI_DENGAN_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "GANTI_DENGAN_PROJECT_ID",
  storageBucket: "GANTI_DENGAN_PROJECT_ID.appspot.com",
  messagingSenderId: "GANTI_DENGAN_SENDER_ID",
  appId: "GANTI_DENGAN_APP_ID"
};
