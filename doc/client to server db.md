# Dokumentasi Endpoint API & Komunikasi Data

Dokumentasi ini mengikuti implementasi endpoint `wilayah.js`.

## Format Respon Standar

Semua respon dari endpoint menggunakan struktur berikut:

```json
{
  "status": "keterangan",
  "is_err": false,
  "data": []
}
```

- `status` (`string`): keterangan hasil operasi, misalnya `"ok"`, `"not found"`, atau `"bad format"`.
- `is_err` (`boolean`): `true` jika terjadi kesalahan dan `false` jika operasi berhasil atau menghasilkan kondisi non-error.
- `data` (`object[]`): selalu berupa array. Isinya bergantung pada endpoint dan hasil operasi; dapat berupa daftar objek, daftar ID, atau array kosong.

Catatan: implementasi menggunakan nama properti `status` dengan huruf kecil, bukan `Status`.

## Autentikasi Sesi

Endpoint `POST`, `PUT`, dan `DELETE` menggunakan middleware `extendSesion`, sehingga wajib menyertakan header:

```http
X-Sesion-ID: <sessionId>
```

Nilai sesi diperoleh dari proses *Login*. Endpoint `GET` pada implementasi ini tidak menggunakan middleware sesi.

---

## 1. GET — Mengambil Data

Mengambil daftar wilayah dengan dukungan pagination dan pencarian.

- **Method:** `GET`
- **URL:** `/api/wilayah`
- **Query parameters:**
  - `page` (`number`, opsional): indeks halaman, dimulai dari `0`. Jika tidak dikirim, nilainya `0`.
  - `size` (`number`, opsional): jumlah data per halaman. Jika tidak dikirim, seluruh data diambil.
  - `search` (`string`, opsional): kata kunci pencarian pada kolom `id` dan `nama`.

### Respon

**Sukses — `200 OK`**

`data` berisi array objek wilayah.

```json
{
  "status": "ok",
  "is_err": false,
  "data": [
    {
      "id": "12",
      "nama": "Wilayah Utara"
    }
  ]
}
```

**Data tidak ditemukan — `404 Not Found`**

```json
{
  "status": "not found",
  "is_err": false,
  "data": []
}
```

**Pagination tidak valid — `400 Bad Request`**

Dikirim jika `page` atau `size` bukan bilangan bulat aman atau bernilai negatif.

```json
{
  "status": "bad pagination",
  "is_err": true,
  "data": []
}
```

**Database belum diinisialisasi atau tidak tersedia — `503 Service Unavailable`**

Contoh status: `"db isnt initialize yet"` atau `"db isnt availabel"`.

```json
{
  "status": "db isnt initialize yet",
  "is_err": true,
  "data": []
}
```

**Kesalahan internal — `500 Internal Server Error`**

Jika fungsi API mengembalikan `is_err: true`, objek hasil tersebut diteruskan sebagai respon.

Jika bentuk `result.data` bukan array, server mengirim:

```json
{
  "status": "invalid API response",
  "is_err": true,
  "data": []
}
```

### Contoh `fetch`

```js
const response = await fetch(
  "http://192.168.1.10:3000/api/wilayah?page=0&size=10&search=utara"
);

const result = await response.json();

console.log(response.status, result.status, result.is_err, result.data);
```

---

## 2. POST — Menambahkan Wilayah

Menambahkan satu data wilayah.

- **Method:** `POST`
- **URL:** `/api/wilayah`
- **Headers:**
  - `Content-Type: application/json`
  - `X-Sesion-ID: <sessionId>`
- **Request body:** satu objek data, bukan array.

```json
{
  "id": null,
  "nama": "Wilayah Baru"
}
```

### Respon

**Berhasil — `201 Created`**

```json
{
  "status": "ok",
  "is_err": false,
  "data": []
}
```

**Format salah — `400 Bad Request`**

Dikirim jika body bukan objek data tunggal (misalnya array, `null`, atau nilai primitif).

```json
{
  "status": "bad format",
  "is_err": true,
  "data": []
}
```

**Konflik ID — `409 Conflict`**

`data` berisi ID yang mengalami konflik.

```json
{
  "status": "conflict",
  "is_err": false,
  "data": ["id_konflik_1"]
}
```

**Database tidak tersedia — `503 Service Unavailable`**

Menggunakan format standar dengan `is_err: true` dan `data: []`.

**Kesalahan internal — `500 Internal Server Error`**

Jika fungsi API mengembalikan `is_err: true`, hasil tersebut diteruskan sebagai respon.

### Contoh `fetch`

```js
const response = await fetch("http://192.168.1.10:3000/api/wilayah", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Sesion-ID": "1f4d6a86791267"
  },
  body: JSON.stringify({
    nama: "Wilayah Baru"
  })
});

const result = await response.json();
console.log(response.status, result);
```

---

## 3. PUT — Memperbarui Wilayah

Memperbarui satu data wilayah.

- **Method:** `PUT`
- **URL:** `/api/wilayah`
- **Headers:**
  - `Content-Type: application/json`
  - `X-Sesion-ID: <sessionId>`
- **Request body:** satu objek data yang memuat `id` dan properti yang akan diperbarui.

```json
{
  "id": "12",
  "nama": "Wilayah Utara Baru"
}
```

### Respon

**Berhasil — `200 OK`**

```json
{
  "status": "ok",
  "is_err": false,
  "data": []
}
```

**Format salah — `400 Bad Request`**

Dikirim jika body bukan objek data tunggal.

```json
{
  "status": "bad format",
  "is_err": true,
  "data": []
}
```

**ID tidak ditemukan — `404 Not Found`**

`data` berisi ID yang tidak ditemukan.

```json
{
  "status": "not found",
  "is_err": false,
  "data": ["id_yang_tidak_ada"]
}
```

**Database tidak tersedia — `503 Service Unavailable`**

Menggunakan format standar dengan `is_err: true` dan `data: []`.

**Kesalahan internal — `500 Internal Server Error`**

Jika fungsi API mengembalikan `is_err: true`, hasil tersebut diteruskan sebagai respon.

### Contoh `fetch`

```js
const response = await fetch("http://192.168.1.10:3000/api/wilayah", {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    "X-Sesion-ID": "1f4d6a86791267"
  },
  body: JSON.stringify({
    id: "12",
    nama: "Wilayah Utara Baru"
  })
});

const result = await response.json();
console.log(response.status, result);
```

---

## 4. DELETE — Menghapus Wilayah

Menghapus data wilayah berdasarkan kumpulan ID.

- **Method:** `DELETE`
- **URL:** `/api/wilayah`
- **Headers:**
  - `Content-Type: application/json`
  - `X-Sesion-ID: <sessionId>`
- **Request body:** array berisi string ID.

```json
[
  "12",
  "13"
]
```

### Respon

**Berhasil — `200 OK`**

```json
{
  "status": "ok",
  "is_err": false,
  "data": []
}
```

**Format salah — `400 Bad Request`**

Dikirim jika body bukan array yang seluruh elemennya bertipe string.

```json
{
  "status": "bad format",
  "is_err": true,
  "data": []
}
```

**ID tidak ditemukan — `404 Not Found`**

`data` berisi ID yang tidak ditemukan.

```json
{
  "status": "not found",
  "is_err": false,
  "data": ["13"]
}
```

**Database tidak tersedia — `503 Service Unavailable`**

Menggunakan format standar dengan `is_err: true` dan `data: []`.

**Kesalahan internal — `500 Internal Server Error`**

Jika fungsi API mengembalikan `is_err: true`, hasil tersebut diteruskan sebagai respon.

### Contoh `fetch`

```js
const response = await fetch("http://192.168.1.10:3000/api/wilayah", {
  method: "DELETE",
  headers: {
    "Content-Type": "application/json",
    "X-Sesion-ID": "1f4d6a86791267"
  },
  body: JSON.stringify(["12", "13"])
});

const result = await response.json();
console.log(response.status, result);
```

---

## Catatan Implementasi

- `POST` dan `PUT` menerima **satu objek**, bukan array objek.
- `DELETE` menerima **array string ID**, bukan array objek dengan properti `id`.
- `GET` mencari berdasarkan kolom `id` dan `nama`.
- Pada respon `"not found"` dan `"conflict"`, `is_err` bernilai `false`; kondisi tersebut dilaporkan melalui HTTP status dan nilai `status`.
- `status` adalah string dan `data` selalu array pada respon yang dibentuk langsung oleh handler.
- Ejaan nilai status di atas mengikuti implementasi saat ini, termasuk `"availabel"` pada pesan database tidak tersedia.
