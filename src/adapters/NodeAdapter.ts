/**
 * NodeAdapter
 *
 * Storage adapter for Node environments.
 * Supports:
 *   - Save to local file system
 *   - Upload to AWS S3
 *   - Convert to Buffer
 *   - Convert to base64
 */

import type { StorageAdapter, S3UploadOptions, LocalSaveOptions } from '../interfaces/StorageAdapter';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export class NodeAdapter implements StorageAdapter {
  /**
   * Save file to local disk.
   * @param data      Raw file bytes
   * @param filename  File name (path relative to cwd, or absolute path)
   * @param options   Optional save options
   */
  async save(
    data: Uint8Array,
    filename: string,
    options: LocalSaveOptions = {}
  ): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const dir = options.directory ?? process.cwd();
    const fullPath = path.isAbsolute(filename)
      ? filename
      : path.join(dir, filename);

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Check overwrite
    if (!options.overwrite) {
      try {
        await fs.access(fullPath);
        // File exists — throw unless overwrite is true
        throw new Error(
          `File already exists: ${fullPath}. Set overwrite: true to replace it.`
        );
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw err;
        }
        // ENOENT = file doesn't exist, safe to write
      }
    }

    await fs.writeFile(fullPath, data);
  }

  /**
   * Upload file to AWS S3.
   * Requires @aws-sdk/client-s3 to be installed.
   */
  async uploadToS3(data: Uint8Array, options: S3UploadOptions): Promise<string> {
    let S3Client: typeof import('@aws-sdk/client-s3').S3Client;
    let PutObjectCommand: typeof import('@aws-sdk/client-s3').PutObjectCommand;

    try {
      const s3Module = await import('@aws-sdk/client-s3');
      S3Client = s3Module.S3Client;
      PutObjectCommand = s3Module.PutObjectCommand;
    } catch {
      throw new Error(
        'AWS SDK not found. Install it with: npm install @aws-sdk/client-s3'
      );
    }

    const client = new S3Client({
      region: options.region ?? 'us-east-1',
    });

    const command = new PutObjectCommand({
      Bucket: options.bucket,
      Key: options.key,
      Body: data,
      ContentType: options.contentType ?? DOCX_MIME,
      Metadata: options.metadata,
    });

    await client.send(command);

    // Return the S3 URL
    const region = options.region ?? 'us-east-1';
    return `https://${options.bucket}.s3.${region}.amazonaws.com/${options.key}`;
  }

  /**
   * Convert bytes to Node Buffer (usable as Blob equivalent in Node)
   */
  async toBlob(data: Uint8Array, mimeType: string = DOCX_MIME): Promise<Buffer> {
    return Buffer.from(data);
  }

  /**
   * Convert bytes to base64 string
   */
  async toBase64(data: Uint8Array): Promise<string> {
    return Buffer.from(data).toString('base64');
  }

  /**
   * Convert bytes to data URI (base64 with MIME prefix)
   */
  async toDataUri(data: Uint8Array, mimeType: string = DOCX_MIME): Promise<string> {
    const base64 = await this.toBase64(data);
    return `data:${mimeType};base64,${base64}`;
  }
}
