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
  apiKey: "AIzaSyAW1UxMOt4LJgQXYRNfauyomxI7nijbFcc",
  authDomain: "xrasmi-507ae.firebaseapp.com",
  databaseURL: "https://xrasmi-507ae-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "xrasmi-507ae",
  storageBucket: "xrasmi-507ae.firebasestorage.app",
  messagingSenderId: "334049714900",
  appId: "1:334049714900:web:ecff80e12fa03f7cbd5141"
};
