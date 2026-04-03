import type { ImageConfig } from './ImageConfig';

/**
 * JSON data passed into the template engine.
 * Values can be primitives, nested objects, arrays, or ImageConfig.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ImageConfig
  | JsonObject
  | JsonArray;

export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

/**
 * Options for the template engine
 */
export interface EngineOptions {
  /**
   * How to handle missing variables.
   * 'empty'   → replace with ''  (default)
   * 'keep'    → keep original {{variable}} syntax
   * 'throw'   → throw an error
   */
  missingVariableBehavior?: 'empty' | 'keep' | 'throw';

  /**
   * Whether to process image variables.
   * Default: true
   */
  processImages?: boolean;

  /**
   * Custom delimiters (default: {{ and }})
   */
  openDelimiter?: string;
  closeDelimiter?: string;
}

/**
 * Result of processing a template
 */
export interface ProcessResult {
  xml: string;
  imageReplacements: ImageReplacement[];
  imageInsertions: ImageInsertion[];
}

export interface ImageReplacement {
  variableName: string;
  existingRelId: string;
  imageConfig: ImageConfig;
}

export interface ImageInsertion {
  variableName: string;
  placeholderXml: string;
  imageConfig: ImageConfig;
}
