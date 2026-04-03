/**
 * Image utility functions.
 * Handles fetching, base64 encoding, MIME type detection, and EMU conversion.
 * Works in both Node and Browser environments.
 */

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

/**
 * 1 inch = 914400 EMU (English Metric Units)
 * 1 pixel at 96 DPI = 914400/96 = 9525 EMU
 */
const PX_TO_EMU = 9525;

/**
 * Convert pixels to EMU
 */
export function pxToEmu(px: number): number {
  return Math.round(px * PX_TO_EMU);
}

/**
 * Convert EMU to pixels
 */
export function emuToPx(emu: number): number {
  return Math.round(emu / PX_TO_EMU);
}

/**
 * Get file extension from MIME type
 */
export function mimeToExtension(mimeType: string): string {
  return MIME_TO_EXT[mimeType.toLowerCase()] ?? 'bin';
}

/**
 * Get MIME type from file extension
 */
export function extensionToMime(ext: string): string {
  return EXT_TO_MIME[ext.toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Detect MIME type from URL or base64 data URI
 */
export function detectMimeType(source: string): string {
  // Data URI: data:image/png;base64,...
  const dataUriMatch = source.match(/^data:([^;]+);base64,/);
  if (dataUriMatch) return dataUriMatch[1];

  // URL extension
  const urlMatch = source.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
  if (urlMatch) {
    const ext = urlMatch[1].toLowerCase();
    const mime = EXT_TO_MIME[ext];
    if (mime) return mime;
  }

  // Default to PNG
  return 'image/png';
}

/**
 * Fetch an image from a URL and return its raw bytes.
 * Works in both Node (via fetch/axios fallback) and Browser.
 */
export async function fetchImageBytes(url: string): Promise<Uint8Array> {
  const { bytes } = await fetchImageBytesWithMime(url);
  return bytes;
}

/**
 * Fetch image bytes AND detect MIME type from Content-Type header when possible.
 */
export async function fetchImageBytesWithMime(
  url: string
): Promise<{ bytes: Uint8Array; mimeType: string | null }> {
  // Handle base64 data URIs directly
  if (url.startsWith('data:')) {
    const match = url.match(/^data:([^;]+);base64,/);
    const mimeType = match ? match[1] : null;
    return { bytes: dataUriToBytes(url), mimeType };
  }

  // Use native fetch (Node 18+ and all modern browsers)
  if (typeof fetch !== 'undefined') {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText} (${url})`);
    }
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type');
    // Strip parameters like "; charset=utf-8"
    const mimeType = contentType ? contentType.split(';')[0].trim() : null;
    return { bytes: new Uint8Array(buffer), mimeType };
  }

  // Node fallback via axios
  try {
    const axios = await import('axios');
    const response = await axios.default.get(url, { responseType: 'arraybuffer' });
    const contentType: string | undefined = response.headers['content-type'];
    const mimeType = contentType ? contentType.split(';')[0].trim() : null;
    return { bytes: new Uint8Array(response.data as ArrayBuffer), mimeType };
  } catch {
    throw new Error(`fetch is not available and axios fallback failed for: ${url}`);
  }
}

/**
 * Convert a base64 data URI to bytes
 */
export function dataUriToBytes(dataUri: string): Uint8Array {
  const base64Match = dataUri.match(/^data:[^;]+;base64,(.+)$/);
  if (!base64Match) {
    throw new Error('Invalid data URI format');
  }
  return base64ToBytes(base64Match[1]);
}

/**
 * Convert a base64 string to Uint8Array
 */
export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    // Node
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  // Browser
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert Uint8Array to base64 string
 */
export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    // Node
    return Buffer.from(bytes).toString('base64');
  }
  // Browser
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Generate a unique relationship ID
 */
export function generateRelId(prefix = 'rId', existingIds: string[] = []): string {
  let counter = existingIds.length + 10;
  let id = `${prefix}${counter}`;
  while (existingIds.includes(id)) {
    counter++;
    id = `${prefix}${counter}`;
  }
  return id;
}

/**
 * Generate a unique image filename
 */
export function generateImageFilename(ext: string, existing: string[] = []): string {
  let counter = existing.length + 1;
  let name = `image${counter}.${ext}`;
  while (existing.includes(name)) {
    counter++;
    name = `image${counter}.${ext}`;
  }
  return name;
}
