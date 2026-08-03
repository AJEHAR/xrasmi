# Blueprint Sistem — Keputusan Tak Rasmi (Papan Keputusan Acara)

Dokumen ini adalah **spesifikasi teknikal lengkap** sistem yang telah dibina, supaya boleh digunakan sebagai rujukan/templat untuk bina aplikasi lain yang serupa (contoh: papan status untuk acara lain, sistem antrian, papan pengumuman masa-nyata, dsb).

> **Nota versi:** Sistem ini asalnya dipanggil "Call Room Board". Nama & domain telah ditukar kepada **"Keputusan Tak Rasmi"** — papan yang papar keputusan acara (contoh: pertandingan) yang bergerak dari status Tidak Rasmi (dalam tempoh bantahan) ke Rasmi (disahkan).

---

## 1. Konsep Asas

Sistem 3-skrin yang berkongsi data secara **masa-nyata** tanpa memerlukan pelayan (server) sendiri:

| Skrin | Peranan | Akses |
|---|---|---|
| **Papan (Board)** | Paparan awam/baca-sahaja, dipaparkan pada TV/projektor — 2 panel: **Tidak Rasmi** & **Rasmi** | Terbuka, tiada log masuk |
| **Admin** | Panel kawalan untuk urus data — tambah/edit/padam/tukar status, senarai satu lajur (Rasmi + Tak Rasmi bercampur, ditapis ikut status) | Dilindungi kata laluan (peringkat UI, bukan keselamatan penuh) |
| **Setting** | Konfigurasi program (nama, durasi countdown, kata laluan, bunyi) | Sama seperti Admin |

**Prinsip teras:** Admin ubah data → Firebase simpan → Board & Admin lain poll setiap beberapa saat → semua skrin nampak perubahan tanpa refresh manual.

---

## 2. Tech Stack (Kos Rendah/Percuma)

| Lapisan | Pilihan | Sebab |
|---|---|---|
| Hosting | **GitHub Pages** | Percuma, mudah, sokong domain sendiri |
| Backend/Storan | **Firebase Realtime Database** | Percuma (had penggunaan tinggi), masa-nyata, tiada server perlu ditulis |
| Auth | **Firebase Anonymous Authentication** | Elak Firebase Rules terbuka sepenuhnya, tanpa perlu borang log masuk pengguna |
| Frontend | **HTML + CSS + Vanilla JavaScript** (tiada framework) | Tiada proses "build", terus edit & push, mudah nak debug |
| CSV Parsing | **PapaParse** (CDN) | Import pukal data |
| Audio | Fail `.mp3`/`.wav` sendiri (bukan Web Audio generated) — 2 fail berasingan | Bunyi lebih jelas & profesional berbanding beep sintetik |

**Kenapa tiada framework (React/Vue dll):** Sistem ni kecil-sederhana skala, deploy terus ke GitHub Pages tanpa build step memudahkan iterasi pantas.

---

## 3. Struktur Fail

```
nama-repo/
├── index.html              ← Papan (root domain /)
├── admin/
│   └── index.html          ← Panel Admin (/admin/)
├── setting/
│   └── index.html          ← Setting (/setting/)
├── firebase-config.js      ← Kredential Firebase (JANGAN commit dengan nilai sebenar ke repo awam tanpa fikir)
├── storage.js              ← Lapisan storan (wrapper Firebase), boleh guna semula terus
├── templat-data.csv        ← Contoh data untuk import pukal (lihat bahagian 4.4)
├── sounds/
│   ├── bantahan.mp3        ← Bunyi alert bila bantahan diaktifkan (urgent/siren)
│   └── tamat-masa.mp3      ← Bunyi alert bila countdown sampai 0 (loceng/ding)
├── CNAME                   ← (pilihan) domain sendiri untuk GitHub Pages
└── README.md / SISTEM.md   ← Dokumentasi
```

**URL pendek melalui struktur folder:** GitHub Pages automatik cari `index.html` dalam setiap folder — jadi `admin/index.html` boleh diakses sebagai `/admin/` tanpa nama fail.

---

## 4. Model Data (Firebase Realtime Database)

### 4.1 Struktur storan — SATU KUNCI SETIAP REKOD

```
{root}/
├── shared/
│   ├── {prefix}:acara:{id1}     ← setiap rekod acara = satu kunci berasingan
│   ├── {prefix}:acara:{id2}
│   ├── {prefix}:settings        ← tetapan (satu blok kecil, jarang konflik)
│   └── {prefix}:migrated        ← penanda migrasi (rujuk 8.3 blueprint asal)
```

**PENTING — kenapa bukan satu blok JSON besar:** Setiap perubahan kecil (tukar status SATU rekod) sepatutnya tak perlu tulis semula seluruh senarai. Dua admin edit serentak → last-write-wins pada SATU rekod sahaja, bukan musnahkan seluruh senarai. Tambah/edit/padam SATU rekod = SATU operasi Firebase.

### 4.2 Objek Rekod Acara

```js
{
  id: "e1234567890",                       // unique ID (uid())
  noAcara: "...",                          // dari CSV "No Acara" — turut digunakan sebagai KUNCI UNIK untuk upsert
  kategori: "...",                         // dari CSV "Kategori"
  namaAcara: "...",                        // dari CSV "Nama Acara"
  peringkat: "separuh_akhir" | "akhir",    // dari CSV "Peringkat" (lihat 4.3 — parsing fleksibel)

  status: "menunggu" | "countdown" | "rasmi",
  adaBantahan: false,                      // flag berasingan — boleh ON semasa status=countdown
  calledAt: 1234567890123,                 // timestamp bila Start diklik (null jika status=menunggu)
  durationMin: 15                          // SNAPSHOT durasi (dari Setting) pada masa Start diklik — 15 (SA) atau 30 (A)
}
```

**Corak penting — "snapshot" tempoh pada rekod, bukan rujuk Setting terus:** Bila Start diklik, SALIN nilai `durasiSA`/`durasiA` dari Setting semasa itu KE rekod (`durationMin`). Papan (Board) baca nilai yang tersimpan pada rekod, BUKAN rujuk Setting secara langsung. Ini elak countdown yang tengah jalan tiba-tiba berubah kalau admin tukar Setting semasa itu.

### 4.3 Parsing Column `Peringkat` (CSV) — Terima Semua Variasi

Sistem **tidak** melakukan auto-detect (tiada klasifikasi automatik dari nama acara). Nilai `peringkat` dibaca **terus** dari column CSV, tapi parser terima **semua 4 variasi** (2 singkatan × 2 bahasa), case-insensitive, dan toleran ruang berlebihan:

```js
function parsePeringkat(raw){
  const v = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const SEPARUH_AKHIR = ['sa', 'separuh akhir', 'sf', 'semi-final', 'semi final', 'semifinal'];
  const AKHIR = ['a', 'akhir', 'f', 'final'];
  if (SEPARUH_AKHIR.includes(v)) return 'separuh_akhir';
  if (AKHIR.includes(v)) return 'akhir';
  return null; // TAK SAH — rekod ini masuk kategori "Gagal" dalam laporan import, bukan default senyap
}
```

**Jadual label paparan (2×2 — singkatan × bahasa):**

```js
const PERINGKAT_LABEL = {
  separuh_akhir: { ms_singkat: "SA", ms_penuh: "Separuh Akhir", en_singkat: "SF", en_penuh: "Semi-Final" },
  akhir:         { ms_singkat: "A",  ms_penuh: "Akhir",         en_singkat: "F",  en_penuh: "Final" }
};
```

UI guna label ringkas (`ms_singkat`) pada badge/kad ruang sempit; label penuh (`ms_penuh` / `en_penuh`) pada tooltip atau paparan admin yang ada ruang lebih.

### 4.4 Format CSV Sumber

Header yang diperlukan (**hanya 4 column ini, tiada lain**):

```
No Acara,Kategori,Nama Acara,Peringkat
```

Contoh:
```
No Acara,Kategori,Nama Acara,Peringkat
1,Lelaki Bawah 12,Badminton Perseorangan,SA
2,Wanita Bawah 15,Larian 100m,Akhir
3,Terbuka,Bola Tampar,Semi-Final
```

**`No Acara`** ialah **kunci unik** untuk operasi upsert (rujuk bahagian 6.2).

### 4.5 Objek Setting

```js
{
  eventTitle: "...",       // tajuk am dipaparkan di papan
  adminPassword: "",       // kata laluan boleh-ubah (rujuk bahagian 9)
  durasiSA: 15,             // minit — durasi countdown untuk peringkat Separuh Akhir (boleh ubah admin)
  durasiA: 30               // minit — durasi countdown untuk peringkat Akhir (boleh ubah admin)
}
```

Durasi **tidak di-hardcode** dalam kod — disimpan dalam Setting supaya admin boleh ubah tanpa edit kod (contoh: tukar SA ke 20 minit pada acara akan datang).

---

## 5. Lapisan Storan (`storage.js`) — Boleh Guna Semula Terus

```js
firebase.initializeApp(FIREBASE_CONFIG);
const _db = firebase.database();

let _authReady = null;
function _ensureAuth(){
  if(!_authReady){
    _authReady = new Promise((resolve) => {
      firebase.auth().onAuthStateChanged(user => {
        if(user){ resolve(user); }
        else {
          firebase.auth().signInAnonymously().catch(err => {
            console.error('Auth gagal:', err);
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
  async getAllByPrefix(prefix, shared = false) {
    await _ensureAuth();
    const base = shared ? "shared" : "personal";
    const snap = await _db.ref(base).once("value");
    if (!snap.exists()) return {};
    const all = snap.val();
    const result = {};
    Object.keys(all).forEach(k => { if (!prefix || k.startsWith(prefix)) result[k] = all[k]; });
    return result;
  }
};
```

**Firebase Rules diperlukan:**
```json
{ "rules": { ".read": "auth != null", ".write": "auth != null" } }
```

Dan **Authentication → Sign-in method → Anonymous → Enable** dalam Firebase Console.

---

## 6. Aliran Status & Logik Butang

### 6.1 Tiga Status + Satu Flag

```
menunggu  →  countdown  →  rasmi
              ↑    ↓
         (adaBantahan: true/false — flag bebas semasa status=countdown)
```

- **`menunggu`** — rekod baharu diimport, belum bermula
- **`countdown`** — Start diklik, timer berjalan (`calledAt` + `durationMin`), dipaparkan di panel **Tidak Rasmi**
- **`rasmi`** — disahkan (sama ada auto atau manual), dipaparkan di panel **Rasmi**
- **`adaBantahan`** — flag ON/OFF yang **bebas** dari status; boleh ON bila-bila masa semasa `status=countdown`, tak kira countdown masih berjalan atau dah 0

### 6.2 Butang & Fungsi (UI bertukar ikut status semasa)

```
status = "menunggu"   →  [ Start ]
status = "countdown"  →  [ ↺ Undo Start ]  [ Bantahan (toggle) ]  [ Rasmi ]
status = "rasmi"      →  [ ↺ Undo Rasmi ]
```

| Butang | Aksi | Kesan |
|---|---|---|
| **Start** | `status="countdown"`, `calledAt=Date.now()`, `durationMin` = snapshot dari Setting (`durasiSA`/`durasiA` ikut `peringkat` rekod) | Muncul di panel Tidak Rasmi, countdown mula berjalan, dipaparkan kepada umum |
| **↺ Undo Start** | *(perlu confirm dialog)* → `status="menunggu"`, `calledAt=null`, `durationMin=null`, `adaBantahan=false` (reset penuh) | Rekod keluar dari countdown, kembali ke keadaan asal — untuk betulkan silap pilih acara |
| **Bantahan (toggle ON)** | `adaBantahan=true` | Kad pulse **oren** di board & admin. Countdown TERUS berjalan. Auto-transition ke Rasmi **disekat** |
| **Bantahan (toggle OFF)** | `adaBantahan=false`, **serta-merta semak**: jika masa dah 0 → auto `status="rasmi"` | Pulse oren berhenti. Kalau countdown dah tamat semasa bantahan ON, terus auto-lulus sebaik bantahan dibuka |
| **Rasmi** | `status="rasmi"` (override manual) | Rekod pindah ke panel Rasmi — cara **satu-satunya** keluar dari keadaan bantahan-freeze |
| **↺ Undo Rasmi** | *(perlu confirm dialog)* → `status="countdown"` semula, `calledAt` & `durationMin` **KEKAL** (bukan restart timer) | Rekod balik ke Tidak Rasmi; jika masa asal dah lepas, terus nampak "tamat" — admin kena tindak semula |

### 6.3 Logik Auto-Transition (semak setiap poll & selepas setiap toggle Bantahan)

```js
function semakAutoTransition(rekod){
  if (rekod.status !== 'countdown') return rekod;
  const masaTamat = rekod.calledAt + (rekod.durationMin * 60 * 1000);
  const sudahTamat = Date.now() >= masaTamat;

  if (sudahTamat && !rekod.adaBantahan) {
    rekod.status = 'rasmi';       // auto-lulus — TIADA bantahan semasa tamat masa
  }
  // jika sudahTamat && adaBantahan === true → JANGAN ubah status.
  // Rekod "freeze" pada 00:00, kekal di Tidak Rasmi, terus pulse oren
  // sehingga admin klik Rasmi manual.
  return rekod;
}
```

### 6.4 Bunyi Alert — Dua Bunyi Berbeza

| Bunyi | Trigger | Fail | Dimainkan di |
|---|---|---|---|
| 🟠 **Bantahan** | `adaBantahan` bertukar `false → true` | `sounds/bantahan.mp3` (urgent/siren) | Board **dan** Admin |
| 🔴 **Tamat Masa** | Countdown sampai 0 (`Date.now() >= calledAt + durationMin*60000`) | `sounds/tamat-masa.mp3` (loceng/ding) | Board **dan** Admin |

**Penting:** kedua-dua bunyi **boleh bertindih** — contoh, rekod yang tamat masa semasa bantahan ON tetap bunyi "Tamat Masa" (walaupun dah bunyi "Bantahan" awal tadi), sebab kedua-duanya trigger oleh peristiwa berasingan.

**Sekatan pelayar (autoplay policy):** ikut pola bahagian 7 (poin 6) blueprint asal — Board **dan** Admin kedua-duanya perlukan modal **"Tekan untuk Mula"** sebelum audio automatik dibenarkan main. Simpan pilihan dalam `localStorage` supaya tak tanya berulang setiap refresh.

```js
function playSound(id){ // id: 'bantahan' | 'tamat-masa'
  const audioEl = document.getElementById('audio-' + id);
  audioEl.currentTime = 0;
  audioEl.play().catch(e => console.warn('Autoplay disekat, perlu gerak isyarat pengguna dulu:', e));
}
// Elak bunyi berulang untuk rekod SAMA setiap poll — simpan set id yang dah dimainkan
const sudahBunyiBantahan = new Set();
const sudahBunyiTamat = new Set();
```

---

## 7. Panel & Paparan

### 7.1 Board (Papan Awam) — 2 Panel

```
┌──────────────────────────────────────────────┐
│  [Tajuk Acara]            🟢 Segerak: 2s lalu │
│  Tapis Peringkat: [ Semua ] [ SA ] [ A ]      │
├────────────────────────┬──────────────────────┤
│      TIDAK RASMI        │        RASMI         │
│  (scroll berasingan)    │  (scroll berasingan) │
│                          │                      │
│  ┌────────────────────┐ │  ┌──────────────────┐│
│  │ No.1 · SA           │ │  │ No.3 · A       ✅ ││
│  │ Kategori · Nama     │ │  │ Kategori · Nama   ││
│  │ ⏱ 04:32             │ │  └──────────────────┘│
│  │ 🟠 pulse (bantahan)  │ │                      │
│  └────────────────────┘ │                      │
└────────────────────────┴──────────────────────┘
```

- **Panel Tidak Rasmi** — papar rekod `status ∈ {menunggu, countdown}`. Kad countdown papar: No Acara, Nama Acara, Kategori, badge Peringkat (SA/A), timer besar `MM:SS`, pulse **oren** kalau `adaBantahan=true`. Susun ikut masa tinggal paling genting dulu (rujuk pola 6.5 blueprint asal).
- **Panel Rasmi** — papar rekod `status="rasmi"`, **tiada had** (kekal sepanjang hari, senarai makin panjang, scroll sendiri). Kad lebih ringkas (No Acara, Nama, Peringkat, ✅) sebab dah settle, tak perlu elemen countdown.
- **Tapis Peringkat** (Semua/SA/A) — tapis **kedua-dua panel serentak**.
- Modal "Tekan untuk Mula" untuk benarkan audio, disimpan pilihan dalam `localStorage`.
- Indikator sambungan (🟢/🔴) + "Segerak terakhir: Xs lalu" (rujuk pola 7.8 blueprint asal).

### 7.2 Admin — Senarai Satu Lajur

- **Bukan** 2 panel Kanban macam board — satu senarai, dengan **badge status** (Rasmi / Tidak Rasmi) pada setiap baris untuk quick-glance
- Carian tunggal (No Acara / Nama / Kategori) + tapis Peringkat (Semua/SA/A) + tapis Status (Semua/Tidak Rasmi/Rasmi)
- Setiap baris: `No Acara | Kategori | Nama Acara | Peringkat badge | Status badge | Countdown (jika ada) | [Butang aksi ikut status]`
- **Tiada ciri pukal** — semua aksi (Start/Bantahan/Rasmi/Undo) dilakukan **satu-satu** secara manual, demi ketepatan pada konteks keputusan rasmi
- Modal "Tekan untuk Mula" untuk audio, sama macam Board

### 7.3 Setting

- `eventTitle` — tajuk paparan di board
- `adminPassword` — kata laluan admin boleh-ubah
- `durasiSA` (minit) — durasi countdown Separuh Akhir
- `durasiA` (minit) — durasi countdown Akhir
- (Pilihan tambahan boleh dikembangkan kemudian: warna tema, logo, dll — ikut keperluan)

---

## 8. Import CSV — Padam & Ganti Sepenuhnya

Berbeza dari upsert biasa — untuk sistem ni, **setiap kali** admin import CSV baharu:

```js
async function importCSV(fail){
  // 1. Confirm dialog — tindakan ni musnahkan data sedia ada
  const bilanganSedia = Object.keys(await storage.getAllByPrefix(PREFIX+'acara:', true)).length;
  const ok = confirm(`Import akan PADAM semua ${bilanganSedia} acara sedia ada dan gantikan dengan data baharu. Teruskan?`);
  if (!ok) return;

  bulkOperationInProgress = true; // stop auto-refresh/poll semasa proses
  try {
    // 2. Padam SEMUA rekod acara lama (Setting TIDAK disentuh)
    const semua = await storage.getAllByPrefix(PREFIX+'acara:', true);
    for (const key of Object.keys(semua)) await storage.delete(key.replace(PREFIX,''), true);

    // 3. Parse CSV & import rekod baharu
    const hasil = Papa.parse(fail, { header: true, skipEmptyLines: true });
    let baharu = 0, gagal = 0;
    for (const row of hasil.data) {
      const peringkat = parsePeringkat(row['Peringkat']);
      if (!peringkat) { gagal++; continue; } // laporkan sebagai Gagal, jangan default senyap
      const id = uid();
      await storage.set(PREFIX+'acara:'+id, {
        id, noAcara: row['No Acara'], kategori: row['Kategori'],
        namaAcara: row['Nama Acara'], peringkat,
        status: 'menunggu', adaBantahan: false, calledAt: null, durationMin: null
      }, true);
      baharu++;
    }
    alert(`Import selesai: ${baharu} acara berjaya ditambah, ${gagal} gagal (peringkat tak sah).`);
  } finally {
    bulkOperationInProgress = false;
  }
}
```

**Nota:** `No Acara` disimpan pada setiap rekod untuk rujukan/paparan, tapi sejak reupload sentiasa padam-dan-ganti sepenuhnya, ia tidak lagi berfungsi sebagai kunci upsert merentasi sesi import — setiap import CSV bermula dari kosong.

---

## 9. Kata Laluan & Akses Admin dari Board

Kekal pola sedia ada — medan kata laluan pada Board sendiri, klik → buka tab baharu `/admin/`:

```js
const FIXED_PASSWORD = 'kata-laluan-tetap'; // sandaran, tertanam dalam kod
function checkPassword(){
  const val = input.value;
  const configured = settings.adminPassword || '';
  if(val === FIXED_PASSWORD || (configured && val === configured)){
    window.open('/admin/', '_blank'); // tab BAHARU, papar awam tak terganggu
  }
}
```

⚠️ **Had jujur:** kod ini berjalan di pelayar (client-side); kata laluan tetap boleh dibaca sesiapa yang buka "View Page Source". Ini cuma penghadang kemudahan, bukan keselamatan sebenar.

---

## 10. Kod Corak Kritikal (Elak Bug Yang Kita Dah Alami)

### 10.1 Elak XSS — SENTIASA escape teks pengguna sebelum masuk `innerHTML`

```js
function escapeHtml(str){
  if(str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
```
Guna pada **setiap** medan dari input pengguna/CSV (`namaAcara`, `kategori`, `noAcara`) sebelum digabung ke dalam string HTML.

### 10.2 Elak kehilangan data senyap bila rangkaian gagal

```js
async function loadData(){
  try{
    const fresh = await window.storage.getAllByPrefix(PREFIX, true);
    localData = fresh; // HANYA timpa selepas BERJAYA
  }catch(e){
    console.error('Gagal muat, kekalkan data sedia ada:', e);
    // JANGAN localData = [] di sini
  }
}
```

### 10.3 Auto-refresh berhenti semasa operasi pukal

```js
let bulkOperationInProgress = false;
async function loadAndRender(){
  if(bulkOperationInProgress) return; // jangan poll semasa import/padam berjalan
  ...
}
```

### 10.4 Sahkan tindakan padam/tukar dengan MUAT SEMULA dari server

```js
async function deleteItem(id){
  await storage.delete(PREFIX+id, true);
  await loadData();
  const stillExists = localData.some(x => x.id === id);
  if(stillExists) alert('Amaran: masih wujud di server, cuba lagi.');
}
```

### 10.5 Susunan pintar — ikut masa paling genting dulu

```js
list.sort((a,b) => computeRemaining(a) - computeRemaining(b));
```

### 10.6 Prestasi — asingkan render "penuh" (data) dari render "ringan" (countdown/masa)

```js
setInterval(pollData, 3000);            // data sebenar — dari server
setInterval(renderCountdownOnly, 1000); // cuma bahagian countdown + semak bunyi, bukan seluruh senarai
```

---

## 11. Ciri UX Yang Terbukti Berguna

1. **Carian tunggal** yang tapis merentasi medan-medan utama, tanpa perlu tekan butang
2. **Penapis Peringkat** (Semua/SA/A) — dikesan dari nilai sebenar dalam data, dengan bilangan padanan
3. **Butang keadaan satu-klik** untuk semua status yang mungkin — bukan dropdown/menu berperingkat
4. **Confirm dialog** untuk tindakan destructive: Undo Start, Undo Rasmi, Padam Semua/Reupload CSV
5. **Modal "Tekan untuk Mula"** pada Board **dan** Admin untuk benarkan audio automatik; simpan pilihan dalam `localStorage`
6. **Dua bunyi alert berasingan** (Bantahan vs Tamat Masa) supaya pendengar boleh bezakan tanpa tengok skrin
7. **Setiap panel/lajur scroll berasingan** (`max-height` + `overflow-y:auto`) bila senarai boleh jadi panjang
8. **Indikator sambungan** (🟢/🔴) dan **"Segerak terakhir: Xs lalu"**

---

## 12. Responsive/Mobile — Jangan Lupa

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```
**WAJIB** pada setiap fail HTML.

---

## 13. Senarai Semak Sebelum "Selesai"

- [ ] `escapeHtml()` diguna pada SEMUA teks pengguna sebelum masuk `innerHTML`
- [ ] Firebase Rules **tidak** `.read/.write: true` terbuka — guna `auth != null` + Anonymous Auth
- [ ] Setiap rekod acara = kunci Firebase berasingan
- [ ] Kegagalan rangkaian TIDAK mengosongkan data tempatan secara senyap
- [ ] `bulkOperationInProgress` mengunci auto-refresh semasa import/padam berjalan
- [ ] `viewport` meta tag ada pada semua fail HTML (Board/Admin/Setting)
- [ ] CSV import: parser `peringkat` terima SA/A/SF/F/Separuh Akhir/Akhir/Semi-Final/Final (case-insensitive, spacing toleran)
- [ ] CSV import: rekod `peringkat` tak sah dilaporkan sebagai **Gagal**, bukan default senyap
- [ ] Reupload CSV: confirm dialog + padam semua rekod lama sebelum import
- [ ] Confirm dialog untuk Undo Start & Undo Rasmi
- [ ] Auto-transition ke Rasmi disekat bila `adaBantahan=true`, walaupun countdown dah 0
- [ ] Toggle Bantahan OFF memicu semakan auto-transition serta-merta (bukan tunggu poll seterusnya)
- [ ] Dua bunyi (`bantahan.mp3`, `tamat-masa.mp3`) dimainkan di Board **dan** Admin, tak berulang untuk rekod sama
- [ ] Modal "Tekan untuk Mula" wujud di Board & Admin sebelum audio automatik dibenarkan
- [ ] Setiap panel senarai panjang ada scroll sendiri
- [ ] Fail `firebase-config.js` berasingan dari fail lain semasa deploy berulang

---

## 14. Untuk Aplikasi Baharu — Apa Nak Sesuaikan

1. **Status/lajur** — tentukan status apa yang relevan untuk domain baharu
2. **Medan data** setiap rekod — buang/tambah ikut keperluan
3. **Logik countdown/masa** (kalau relevan) — durasi tetap atau boleh-ubah dari Setting
4. **Flag tambahan** (macam `adaBantahan`) — kalau domain baharu perlukan "penanda" berasingan dari status utama
5. **Bunyi/alert** — berapa jenis peristiwa perlukan bunyi berbeza
6. **Warna & identiti visual** — tema warna, fon, logo ikut keperluan jenama baharu

Struktur asas (3 skrin, Firebase, per-rekod storan, corak keselamatan/kebolehpercayaan) **kekal sama** tak kira domain aplikasi.
