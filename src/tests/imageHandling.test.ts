import PizZip from 'pizzip';
import { DocumentService } from '../services/DocumentService';
import {
  pxToEmu,
  emuToPx,
  mimeToExtension,
  extensionToMime,
  detectMimeType,
  bytesToBase64,
  base64ToBytes,
  generateRelId,
  generateImageFilename,
} from '../utils/imageUtils';
import { isImageConfig } from '../interfaces/ImageConfig';

describe('imageUtils', () => {
  describe('pxToEmu', () => {
    it('converts 1 pixel to 9525 EMU', () => {
      expect(pxToEmu(1)).toBe(9525);
    });

    it('converts 96 pixels to ~914400 EMU (1 inch)', () => {
      expect(pxToEmu(96)).toBe(914400);
    });

    it('converts 200 pixels correctly', () => {
      expect(pxToEmu(200)).toBe(1905000);
    });

    it('handles 0', () => {
      expect(pxToEmu(0)).toBe(0);
    });
  });

  describe('emuToPx', () => {
    it('converts 914400 EMU to 96 px (1 inch)', () => {
      expect(emuToPx(914400)).toBe(96);
    });

    it('converts 9525 EMU back to 1 px', () => {
      expect(emuToPx(9525)).toBe(1);
    });

    it('roundtrips px → emu → px', () => {
      const original = 200;
      expect(emuToPx(pxToEmu(original))).toBe(original);
    });
  });

  describe('mimeToExtension', () => {
    it('maps image/png → png', () => {
      expect(mimeToExtension('image/png')).toBe('png');
    });

    it('maps image/jpeg → jpg', () => {
      expect(mimeToExtension('image/jpeg')).toBe('jpg');
    });

    it('maps image/gif → gif', () => {
      expect(mimeToExtension('image/gif')).toBe('gif');
    });

    it('maps image/webp → webp', () => {
      expect(mimeToExtension('image/webp')).toBe('webp');
    });

    it('returns bin for unknown MIME', () => {
      expect(mimeToExtension('application/octet-stream')).toBe('bin');
    });

    it('is case-insensitive', () => {
      expect(mimeToExtension('IMAGE/PNG')).toBe('png');
    });
  });

  describe('extensionToMime', () => {
    it('maps png → image/png', () => {
      expect(extensionToMime('png')).toBe('image/png');
    });

    it('maps jpg → image/jpeg', () => {
      expect(extensionToMime('jpg')).toBe('image/jpeg');
    });

    it('maps jpeg → image/jpeg', () => {
      expect(extensionToMime('jpeg')).toBe('image/jpeg');
    });

    it('returns octet-stream for unknown extension', () => {
      expect(extensionToMime('xyz')).toBe('application/octet-stream');
    });
  });

  describe('detectMimeType', () => {
    it('detects from data URI', () => {
      expect(detectMimeType('data:image/png;base64,abc123')).toBe('image/png');
    });

    it('detects from URL extension', () => {
      expect(detectMimeType('https://example.com/photo.jpg')).toBe('image/jpeg');
    });

    it('detects PNG from URL', () => {
      expect(detectMimeType('https://cdn.example.com/logo.png')).toBe('image/png');
    });

    it('detects with query string in URL', () => {
      expect(detectMimeType('https://example.com/img.gif?v=2')).toBe('image/gif');
    });

    it('defaults to image/png for unknown URLs', () => {
      expect(detectMimeType('https://example.com/img')).toBe('image/png');
    });
  });

  describe('base64 roundtrip', () => {
    it('converts bytes to base64 and back', () => {
      const original = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const b64 = bytesToBase64(original);
      const restored = base64ToBytes(b64);
      expect(restored).toEqual(original);
    });

    it('base64 of "Hello" is SGVsbG8=', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]);
      expect(bytesToBase64(bytes)).toBe('SGVsbG8=');
    });

    it('handles empty bytes', () => {
      const empty = new Uint8Array([]);
      expect(bytesToBase64(empty)).toBe('');
      expect(base64ToBytes('')).toEqual(new Uint8Array([]));
    });
  });

  describe('generateRelId', () => {
    it('generates a relationship ID not in existing list', () => {
      const existing = ['rId1', 'rId2', 'rId3'];
      const id = generateRelId('rId', existing);
      expect(existing).not.toContain(id);
      expect(id).toMatch(/^rId\d+$/);
    });

    it('generates rId10 when existing list is empty', () => {
      const id = generateRelId('rId', []);
      expect(id).toBe('rId10');
    });

    it('skips over collisions', () => {
      const existing = Array.from({ length: 15 }, (_, i) => `rId${i + 10}`);
      const id = generateRelId('rId', existing);
      expect(existing).not.toContain(id);
    });
  });

  describe('generateImageFilename', () => {
    it('generates image1.png when no existing files', () => {
      expect(generateImageFilename('png', [])).toBe('image1.png');
    });

    it('increments counter to avoid collision', () => {
      const existing = ['image1.png', 'image2.png'];
      expect(generateImageFilename('png', existing)).toBe('image3.png');
    });

    it('uses correct extension', () => {
      expect(generateImageFilename('jpg', [])).toBe('image1.jpg');
    });

    it('skips non-sequential collisions', () => {
      const existing = ['image1.jpg', 'image3.jpg'];
      // Counter starts at length+1 = 3, which exists, so becomes 4
      const result = generateImageFilename('jpg', existing);
      expect(result).not.toBe('image1.jpg');
      expect(result).not.toBe('image3.jpg');
    });
  });
});

describe('isImageConfig', () => {
  it('returns true for valid ImageConfig', () => {
    expect(
      isImageConfig({ type: 'image', source: 'https://example.com/img.png' })
    ).toBe(true);
  });

  it('returns false for plain object without type', () => {
    expect(isImageConfig({ source: 'https://example.com/img.png' })).toBe(false);
  });

  it('returns false for wrong type discriminator', () => {
    expect(isImageConfig({ type: 'text', source: 'x' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isImageConfig(null)).toBe(false);
  });

  it('returns false for string', () => {
    expect(isImageConfig('image')).toBe(false);
  });

  it('returns false for missing source', () => {
    expect(isImageConfig({ type: 'image' })).toBe(false);
  });
});

describe('DocxEngine image insert/replacement workflow', () => {
  it('replaces image with alt-variable and finalizes alt after insertion', async () => {
    const service = new DocumentService();

    const templateXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:t>Test</w:t></w:r></w:p><w:p><w:r><w:drawing><wp:inline><wp:extent cx="952500" cy="952500"/><wp:docPr id="1" name="{{logo_image}}" descr="{{logo_image}}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name=""/><pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="952500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`;

    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>`;

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;

    const templateZip = new PizZip();
    templateZip.file('word/document.xml', templateXml);
    templateZip.file('word/_rels/document.xml.rels', relsXml);
    templateZip.file('[Content_Types].xml', contentTypes);
    templateZip.file('word/media/image1.png', base64ToBytes('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMC/zgMaBYwAAAAASUVORK5CYII='));

    const templateBuffer = templateZip.generate({ type: 'uint8array', compression: 'DEFLATE' });

    const output = await service.generate(templateBuffer, {
      logo_image: {
        type: 'image' as const,
        source: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMC/zgMaBYwAAAAASUVORK5CYII=',
        width: 1,
        height: 1,
        mimeType: 'image/png',
      },
    });

    const outZip = new PizZip(output);
    const outDocXml = outZip.file('word/document.xml')?.asText();
    expect(outDocXml).toBeTruthy();
    expect(outDocXml).toContain('name="logo_image"');
    expect(outDocXml).toContain('descr="logo_image"');
    expect(outDocXml).not.toContain('{{logo_image}}');
  });
});
