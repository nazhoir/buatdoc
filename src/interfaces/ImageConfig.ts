/**
 * Represents an image configuration object within the JSON data.
 * When a template variable resolves to an ImageConfig, it triggers image processing.
 */
export interface ImageConfig {
  /** Discriminator to identify this value as an image config */
  type: 'image';
  /** URL or base64 data URI of the image */
  source: string;
  
  // -- Sizing & Scaling --
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Maximum width in pixels */
  maxWidth?: number;
  /** Maximum height in pixels */
  maxHeight?: number;
  
  // -- Layout & Styling --
  /** Image position alignment (default: inline) */
  alignment?: 'left' | 'center' | 'right';
  /** Set image as background behind text (default: false) */
  background?: boolean;
  
  // -- Border & Display --
  /** Border configuration */
  border?: {
    color?: string; // hex string, e.g., 'FF0000'
    size?: number; // size in point equivalents
    style?: string; // e.g. 'single', 'dashed', 'dotted'
  };
  
  /** Rotate image strictly in degrees (e.g. 90, 180) */
  rotation?: number;
  /** Flip horizontally */
  flipX?: boolean;
  /** Flip vertically */
  flipY?: boolean;
  
  // -- Metadata & Links --
  /** MIME type, e.g. 'image/png', 'image/jpeg' */
  mimeType?: string;
  /** Alternative text (overrides default/templater) */
  altText?: string;
  /** Internal Document Name descriptor */
  name?: string;
  /** External hyperlink when the image is clicked */
  link?: string;
  /** Caption block beneath the image */
  caption?: string;
}

/**
 * Resolved image with binary data ready for embedding.
 */
export interface ResolvedImage {
  data: Uint8Array;
  mimeType: string;
  width: number;
  height: number;
  extension: string;
  relationshipId: string;
}

/**
 * Type guard for ImageConfig
 */
export function isImageConfig(value: unknown): value is ImageConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>)['type'] === 'image' &&
    typeof (value as Record<string, unknown>)['source'] === 'string'
  );
}
