/**
 * buatdoc
 *
 * Universal isomorphic DOCX template engine.
 * Works in Node and Browser (ESM + CJS).
 *
 * @example
 * ```typescript
 * import { DocumentService } from 'buatdoc';
 *
 * const service = new DocumentService();
 * const template = await service.fetchTemplate('https://example.com/template.docx');
 * const output = await service.generate(template, {
 *   name: 'Alice',
 *   company: 'Acme Corp',
 *   items: [
 *     { product: 'Widget', price: 9.99 },
 *     { product: 'Gadget', price: 24.99 },
 *   ],
 * });
 * // Node:
 * await service.saveToFile(output, 'invoice.docx');
 * // Browser:
 * await service.downloadInBrowser(output, 'invoice.docx');
 * ```
 */

// Main service (recommended entry point)
export { DocumentService } from './services/DocumentService';

// Core engines (for advanced usage)
export { DocxEngine } from './core/DocxEngine';
export { TemplateEngine } from './core/TemplateEngine';

// Adapters
export { NodeAdapter } from './adapters/NodeAdapter';
export { BrowserAdapter } from './adapters/BrowserAdapter';

// Interfaces & Types
export type { JsonObject, JsonValue, JsonArray, EngineOptions } from './interfaces/TemplateTypes';
export type { ImageConfig, ResolvedImage } from './interfaces/ImageConfig';
export type {
  StorageAdapter,
  S3UploadOptions,
  LocalSaveOptions,
} from './interfaces/StorageAdapter';

// Utilities (for custom implementations)
export {
  parseModifier,
  applyModifier,
  toUpper,
  toLower,
  toCapitalizeEachWord,
  toToggleCase,
  toSentenceCase,
} from './utils/textTransform';

export {
  resolveValue,
  resolvePath,
  valueToString,
  isTruthy,
} from './utils/objectResolver';

export {
  pxToEmu,
  emuToPx,
  mimeToExtension,
  extensionToMime,
  detectMimeType,
  fetchImageBytes,
  bytesToBase64,
  base64ToBytes,
} from './utils/imageUtils';

export { isImageConfig } from './interfaces/ImageConfig';
