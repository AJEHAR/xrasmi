# Keputusan Tak Rasmi — Papan Keputusan Acara

Sistem 3-skrin masa-nyata (Board / Admin / Setting) guna Firebase Realtime Database + GitHub Pages, tanpa server sendiri. Rujuk `BLUEPRINT.md` untuk spesifikasi teknikal penuh & rasional reka bentuk.

---

## 1. Struktur Fail

```
├── index.html              ← Board (papan awam, 2 panel: Tidak Rasmi / Rasmi)
├── admin/index.html        ← Panel Admin (senarai + aksi status + import CSV)
├── setting/index.html      ← Setting (tajuk, durasi countdown, kata laluan)
├── firebase-config.js      ← Kredential Firebase (WAJIB diisi — lihat langkah 2)
├── storage.js              ← Lapisan storan (wrapper Firebase)
├── assets/
│   ├── common.js           ← Logik kongsi (parsing peringkat, format masa, dll)
│   └── style.css            ← Reka bentuk & tema
├── sounds/
│   ├── bantahan.mp3        ← WAJIB tambah sendiri (lihat sounds/BACA-SAYA.txt)
│   └── tamat-masa.mp3      ← WAJIB tambah sendiri
├── templat-data.csv        ← Contoh fail untuk import
├── CNAME                    ← Domain custom (xrasmi.syazr.com) untuk GitHub Pages
└── BLUEPRINT.md
```

---

## 2. Setup Firebase (Wajib Sebelum Guna)

1. Pergi ke [Firebase Console](https://console.firebase.google.com) → **Create a project**.
2. **Build → Realtime Database → Create Database** — pilih lokasi (cadangan: Singapore `asia-southeast1` untuk latensi rendah di Malaysia).
3. **Build → Authentication → Sign-in method → Anonymous → Enable.**
4. **Project Settings (⚙) → Your apps → Web app (</>) → Register app** — salin nilai `firebaseConfig` yang diberikan.
5. Tampal nilai tersebut ke dalam `firebase-config.js` (gantikan semua placeholder `GANTI_DENGAN_...`).
6. **Realtime Database → Rules** — tampal & Publish:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

⚠️ **Jangan** guna `.read/.write: true` (terbuka sepenuhnya) — ini benarkan sesiapa baca/tulis/padam data tanpa auth langsung.

---

## 3. Deploy ke GitHub Pages (Domain: `xrasmi.syazr.com`)

1. Cipta repo GitHub baharu, push semua fail dalam folder ini ke branch `main` (fail `CNAME` yang mengandungi `xrasmi.syazr.com` sudah disertakan — **jangan padam**).
2. **Settings → Pages → Source** → pilih branch `main`, folder `/ (root)`.
3. **Tetapan DNS** — di pembekal domain `syazr.com` awak (contoh: Cloudflare, Namecheap, dsb), tambah rekod berikut:

   | Jenis | Nama (Host) | Nilai (Points to) |
   |---|---|---|
   | `CNAME` | `xrasmi` | `<username-github>.github.io` |

   *(Gantikan `<username-github>` dengan nama pengguna/organisasi GitHub awak. Kalau guna Cloudflare, set rekod ni ke mod "DNS only" — bukan "Proxied" — semasa setup awal, supaya GitHub boleh sahkan pemilikan domain dahulu.)*
4. Balik ke **Settings → Pages** di GitHub → masukkan `xrasmi.syazr.com` dalam ruangan **Custom domain** → Save. Tunggu tanda ✅ "DNS check successful" (boleh ambil masa sehingga 24 jam untuk propagasi DNS).
5. Aktifkan **Enforce HTTPS** (muncul selepas DNS disahkan) supaya semua 3 skrin diakses melalui `https://`.

### Link 3 skrin (selepas deploy siap)

| Skrin | URL |
|---|---|
| **Board** (paparan awam/TV) | `https://xrasmi.syazr.com/` |
| **Admin** (panel kawalan) | `https://xrasmi.syazr.com/admin/` |
| **Setting** (konfigurasi) | `https://xrasmi.syazr.com/setting/` |

Ketiga-tiga URL ni **boleh dikongsi/bookmark terus** — semuanya di bawah domain sama, tiada perlu setup DNS berasingan untuk setiap skrin.

**Nota path:** Semua fail HTML guna path **relatif** (`assets/...`, `../assets/...`), jadi sistem tetap berfungsi walaupun awak tukar/buang domain custom kemudian (contoh: kembali guna `https://<username>.github.io/<nama-repo>/` sahaja).

---

## 4. Tambah Bunyi Alert

Letakkan `bantahan.mp3` dan `tamat-masa.mp3` di dalam folder `sounds/`. Rujuk `sounds/BACA-SAYA.txt` untuk butiran (nama fail mesti tepat).

---

## 5. Mula Guna

1. Buka `/setting/` (kata laluan sandaran default: `ktr-admin-2026` — **TUKAR** ini dalam `assets/common.js`, pembolehubah `FIXED_PASSWORD`, sebelum deploy sebenar).
2. Isi **Tajuk Acara**, **Durasi Countdown SA/A**, (pilihan) **Link Keputusan** (buka dalam tab baharu bila butang "Keputusan ↗" pada mana-mana kad ditekan — SATU link sahaja untuk semua acara, kosongkan untuk sembunyikan butang), dan (pilihan) **Kata Laluan Admin** custom.
3. Ke `/admin/` → klik **Import CSV** → pilih fail ikut format `templat-data.csv` (header: `No Acara, Kategori, Nama Acara, Peringkat/Pusingan, Hari` — fleksibel, terima `snake_case` & alias, column asing seperti `status`/`bilik`/`catatan` automatik diabaikan, order column tak penting).
   - Setiap import **memadam semua rekod sedia ada** dan menggantikannya sepenuhnya (ada confirm dialog).
   - Nilai `Peringkat` terima: `SA`, `A`, `SF`, `F`, `Separuh Akhir`, `Akhir`, `Semi-Final`, `Final` (case-insensitive).
4. Buka `/` (Board) pada skrin TV/projektor — klik **"Mula & Benarkan Bunyi"** sekali untuk aktifkan audio.
5. Di Admin, klik **Start** pada acara untuk mulakan countdown (nampak di Board, panel Tidak Rasmi).

---

## 6. Aliran Status Ringkas

```
Menunggu --[Start]--> Countdown --[auto bila 0, TIADA bantahan]--> Rasmi
                          |  ↑
                    [Bantahan: toggle ON/OFF, pulse oren, sekat auto-transition]
                          |
                    [Rasmi: override manual, keluar dari freeze bantahan]
```

- Semua butang (Start / Rasmi) ada versi **Undo** dengan confirm dialog.
- Undo Start → reset penuh ke Menunggu (termasuk clear flag Bantahan).
- Undo Rasmi → balik ke Countdown, `calledAt`/`durationMin` **kekal** (bukan restart timer).
- Dua bunyi berasingan: 🟠 Bantahan (bila diaktifkan) dan 🔴 Tamat Masa (bila countdown sampai 0) — dimainkan di Board **dan** Admin.

---

## 7. Keselamatan — Had Jujur (Disahkan Melalui Audit)

**Aliran akses:** Kata laluan **cuma diminta SEKALI** di Board (butang "⚙" → buka `/admin/` dalam tab baharu). Selepas itu, `/admin/` dan `/setting/` **tidak minta kata laluan lagi** — pergerakan antara Admin ↔ Setting bebas tanpa gangguan berulang. **Nota:** ini bermakna sesiapa yang navigate TERUS ke URL `/admin/` atau `/setting/` (tanpa melalui Board dahulu) akan terus masuk **tanpa** diminta kata laluan langsung — reka bentuk ni sengaja dipermudahkan atas permintaan, memandangkan (macam di bawah) kata laluan pun bukan sekatan data sebenar.

Kata laluan Admin adalah **peringkat UI sahaja** — ia sekat paparan `/admin/` dan `/setting/`, **BUKAN** sekat capaian data Firebase sebenar.

**Sahkan sendiri risiko ni:** Buka Board (`/`), tekan `F12` → tab **Console**, taip:
```js
firebase.database().ref('shared/ktr:settings').once('value').then(s => console.log(s.val()))
```
Ini akan papar `adminPassword` awak dalam teks biasa — **tanpa** perlu buka `/admin/` atau tahu kata laluan. Sesiapa yang celik teknikal juga boleh terus baca/tulis/padam semua rekod acara dengan cara sama.

**Sebab:** rekod Firebase Rules (`auth != null`) + Anonymous Authentication automatik bermakna **SESIAPA** yang buka mana-mana skrin (termasuk Board awam) dapat token `auth != null` serta-merta — jadi rules ni benarkan baca/tulis **penuh** kepada sesiapa sahaja, bukan admin sahaja.

**Sesuai untuk:** acara tertutup/kecil dengan audiens tak teknikal, risiko rendah.

**Jika perlu keselamatan sebenar** (audiens besar/awam, data sensitif): tukar dari Anonymous Auth kepada **Firebase Auth Email/Password** untuk Admin sahaja — Board kekal baca-sahaja untuk sesiapa, tapi **tulis** (`write`) cuma dibenarkan untuk akaun admin yang log masuk sebenar (bukan anonymous). Ini percuma di Firebase, tapi ubah cara Admin log masuk (borang emel+kata laluan sebenar, bukan 1 kata laluan dikongsi). Hubungi pembangun sistem ni untuk laksanakan peningkatan ni jika diperlukan.

### Bug lain yang telah dibaiki (hasil audit)

- ✅ Butang **Rasmi** (override manual semasa bantahan aktif) kini clear flag `adaBantahan` — elak rekod "rasmi" tersimpan dengan bantahan hantu yang muncul semula bila di-Undo
- ✅ **Link Keputusan** disahkan mesti bermula `http://`/`https://` — elak suntikan `javascript:` yang boleh jalankan kod berbahaya pada peranti SEMUA orang yang klik butang tu
- ✅ Parsing header CSV kini toleran casing/spacing (`"no acara"` = `"No Acara"` = `" No Acara "`), bukan cuma nilai `Peringkat`
- ✅ **Mesej status Setting** tak lagi papar warna merah selepas 1x gagal — reset ke warna default bila berjaya
- ✅ **Panel Rasmi susun ikut masa DISAHKAN sebenar** (`rasmiAt`) — bukan masa Start ditekan; acara yang lama dalam Bantahan sebelum disahkan takkan tersorok bawah lagi
- ✅ **Elak "flicker" di TV** — Board & Admin cuma render semula DOM penuh bila data BENAR-BENAR berubah (bandingkan snapshot), bukan setiap 3 saat poll — animation pulse-bantahan tak lagi "gagap"
- ✅ **Import CSV dipercepatkan** — padam & tulis rekod kini SELARI (`Promise.allSettled`), bukan satu-satu — import 100+ acara jauh lebih laju
- ✅ Toast Bantahan kini terus nyatakan kalau ia menyebabkan **auto-lulus ke Rasmi serta-merta** (elak admin keliru status berubah dua kali)
- ✅ **[Kritikal] Import CSV kini sahkan fail DULU sebelum padam data lama** — kalau CSV rosak/format salah (0 baris sah), import DIBATALKAN dan data sedia ada KEKAL selamat (dulu: data lama terus dipadam walaupun CSV baharu tak sah, tiada cara undo)
- ✅ Import CSV kini beri amaran kalau ada **No Acara berulang** dalam fail sama
- ✅ Import CSV kini ada **had saiz fail (2MB)** — elak fail salah/rosak besar tersilap upload
- ✅ **[Ciri baharu] Butang Edit (✎)** pada setiap kad — betulkan No Acara/Kategori/Nama Acara/Peringkat SATU rekod tanpa perlu re-upload CSV penuh (yang akan reset status SEMUA acara lain)
- ✅ **[Kritikal — audio]** Bunyi Bantahan/Tamat Masa **senyap pada kitaran kedua** kalau rekod di-Undo Start lepas tu di-Start semula (penanda "dah main" tak pernah cleanup). Dibaiki dengan kesan perubahan `calledAt` (= kitaran countdown baharu) untuk reset penanda bunyi secara automatik
- ✅ **[Kritikal — race condition]** Semua operasi ubah status/rekod (Start/Bantahan/Rasmi/Undo/Edit/auto-transition) kini guna **Firebase Transaction** (baca-ubah-tulis atomic dgn auto-retry), bukan baca-cache-tulis-terus. Ni selesaikan senario BAHAYA: kalau admin tekan Bantahan ON **tepat pada masa sama** countdown sampai 00:00, cara LAMA akan overwrite/hilangkan bantahan tu secara senyap (acara tersalah auto-sah Rasmi walaupun ada bantahan aktif). Disahkan dgn simulasi konkrit — cara baharu betul-betul batalkan auto-transition bila bantahan dikesan semasa transaction, cara lama gagal
- ✅ **34 unit test + simulasi automatik** dijalankan ke atas semua fungsi teras, logik validasi CSV, logik bunyi, dan race condition — semua lulus

- ✅ **[Robustness]** Semua operasi Firebase (get/set/delete/transaction) kini ada **had masa 10 saat** + mesej ralat SEBENAR dipaparkan (bukan senyap) — termasuk amaran automatik kalau `firebase-config.js` masih placeholder, dan mesej jelas kalau Anonymous Auth belum di-enable

---

## 8. Troubleshooting — "Save Tiada Respon" / Data Hilang Selepas Refresh

Kalau butang **Simpan** (Setting) atau mana-mana aksi (Start/Bantahan/dsb di Admin) tak bagi respon:

1. **Buka DevTools browser** (`F12` atau klik-kanan → Inspect) → tab **Console**. Sejak kemas kini terkini, sistem akan papar mesej ralat JELAS di sini kalau apa-apa gagal (dulu senyap, sekarang tak).
2. **Semak `firebase-config.js`** — pastikan TIADA nilai `GANTI_DENGAN_...` tertinggal (console akan beri amaran automatik kalau masih ada).
3. **Semak Firebase Console → Authentication → Sign-in method → Anonymous** — mesti **Enable**. Ini punca PALING BIASA untuk "tiada respon" — kalau belum enable, sistem sekarang akan papar mesej jelas: *"Gagal simpan: auth/operation-not-allowed..."*.
4. **Semak Firebase Console → Realtime Database → Rules** — mesti `{"rules": {".read": "auth != null", ".write": "auth != null"}}` (bukan `false` atau kosong).
5. **Cuba hard refresh** (`Ctrl+Shift+R` / `Cmd+Shift+R`) — elak browser guna fail JS/CSS lama yang tersimpan dalam cache, terutama selepas re-deploy fail baharu.
6. **Pastikan GitHub Pages dah selesai deploy versi TERKINI** — semak tab "Actions" di repo GitHub untuk pastikan build terakhir berjaya & guna fail paling baharu.
7. Sejak kemas kini terkini, semua operasi Firebase ada **had masa 10 saat** — kalau betul-betul "hang" (bukan ralat serta-merta), sistem akan papar mesej timeout selepas 10 saat, bukan senyap selamanya.
