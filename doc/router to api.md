# aturan tambahan
gunakan wraper 
/**
 * @typedef {Object} DBValue
 * @property {string} Status
 * @property {boolean} is_err
 * @property {Object[]} data
 */
/**
 * @returns {DBValue}
 */
export function createSuccsesReturn(data)
/**
 * @returns {DBValue}
 */
export function createFailedReturn(status,data=[])
di common_type.js
untuk mengembalikan data yang diminta
# aturan fungsi get${nama data ex:Sawah}()
## parameter
(page:number|undefined|null,size:number|undefined|null,search:string|undefined|null)
## return
  memiliki return data object berupa array of object
  ex:
  ```
  [
    {
    id:"769",
    nama:"A",
    luas:12
    },
    {
    id:"769",
    nama:"b",
    luas:12
    }
  ]
  ```
  ## perilaku yang diharapkan
  - jika page undefined atau null maka di set ke 0
  - jika size undefined atau null maka ambil seluruh data
  - page hanya memberikan indeks sedangkan size menentukan besar
  data perhalaman
# aturan fungsi post${nama data}()
tujuan menambah data baru
## parameter
(data:object{id:string|null|undefined,...})
## return
id yang conflict
\[ids:string\] : array of string
## prilaku yang diharapkan
- jika id tidak ada atau null maka data baru
 akan dibuat dengan id yang dibuat baru oleh db
 ataupun manual dari server
# aturan fungsi put${nama data}()
tujuan update data
## parameter
(data:object{id:string|null|undefined,...})
## return
id yang tidak ada
\[ids:string\] : array of string
## prilaku yang diharapkan
- jika id tidak ada,null, ataupun undefined maka data
  tidak digunakan
# aturan fungsi del${nama data}()
tujuan menghapus element
## parameter
(ids:string[])
## return
missing_id:string[]
## prilaku yang diharapkan
- jika id tidak di temukan di kembalikan dalam
  bentuk array berupa kumpulan id yang tidak
  ditemukan
- ~~jika terdapat id yang me-reference ke id yang di hapus
  maka data tersebut ikut terhapus~~ keputusan terhapus kembalikan ke database