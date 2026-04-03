import type { JsonValue, JsonObject } from '../interfaces/TemplateTypes';

/**
 * Resolve a dot-notation path against a data object.
 *
 * Examples:
 *   resolve({ user: { name: "Alice" } }, "user.name") → "Alice"
 *   resolve({ score: 42 },              "score")      → 42
 *   resolve({},                         "missing|default") → "default"
 *   resolve({ items: [{x:1}] },        "items.0.x")  → 1
 */
export function resolveValue(
  data: JsonObject,
  path: string
): JsonValue {
  // Split default value: "path|default"
  const pipeIndex = path.indexOf('|');
  let actualPath = path;
  let defaultValue: string | undefined;

  if (pipeIndex !== -1) {
    actualPath = path.slice(0, pipeIndex);
    defaultValue = path.slice(pipeIndex + 1);
  }

  const result = resolvePath(data, actualPath.trim());

  if (result === undefined || result === null) {
    return defaultValue !== undefined ? defaultValue : '';
  }

  return result;
}

/**
 * Traverse a dot-separated path through nested objects/arrays.
 * Returns undefined if any segment is missing.
 */
export function resolvePath(
  data: JsonObject | JsonValue,
  path: string
): JsonValue | undefined {
  if (!path) return data as JsonValue;

  const segments = path.split('.');
  let current: JsonValue = data as JsonValue;

  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;

    if (typeof current === 'object' && !Array.isArray(current)) {
      current = (current as JsonObject)[segment];
    } else if (Array.isArray(current)) {
      const index = parseInt(segment, 10);
      if (isNaN(index)) return undefined;
      current = (current as JsonValue[])[index];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Escape a string for XML: replaces <, >, &, ', and ".
 */
export function escapeXml(str: string): string {
  return str.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Convert a JsonValue to a string suitable for template output.
 * ImageConfig objects return empty string (handled separately).
 */
export function valueToString(value: JsonValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    return escapeXml(value);
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  // Objects (including ImageConfig) are not rendered as text
  return '';
}

/**
 * Evaluate a value as truthy/falsy for conditional blocks.
 * Empty string, 0, false, null, undefined, empty array = falsy.
 */
export function isTruthy(value: JsonValue): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return true;
  return false;
}
