/**
 * BrowserAdapter
 *
 * Storage adapter for Browser environments.
 * Supports:
 *   - Trigger download in the browser
 *   - Return Blob
 *   - Convert to base64
 */

import type { StorageAdapter } from '../interfaces/StorageAdapter';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export class BrowserAdapter implements StorageAdapter {
  /**
   * Trigger a file download in the browser.
   * Creates a temporary <a> element with an object URL and clicks it.
   */
  async save(data: Uint8Array, filename: string): Promise<void> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('BrowserAdapter.save() requires a browser environment (window/document not found)');
    }

    const blob = new Blob([data.buffer as ArrayBuffer], { type: DOCX_MIME });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();

    // Cleanup — delay to allow download to start
    setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 200);
  }

  /**
   * Return the file as a browser Blob.
   */
  async toBlob(data: Uint8Array, mimeType: string = DOCX_MIME): Promise<Blob> {
    return new Blob([data.buffer as ArrayBuffer], { type: mimeType });
  }

  /**
   * Convert bytes to base64 string (browser-compatible)
   */
  async toBase64(data: Uint8Array): Promise<string> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([data.buffer as ArrayBuffer]);
      const reader = new FileReader();

      reader.onloadend = () => {
        const result = reader.result as string;
        // result is data:application/octet-stream;base64,<base64>
        const base64 = result.split(',')[1];
        resolve(base64);
      };

      reader.onerror = () => reject(new Error('FileReader failed during base64 conversion'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Convert bytes to data URI (base64 with MIME prefix).
   */
  async toDataUri(data: Uint8Array, mimeType: string = DOCX_MIME): Promise<string> {
    const base64 = await this.toBase64(data);
    return `data:${mimeType};base64,${base64}`;
  }

  /**
   * Open a Blob URL in a new browser tab (e.g., for PDF preview).
   */
  async openInNewTab(data: Uint8Array, mimeType: string = DOCX_MIME): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('openInNewTab() requires a browser environment');
    }

    const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    // Revoke after a delay
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
