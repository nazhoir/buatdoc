# buatdoc

BuatDoc is a lightweight DOCX template engine built for Node and browser (React), with:
- text variable replacement (`{{name}}`), modifiers, conditionals, loops
- image insertion and replacement
- Word template-based output (DOCX ZIP patching)

---

## 1. Instalasi

```bash
npm install
# atau pnpm install
```

Pastikan project ini di-clone lalu paket terinstal.

---

## 2. Struktur penting

- `src/core/DocxEngine.ts` - engine manipulasi DOCX (image insert/replace, XML patching)
- `src/core/TemplateEngine.ts` - parser/renderer template (conditional, loop, modifier)
- `src/services/DocumentService.ts` - API publik `generate()`
- `examples/expressjs/node-express.ts` - contoh server Express
- `examples/reactjs/browser-react.tsx` - contoh browser (Vite + React)
- `templates/demo.docx` - template demo siap pakai

---

## 3. Aturan image-insert & replace

### 3.1 Insert gambar baru (theta)
Gunakan placeholder tekstual di DOCX sebagai `{{%imageVar}}` atau `{{%%imageVar}}`:
- `{{%imageVar}}` = inline image (insert di run itu)
- `{{%%imageVar}}` = block image (plan: logic serupa, bisa digunakan untuk posisi floating)

Contoh di dokumen Word:

```
{{%profile_image}}
```

Data JSON:

```ts
profile_image: {
  type: 'image',
  source: 'https://example.com/avatar.png',
  width: 120,
  height: 120,
  mimeType: 'image/png',
  altText: 'User avatar',
}
```

### 3.2 Replace gambar existing (ALT text variable)
Jika dokumen berisi gambar dengan ALT `{{logo_image}}`, engine akan:
1. Temukan `wp:docPr name="{{logo_image}}"` / `descr="{{logo_image}}"`
2. Ambil relId `rIdX` dari `<a:blip r:embed="..."/>`
3. Update data gambar dan rel (sama relId)
4. Save image di `word/media/...`
5. Finalize attributes `name` & `descr` menjadi `logo_image` (atau altText custom)

Template DOCX:

```xml
<wp:docPr id="1" name="{{logo_image}}" descr="{{logo_image}}"/>
```

Data JSON:

```ts
logo_image: {
  type: 'image',
  source: 'https://example.com/logo.png',
  width: 180,
  height: 60,
  mimeType: 'image/png',
}
```

Jika placeholder ALT tidak valid, engine akan fallback jadi `logo_image`.

---

## 4. Contoh implementasi

### 4.1 Node sederhana

`debug.ts`:

```ts
import { DocumentService } from './src/services/DocumentService';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const service = new DocumentService();
  const templatePath = path.resolve(__dirname, 'templates', 'demo.docx');
  const template = await service.loadTemplateFromFile(templatePath);

  const data = {
    nama: 'Andika Putra',
    judul: 'belajar typescript dengan buatdoc',
    tanggal: '2026-04-03',
    isPremium: true,
    perusahaan: {
      nama: 'PT. Teknologi Maju',
      alamat: 'Jl. Sudirman No. 1, Jakarta',
      logo: {
        type: 'image',
        source: 'https://dummyimage.com/150x50/ffffff/000000.png&text=Logo',
        width: 150,
        height: 50,
        mimeType: 'image/png',
      },
    },
    profile_image: {
      type: 'image',
      source: 'https://dummyimage.com/200x200/ffffff/000000.png&text=Profile',
      width: 200,
      height: 200,
      mimeType: 'image/png',
    },
    logo_image: {
      type: 'image',
      source: 'https://dummyimage.com/150x50/ffffff/00509B.png&text=Logo',
      width: 150,
      height: 50,
      mimeType: 'image/png',
    },
  };

  const output = await service.generate(template, data);
  await service.saveToFile(output, path.resolve(__dirname, 'hasil-buatdoc.docx'));
  console.log('Selesai: hasil-buatdoc.docx');
}

main().catch(console.error);
```

### 4.2 Express API

`examples/expressjs/node-express.ts` sudah tersedia; jalankan:

```bash
cd examples/expressjs
npm install
npx ts-node node-express.ts
```

Request:

```bash
curl -X GET http://localhost:3000/generate/demo --output output.docx
```

### 4.3 React + Vite

```bash
cd examples/reactjs
npm install
npm run dev
```

Buka URL yang muncul; contoh sudah menyertakan template jenis insert + replace.

---

## 5. Debugging

1. Ekstrak output docx:
   ```bash
   unzip output.docx -d ./tmp
   ```
2. Cek `word/document.xml` dan `word/_rels/document.xml.rels`.
3. Pastikan setiap `rId` di `<a:blip r:embed="..."/>` ada di rels.
4. Pastikan `Content_Types` ada `Default Extension="png"` atau `jpg`.

---

## 6. Catatan khusus

- Jangan gunakan `{{logo_image}}` untuk insert muka; gunakan `{{%logo_image}}` atau `{{%%logo_image}}`.
- Gambar dengan ALT `{{logo_image}}` adalah _replace_ mode.
- Engine mempertahankan template jika variable bukan `image`/placeholder.

---

## 7. Testing

`npm test` menjalankan Jest.
- `imageHandling.test.ts` memverifikasi image util + engine
- `TemplateEngine` masih diketahui pakai 5 fail (issue parsing nesting) dan terpisah.

---

## 8. Kontribusi

1. Fork repo
2. buat branch fitur (`fix-image-workflow`)
3. buat PR dengan unit test agar `imageHandling` tidak regresi

Selamat mencoba!