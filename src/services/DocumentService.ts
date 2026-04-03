/**
 * DocumentService
 *
 * High-level service for generating DOCX documents from templates.
 * Orchestrates: fetch template → process → deliver output.
 *
 * This is the primary public API for consumers of this library.
 *
 * @example
 * ```typescript
 * // Node
 * const service = new DocumentService();
 * const template = await service.fetchTemplate('https://example.com/template.docx');
 * const output = await service.generate(template, { name: 'Alice' });
 * await service.saveToFile(output, 'output.docx');
 *
 * // Browser
 * const service = new DocumentService();
 * const template = await service.fetchTemplate('/templates/invoice.docx');
 * const output = await service.generate(template, invoiceData);
 * await service.downloadInBrowser(output, 'invoice.docx');
 * ```
 */

import { DocxEngine } from '../core/DocxEngine';
import type { JsonObject } from '../interfaces/TemplateTypes';
import type { S3UploadOptions, LocalSaveOptions } from '../interfaces/StorageAdapter';

export class DocumentService {
  private readonly engine: DocxEngine;

  constructor() {
    this.engine = new DocxEngine();
  }

  // ---------------------------------------------------------------------------
  // Template Fetching
  // ---------------------------------------------------------------------------

  /**
   * Fetch a DOCX template from a URL.
   * Works in both Node (native fetch / axios fallback) and Browser.
   *
   * @param url  URL to the DOCX file (http/https/data URI/blob URL)
   * @returns    Raw ArrayBuffer of the DOCX file
   */
  async fetchTemplate(url: string): Promise<ArrayBuffer> {
    if (url.startsWith('data:')) {
      return this.dataUriToArrayBuffer(url);
    }

    if (typeof fetch !== 'undefined') {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch template: ${response.status} ${response.statusText} (${url})`
        );
      }
      return response.arrayBuffer();
    }

    // Node fallback via axios
    try {
      const axios = await import('axios');
      const response = await axios.default.get(url, {
        responseType: 'arraybuffer',
      });
      return response.data as ArrayBuffer;
    } catch {
      throw new Error(`Cannot fetch template from ${url}: fetch and axios both unavailable.`);
    }
  }

  /**
   * Load a DOCX template from a local file path (Node only).
   */
  async loadTemplateFromFile(filePath: string): Promise<ArrayBuffer> {
    const fs = await import('fs/promises');
    const buffer = await fs.readFile(filePath);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
  }

  // ---------------------------------------------------------------------------
  // Document Generation
  // ---------------------------------------------------------------------------

  /**
   * Generate a DOCX document from a template buffer and JSON data.
   *
   * @param templateBuffer  ArrayBuffer of the DOCX template
   * @param jsonData        JSON data for template variable substitution
   * @returns               Processed DOCX as Uint8Array
   */
  async generate(
    templateBuffer: ArrayBuffer | Uint8Array,
    jsonData: Record<string, unknown>
  ): Promise<Uint8Array> {
    return this.engine.process(templateBuffer, jsonData as JsonObject);
  }

  // ---------------------------------------------------------------------------
  // Output: Node
  // ---------------------------------------------------------------------------

  /**
   * Save the generated document to a local file (Node only).
   *
   * @param data      Generated DOCX bytes
   * @param filename  Output filename or path
   * @param options   Optional save options
   */
  async saveToFile(
    data: Uint8Array,
    filename: string,
    options: LocalSaveOptions = { overwrite: true }
  ): Promise<void> {
    const { NodeAdapter } = await import('../adapters/NodeAdapter.js');
    const adapter = new NodeAdapter();
    await adapter.save(data, filename, options);
  }

  /**
   * Upload the generated document to AWS S3 (Node only).
   *
   * @param data     Generated DOCX bytes
   * @param options  S3 upload options (bucket, key, region, etc.)
   * @returns        Public S3 URL of the uploaded file
   */
  async uploadToS3(data: Uint8Array, options: S3UploadOptions): Promise<string> {
    const { NodeAdapter } = await import('../adapters/NodeAdapter.js');
    const adapter = new NodeAdapter();
    return adapter.uploadToS3(data, options);
  }

  /**
   * Convert to Node Buffer
   */
  async toBuffer(data: Uint8Array): Promise<Buffer> {
    const { NodeAdapter } = await import('../adapters/NodeAdapter.js');
    const adapter = new NodeAdapter();
    return adapter.toBlob(data) as Promise<Buffer>;
  }

  // ---------------------------------------------------------------------------
  // Output: Browser
  // ---------------------------------------------------------------------------

  /**
   * Trigger a file download in the browser.
   */
  async downloadInBrowser(data: Uint8Array, filename: string): Promise<void> {
    const { BrowserAdapter } = await import('../adapters/BrowserAdapter.js');
    const adapter = new BrowserAdapter();
    await adapter.save(data, filename);
  }

  /**
   * Return the generated document as a browser Blob.
   */
  async toBlob(data: Uint8Array): Promise<Blob> {
    const { BrowserAdapter } = await import('../adapters/BrowserAdapter.js');
    const adapter = new BrowserAdapter();
    return adapter.toBlob(data) as Promise<Blob>;
  }

  // ---------------------------------------------------------------------------
  // Output: Universal
  // ---------------------------------------------------------------------------

  /**
   * Convert to base64 string (works in both environments).
   */
  async toBase64(data: Uint8Array): Promise<string> {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(data).toString('base64');
    }
    // Browser fallback
    const { BrowserAdapter } = await import('../adapters/BrowserAdapter.js');
    const adapter = new BrowserAdapter();
    return adapter.toBase64(data);
  }

  /**
   * Convert to data URI (base64 with MIME prefix).
   */
  async toDataUri(data: Uint8Array): Promise<string> {
    const base64 = await this.toBase64(data);
    return `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`;
  }

  // ---------------------------------------------------------------------------
  // Convenience: One-shot generation + output
  // ---------------------------------------------------------------------------

  /**
   * Fetch template → generate → save to file (Node).
   */
  async generateAndSave(
    templateUrl: string,
    data: Record<string, unknown>,
    outputPath: string,
    options: LocalSaveOptions = { overwrite: true }
  ): Promise<void> {
    const template = await this.fetchTemplate(templateUrl);
    const output = await this.generate(template, data);
    await this.saveToFile(output, outputPath, options);
  }

  /**
   * Fetch template → generate → trigger browser download.
   */
  async generateAndDownload(
    templateUrl: string,
    data: Record<string, unknown>,
    filename: string
  ): Promise<void> {
    const template = await this.fetchTemplate(templateUrl);
    const output = await this.generate(template, data);
    await this.downloadInBrowser(output, filename);
  }

  /**
   * Fetch template → generate → return base64.
   */
  async generateToBase64(
    templateUrl: string,
    data: Record<string, unknown>
  ): Promise<string> {
    const template = await this.fetchTemplate(templateUrl);
    const output = await this.generate(template, data);
    return this.toBase64(output);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private dataUriToArrayBuffer(dataUri: string): ArrayBuffer {
    const base64 = dataUri.split(',')[1];

    if (typeof Buffer !== 'undefined') {
      const buf = Buffer.from(base64, 'base64');
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    }

    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
