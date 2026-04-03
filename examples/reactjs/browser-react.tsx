/**
 * Browser / React + Vite Usage Example
 *
 * Demonstrates using buatdoc entirely in the browser with:
 * - templates/demo.docx — shows all template syntax (text vars, modifiers,
 *   conditionals, loops, table, image insert, image replacement via ALT text)
 * - Editable JSON data textarea
 * - Option: default template OR user-supplied local file (no server upload)
 *
 * Install: npm install buatdoc
 */

import { useState } from 'react';
import { DocumentService } from 'buatdoc';

// Importing docx via Vite automatically provides the resolved server path
// @ts-ignore - handled by vite client
// import TEMPLATE_URL from '../../templates/demo.docx?url';

// ── Default data matching all variables in templates/demo.docx ────────────
const INITIAL_JSON = {
  nama: 'Andika Putra',
  judul: 'belajar typescript dengan buatdoc',
  tanggal: '2024-01-15',

  isPremium: true,
  isFreeUser: false,
  adminAccess: true,

  perusahaan: {
    nama: 'PT. Teknologi Maju',
    alamat: 'Jl. Sudirman No. 1, Jakarta',
  },

  items: [
    { produk: 'Laptop Pro', harga: 15000000, qty: 1 },
    { produk: 'Mechanical Keyboard', harga: 850000, qty: 2 },
    { produk: 'Wireless Mouse', harga: 450000, qty: 2 },
    { produk: 'USB-C Hub', harga: 350000, qty: 1 },
  ],

  // ImageConfig — insert gambar baru (text placeholder {{profile_image}} di template)
  profile_image: {
    type: 'image',
    source: 'https://dummyimage.com/200x200/ffffff/000000.png&text=Profile+Image',
    width: 200,
    height: 200,
    mimeType: 'image/jpeg',
  },

  // ImageConfig — ganti gambar yang sudah ada di template (ALT text = {{logo_image}})
  logo_image: {
    type: 'image',
    source: 'https://dummyimage.com/150x50/ffffff/00509B.png&text=Logo',
    width: 150,
    height: 50,
    mimeType: 'image/jpeg',
  },
};

// ── Status styling helpers ─────────────────────────────────────────────────
function statusStyle(status: string): React.CSSProperties {
  if (status.startsWith('✅')) return { background: '#d4edda', color: '#155724' };
  if (status.startsWith('❌')) return { background: '#f8d7da', color: '#721c24' };
  return { background: '#e2e3e5', color: '#383d41' };
}

export function DocxGeneratorDemo() {
  const [status, setStatus]   = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [base64Result, setBase64Result] = useState<string>('');
  const [jsonText, setJsonText] = useState<string>(JSON.stringify(INITIAL_JSON, null, 2));
  const [useDefaultTemplate, setUseDefaultTemplate] = useState<boolean>(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jsonError, setJsonError] = useState<string>('');

  const service = new DocumentService();

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getJsonData = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonError('');
      return parsed;
    } catch {
      const msg = 'JSON tidak valid. Perbaiki sebelum generate.';
      setJsonError(msg);
      throw new Error(msg);
    }
  };

  const prepareTemplate = async (): Promise<ArrayBuffer | Uint8Array> => {
    if (useDefaultTemplate) {
      setStatus('Fetching template dari server...');
      const response = await fetch('/templates/demo.docx');
      if (!response.ok) throw new Error('Failed to fetch template');
      return response.arrayBuffer();
    }
    if (!selectedFile) throw new Error('Pilih file template DOCX terlebih dahulu.');
    setStatus(`Membaca file lokal: ${selectedFile.name}...`);
    return selectedFile.arrayBuffer();
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleDownload() {
    setLoading(true);
    setStatus('Memulai proses...');
    setBase64Result('');
    try {
      const data   = getJsonData();
      const tmpl   = await prepareTemplate();
      setStatus('Generating dokumen...');
      const output = await service.generate(tmpl, data);
      setStatus('Mendownload...');
      await service.downloadInBrowser(output, 'hasil-buatdoc.docx');
      setStatus('✅ Dokumen berhasil di-download!');
    } catch (err) {
      setStatus(`❌ ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleGetBase64() {
    setLoading(true);
    setStatus('Mengkonversi ke base64...');
    setBase64Result('');
    try {
      const data   = getJsonData();
      const tmpl   = await prepareTemplate();
      setStatus('Generating dokumen...');
      const output = await service.generate(tmpl, data);
      const base64 = await service.toBase64(output);
      setBase64Result(base64.slice(0, 120) + '…');
      setStatus(`✅ Base64 berhasil (${base64.length.toLocaleString()} karakter)`);
    } catch (err) {
      setStatus(`❌ ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '2rem auto', padding: '0 1.5rem' }}>

      {/* Header */}
      <div style={{ borderBottom: '3px solid #706FD3', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, color: '#2C2C54' }}>📄 buatdoc — Browser Demo</h1>
        <p style={{ margin: '0.4rem 0 0', color: '#666' }}>
          Client-side DOCX generation. Template: <code style={{ background: '#eee', padding: '2px 6px', borderRadius: 3 }}>/templates/demo.docx</code>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem' }}>

        {/* LEFT: JSON Editor */}
        <section>
          <h3 style={{ color: '#2C2C54', marginTop: 0 }}>1. Edit Data JSON</h3>
          <p style={{ fontSize: 13, color: '#777', margin: '0 0 0.5rem' }}>
            Data ini di-inject ke template. Ubah sesuai kebutuhan.
          </p>
          <textarea
            value={jsonText}
            onChange={e => { setJsonText(e.target.value); setJsonError(''); }}
            style={{
              width: '100%', height: 420, fontFamily: 'monospace', fontSize: 12,
              padding: '0.6rem', borderRadius: 4,
              border: jsonError ? '2px solid #dc3545' : '1px solid #ccc',
              resize: 'vertical', boxSizing: 'border-box',
            }}
          />
          {jsonError && <p style={{ color: '#dc3545', margin: '4px 0 0', fontSize: 13 }}>⚠ {jsonError}</p>}
        </section>

        {/* RIGHT: Options + Actions */}
        <section>
          {/* Template chooser */}
          <h3 style={{ color: '#2C2C54', marginTop: 0 }}>2. Pilih Template</h3>
          <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: 6, border: '1px solid #dee2e6' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: '0.6rem' }}>
              <input type="radio" checked={useDefaultTemplate} onChange={() => setUseDefaultTemplate(true)} />
              <span>Gunakan <strong>demo.docx</strong> (default)<br />
                <code style={{ fontSize: 11, color: '#888' }}>/templates/demo.docx</code>
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
              <input type="radio" checked={!useDefaultTemplate} onChange={() => setUseDefaultTemplate(false)} style={{ marginTop: 3 }} />
              <span>Upload template sendiri<br />
                <span style={{ fontSize: 12, color: '#888' }}>(Hanya dibaca di browser — tidak diupload ke server)</span>
              </span>
            </label>
            {!useDefaultTemplate && (
              <input
                type="file" accept=".docx"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                style={{ marginTop: '0.8rem', display: 'block' }}
              />
            )}
          </div>

          {/* Actions */}
          <h3 style={{ color: '#2C2C54' }}>3. Generate</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <button
              onClick={handleDownload} disabled={loading}
              style={{ padding: '0.6rem 1rem', background: '#706FD3', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              📥 Generate & Download .docx
            </button>
            <button
              onClick={handleGetBase64} disabled={loading}
              style={{ padding: '0.6rem 1rem', background: '#2C2C54', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              📋 Generate & Lihat Base64
            </button>
          </div>

          {/* Status */}
          {status && (
            <div style={{ marginTop: '1rem', padding: '0.7rem 1rem', borderRadius: 4, fontFamily: 'monospace', fontSize: 13, ...statusStyle(status) }}>
              {loading && '⏳ '}{status}
            </div>
          )}

          {/* Base64 preview */}
          {base64Result && (
            <div style={{ marginTop: '1rem' }}>
              <strong style={{ fontSize: 13 }}>Base64 (preview):</strong>
              <pre style={{ fontSize: 11, overflow: 'auto', background: '#f5f5f5', padding: '0.5rem', borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {base64Result}
              </pre>
            </div>
          )}
        </section>
      </div>

      {/* Syntax cheat sheet */}
      <details style={{ marginTop: '2.5rem', border: '1px solid #dee2e6', borderRadius: 6, padding: '0.8rem 1.2rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 15, color: '#2C2C54' }}>
          📖 Template Syntax Reference (buatdoc)
        </summary>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.8rem', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#2C2C54', color: '#fff' }}>
              <th style={{ padding: '6px 10px', textAlign: 'left' }}>Fitur</th>
              <th style={{ padding: '6px 10px', textAlign: 'left' }}>Sintaks</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Variabel teks',           '{{variable}}'],
              ['Nested property',         '{{user.name}}'],
              ['Default value',           '{{name|Guest}}'],
              ['Uppercase',               '{{name_upper}}'],
              ['Lowercase',               '{{name_lower}}'],
              ['Capitalize each word',    '{{name_capitalize_each_word}}'],
              ['Toggle case',             '{{name_toggle_case}}'],
              ['Sentence case',           '{{name_sentence_case}}'],
              ['Conditional block',       '{{#if flag}}...{{/if}}'],
              ['Loop block',              '{{#each items}}...{{/each}}'],
              ['Loop index',              '{{@index}}'],
              ['First/last flag',         '{{@first}}, {{@last}}'],
              ['Image insert (baru)',     'Teks: {{profile_image}} (ImageConfig)'],
              ['Image replace (ALT)',     'Set ALT text gambar = {{logo_image}}'],
            ].map(([feat, syntax], i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#f8f9fa' : '#fff' }}>
                <td style={{ padding: '5px 10px' }}>{feat}</td>
                <td style={{ padding: '5px 10px' }}><code style={{ background: '#eee', padding: '1px 5px', borderRadius: 3 }}>{syntax}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export default DocxGeneratorDemo;