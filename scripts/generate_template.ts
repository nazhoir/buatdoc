/**
 * generate_template.ts
 *
 * Membuat file demo.docx yang menjadi template demo untuk buatdoc.
 * Template ini mendemonstrasikan SEMUA fitur engine:
 *
 *  ① Variabel teks + modifier (_upper, _lower, _sentence_case, dll.)
 *  ② Default value  ({{var|default}})
 *  ③ Nested path    ({{user.name}})
 *  ④ Kondisional #  ({{#isPremium}}...{{/isPremium}})
 *  ⑤ Kondisional ^  ({{^isFreeUser}}...{{/isFreeUser}})
 *  ⑥ Kondisional ?  ({{?adminAccess}}...{{/adminAccess}})
 *  ⑦ Row-Loop tabel ({{#items}} di marker-row → engine ulang data-row)
 *  ⑧ Image insert   ({{profile_image}} teks → ImageConfig)
 *
 * ===========================================================================
 * ‼ PENTING — Cara kerja Row-Loop:
 *
 *  Struktur tabel HARUS 3 baris:
 *    Baris 1 → "marker open":  sel PERTAMA = {{#items}},  sel lain kosong
 *    Baris 2 → "data row":     sel berisi {{produk}}, {{qty}}, {{harga}}
 *    Baris 3 → "marker close": sel PERTAMA = {{/items}}, sel lain kosong
 *
 *  Engine akan:
 *    • Hapus marker open row
 *    • Ulang data row sebanyak item.length
 *    • Hapus marker close row
 * ===========================================================================
 */

import * as fs   from 'fs';
import * as path from 'path';
import {
  Document, Packer, Paragraph, TextRun,
  Table, TableRow, TableCell,
  HeadingLevel, AlignmentType,
  WidthType, VerticalAlign,
} from 'docx';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Buat TableCell sederhana dengan satu paragraf teks */
function cell(text: string, align?: (typeof AlignmentType)[keyof typeof AlignmentType]): TableCell {
  return new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text })],
      }),
    ],
  });
}

/** Header cell dengan bold */
function headerCell(text: string): TableCell {
  return new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true })],
      }),
    ],
  });
}

// ── Document ─────────────────────────────────────────────────────────────────

const doc = new Document({
  styles: {
    paragraphStyles: [
      {
        id: 'Normal', name: 'Normal', basedOn: 'Normal', next: 'Normal',
        run: { size: 24, font: 'Calibri', color: '333333' },
        paragraph: { spacing: { after: 120, line: 276 } },
      },
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal',
        run: { size: 28, bold: true, color: '00509B' },
        paragraph: { spacing: { before: 240, after: 120 } },
      },
      {
        id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal',
        run: { size: 44, bold: true, color: '1A1A1A' },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 360 } },
      },
    ],
  },
  sections: [
    {
      properties: {},
      children: [

        // ──────────────────────────────────────────────────────────────────
        // TITLE
        // ──────────────────────────────────────────────────────────────────
        new Paragraph({ text: 'BuatDoc Demo Template', heading: HeadingLevel.TITLE }),

        // ──────────────────────────────────────────────────────────────────
        // ① Variabel & Modifier
        // ──────────────────────────────────────────────────────────────────
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('1. Variabel & Modifier Teks')] }),

        new Paragraph({ children: [new TextRun({ text: 'Kepada: ', bold: true }), new TextRun('{{nama}}')] }),
        new Paragraph({ children: [new TextRun({ text: 'UPPERCASE: ', bold: true }), new TextRun('{{judul_upper}}')] }),
        new Paragraph({ children: [new TextRun({ text: 'Sentence case: ', bold: true }), new TextRun('{{judul_sentence_case}}')] }),
        new Paragraph({ children: [new TextRun({ text: 'Tanggal: ', bold: true }), new TextRun('{{tanggal}}')] }),
        new Paragraph({ children: [new TextRun({ text: 'Perusahaan: ', bold: true }), new TextRun('{{perusahaan.nama}}')] }),
        new Paragraph({ children: [new TextRun({ text: 'Alamat: ', bold: true }), new TextRun('{{perusahaan.alamat}}')] }),
        new Paragraph({ children: [new TextRun({ text: 'Nama atas (capitalize): ', bold: true }), new TextRun('{{nama_capitalize_each_word}}')] }),
        new Paragraph({ children: [new TextRun({ text: 'Default value (kosong): ', bold: true }), new TextRun('{{tidakAda|Nilai Default}}')] }),

        // ──────────────────────────────────────────────────────────────────
        // ② Kondisional
        // ──────────────────────────────────────────────────────────────────
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('2. Kondisional')] }),

        new Paragraph('Blok # (render jika nilai truthy):'),
        new Paragraph('{{#isPremium}}\u2b50 Status: User Premium Aktif{{/isPremium}}'),
        new Paragraph(''),

        new Paragraph('Blok ^ (render jika kosong / falsy):'),
        new Paragraph('{{^isFreeUser}}\u2705 Bukan pengguna gratis.{{/isFreeUser}}'),
        new Paragraph(''),

        new Paragraph('Blok ? (alias # — render jika truthy):'),
        new Paragraph('{{?adminAccess}}\uD83D\uDD10 Akses Administrator Aktif{{/adminAccess}}'),

        // ──────────────────────────────────────────────────────────────────
        // ③ Row-Loop Tabel
        //    Struktur WAJIB: marker-open row | data row | marker-close row
        // ──────────────────────────────────────────────────────────────────
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('3. Loop Tabel (Row-Loop)')] }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [

            // ── Header row ────────────────────────────────────────────────
            new TableRow({
              tableHeader: true,
              children: [
                headerCell('Nama Produk'),
                headerCell('Qty'),
                headerCell('Harga (Rp)'),
              ],
            }),

            // ── MARKER ROW OPEN: sel pertama = {{#items}}, lain kosong ───
            new TableRow({
              children: [
                cell('{{#items}}'),  // ← WAJIB di sel pertama
                cell(''),
                cell(''),
              ],
            }),

            // ── DATA ROW: baris ini yang akan diulang per item ────────────
            new TableRow({
              children: [
                cell('{{produk}}'),
                cell('{{qty}}',    AlignmentType.CENTER),
                cell('{{harga}}',  AlignmentType.RIGHT),
              ],
            }),

            // ── MARKER ROW CLOSE: sel pertama = {{/items}}, lain kosong ──
            new TableRow({
              children: [
                cell('{{/items}}'), // ← WAJIB di sel pertama
                cell(''),
                cell(''),
              ],
            }),

          ],
        }),

        // ──────────────────────────────────────────────────────────────────
        // ④ Loop Block (loop seluruh konten, bukan table row)
        // ──────────────────────────────────────────────────────────────────
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('4. Loop Block (bukan row)')] }),
        new Paragraph('{{#items}}\u2022 {{produk}} \u2014 Qty: {{qty}} \u2014 Harga: {{harga}}{{/items}}'),

        // ──────────────────────────────────────────────────────────────────
        // ⑤ Image Insert
        // ──────────────────────────────────────────────────────────────────
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('5. Gambar (ImageConfig)')] }),
        new Paragraph('Gambar inline (teks placeholder diganti gambar):'),
        new Paragraph('{{profile_image}}'),

      ],
    },
  ],
});

// ── Output ───────────────────────────────────────────────────────────────────

const templatesDir = path.resolve(__dirname, '../templates');
if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir, { recursive: true });

Packer.toBuffer(doc).then(buf => {
  const out = path.join(templatesDir, 'demo.docx');
  fs.writeFileSync(out, buf);
  console.log(`\u2705 Template berhasil dibuat: ${out}`);
  console.log('');
  console.log('Fitur yang ada di template:');
  console.log('  \u2460 Variabel teks + modifier (_upper, _sentence_case, _capitalize_each_word)');
  console.log('  \u2461 Default value {{var|default}}');
  console.log('  \u2462 Nested path {{perusahaan.nama}}');
  console.log('  \u2463 Kondisional # ({{#isPremium}}...{{/isPremium}})');
  console.log('  \u2464 Kondisional ^ ({{^isFreeUser}}...{{/isFreeUser}})');
  console.log('  \u2465 Kondisional ? ({{?adminAccess}}...{{/adminAccess}})');
  console.log('  \u2466 Row-Loop tabel (marker-open | data | marker-close)');
  console.log('  \u2467 Block Loop paragraf');
  console.log('  \u2468 Image insert (profile_image)');
}).catch(err => {
  console.error('\u274C Gagal membuat template:', err);
  process.exit(1);
});
