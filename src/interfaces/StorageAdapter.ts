/**
 * Unified interface for persisting or delivering generated documents.
 * Implementations differ per environment (Node / Browser).
 */
export interface StorageAdapter {
  /**
   * Save or deliver the generated file.
   * @param data  Raw bytes of the generated DOCX file
   * @param filename  Desired filename (e.g. "output.docx")
   */
  save(data: Uint8Array, filename: string): Promise<void>;

  /**
   * Return the processed bytes as a Buffer (Node) or Blob (Browser).
   * @param data  Raw bytes
   * @param mimeType  MIME type (default: application/vnd.openxmlformats-officedocument.wordprocessingml.document)
   */
  toBlob(
    data: Uint8Array,
    mimeType?: string
  ): Promise<Blob | Uint8Array>;

  /**
   * Return the processed bytes as a base64-encoded string.
   */
  toBase64(data: Uint8Array): Promise<string>;
}

/**
 * Options for S3 uploads (Node adapter)
 */
export interface S3UploadOptions {
  bucket: string;
  key: string;
  region?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

/**
 * Options for local file saving (Node adapter)
 */
export interface LocalSaveOptions {
  directory?: string;
  overwrite?: boolean;
}
