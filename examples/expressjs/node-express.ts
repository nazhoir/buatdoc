/**
 * Node.js Usage Example — Express Server
 *
 * Demonstrates:
 * - Loading a DOCX template (demo.docx — all syntax features)
 * - Generating with JSON data
 * - Saving to local file
 * - Uploading to S3
 * - Returning as base64 in HTTP response
 *
 * Install: npm install express buatdoc
 * Run:     npx ts-node node-express.ts
 */

import express, { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentService } from 'buatdoc';

const app = express();
app.use(express.json());

const service = new DocumentService();

// ---------------------------------------------------------------------------
// Sample data — mirrors all template variables used in templates/demo.docx
// ---------------------------------------------------------------------------
const sampleData = {
    // ── Text variables ──────────────────────────────────────────────────────
    nama: 'andika putra',
    judul: 'belajar typescript dengan buatdoc',
    tanggal: '2024-01-15',

    // ── Booleans for conditionals ──────────────────────────────────────────
    isPremium: true,
    isFreeUser: false,
    adminAccess: true,

    // ── Nested object ─────────────────────────────────────────────────────
    perusahaan: {
        nama: 'PT. Teknologi Maju',
        alamat: 'Jl. Sudirman No. 1, Jakarta',
        // This image is INSERTED as new inline image
        logo: {
            type: 'image' as const,
            source: 'https://dummyimage.com/150x50/ffffff/000000.png&text=Minimalist+Logo',
            width: 150,
            height: 50,
            mimeType: 'image/jpeg',
        },
    },

    // ── Loop items ─────────────────────────────────────────────────────────
    items: [
        { produk: 'Laptop Pro', harga: 15000000, qty: 1 },
        { produk: 'Mechanical Keyboard', harga: 850000, qty: 2 },
        { produk: 'Wireless Mouse', harga: 450000, qty: 2 },
        { produk: 'USB-C Hub', harga: 350000, qty: 1 },
    ],

    // ── Image: NEW inline insertion (text placeholder {{profile_image}}) ──
    profile_image: {
        type: 'image' as const,
        source: 'https://dummyimage.com/200x200/ffffff/000000.png&text=White+Bg+Logo',
        width: 200,
        height: 200,
        mimeType: 'image/jpeg',
    },

    // ── Image: REPLACE existing image via ALT text {{logo_image}} ─────────
    logo_image: {
        type: 'image' as const,
        source: 'https://dummyimage.com/150x50/ffffff/00509B.png&text=Biz+Logo',
        width: 150,
        height: 50,
        mimeType: 'image/jpeg',
    },
};

// ---------------------------------------------------------------------------
// GET /generate/demo — Generate from demo.docx template, return download
// ---------------------------------------------------------------------------
app.get('/generate/demo', async (_req: Request, res: Response) => {
    try {
        const TEMPLATE_PATH = path.resolve(__dirname, '/public/templates/demo.docx');
        if (!fs.existsSync(TEMPLATE_PATH)) {
            res.status(404).json({ error: 'Template tidak ditemukan. Jalankan npx ts-node scripts/generate_template.ts terlebih dahulu dari root folder.' });
            return;
        }

        const template = await service.loadTemplateFromFile(TEMPLATE_PATH);
        const output = await service.generate(template, sampleData);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', 'attachment; filename="hasil-demo.docx"');
        res.send(Buffer.from(output));
    } catch (err) {
        console.error('Generation error:', err);
        res.status(500).json({ error: (err as Error).message });
    }
});

// ---------------------------------------------------------------------------
// POST /generate — Generate DOCX and return as download (custom template URL)
// ---------------------------------------------------------------------------
app.post('/generate', async (req: Request, res: Response) => {
    try {
        const { templateUrl, data, filename = 'output.docx' } = req.body as {
            templateUrl: string;
            data: Record<string, unknown>;
            filename?: string;
        };

        if (!templateUrl) {
            res.status(400).json({ error: 'templateUrl is required' });
            return;
        }

        const template = await service.fetchTemplate(templateUrl);
        const output = await service.generate(template, data ?? sampleData);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(Buffer.from(output));
    } catch (err) {
        console.error('Generation error:', err);
        res.status(500).json({ error: (err as Error).message });
    }
});

// ---------------------------------------------------------------------------
// POST /generate/base64 — Return as base64 string
// ---------------------------------------------------------------------------
app.post('/generate/base64', async (req: Request, res: Response) => {
    try {
        const { templateUrl, data } = req.body as {
            templateUrl: string;
            data: Record<string, unknown>;
        };

        const base64 = await service.generateToBase64(
            templateUrl,
            data ?? sampleData
        );

        res.json({ base64, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

// ---------------------------------------------------------------------------
// POST /generate/s3 — Generate and upload to S3
// ---------------------------------------------------------------------------
app.post('/generate/s3', async (req: Request, res: Response) => {
    try {
        const { templateUrl, data, bucket, key, region } = req.body as {
            templateUrl: string;
            data: Record<string, unknown>;
            bucket: string;
            key: string;
            region?: string;
        };

        if (!bucket || !key) {
            res.status(400).json({ error: 'bucket and key are required' });
            return;
        }

        const template = await service.fetchTemplate(templateUrl);
        const output = await service.generate(template, data ?? sampleData);
        const url = await service.uploadToS3(output, { bucket, key, region });

        res.json({ url, message: 'Successfully uploaded to S3' });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

// ---------------------------------------------------------------------------
// GET /generate/local — Generate from local template and save to disk
// ---------------------------------------------------------------------------
app.get('/generate/local', async (_req: Request, res: Response) => {
    try {
        const TEMPLATE_PATH = path.resolve(__dirname, './public/templates/demo.docx');
        const OUTPUT_PATH = path.resolve(__dirname, './public/output/output-generated.docx');

        if (!fs.existsSync(TEMPLATE_PATH)) {
            res.status(404).json({ error: 'Template tidak ditemukan. Jalankan npx ts-node scripts/generate_template.ts terlebih dahulu dari root folder.' });
            return;
        }

        const template = await service.loadTemplateFromFile(TEMPLATE_PATH);
        const output = await service.generate(template, sampleData);
        await service.saveToFile(output, OUTPUT_PATH, { overwrite: true });

        res.json({ message: `Saved to ${OUTPUT_PATH}` });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

// Start server
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
    console.log(`buatdoc demo server running at http://localhost:${PORT}`);
    console.log('');
    console.log('Endpoints:');
    console.log('  GET  /generate/demo     → generates from demo.docx template, returns download');
    console.log('  POST /generate          → custom templateUrl, returns .docx file download');
    console.log('  POST /generate/base64   → returns base64 string');
    console.log('  POST /generate/s3       → uploads to S3, returns URL');
    console.log('  GET  /generate/local    → saves to ./output-generated.docx');
});

export { app };