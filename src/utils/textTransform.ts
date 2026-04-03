/**
 * Text transformation utilities for template variable modifiers.
 *
 * Supported modifiers (applied as suffixes to variable names):
 *   _upper              → ALL CAPS
 *   _lower              → all lowercase
 *   _capitalize_each_word → Title Case
 *   _toggle_case        → fIRST lETTER sMALL rEST cAPS
 *   _sentence_case      → First letter capital, rest lower
 *
 * If the modifier is not recognized, the original text is returned unchanged.
 */

export type TextModifier =
  | '_upper'
  | '_lower'
  | '_capitalize_each_word'
  | '_toggle_case'
  | '_sentence_case';

const KNOWN_MODIFIERS: readonly TextModifier[] = [
  '_upper',
  '_lower',
  '_capitalize_each_word',
  '_toggle_case',
  '_sentence_case',
];

/**
 * Detect and strip a known modifier suffix from a variable name.
 * Returns { cleanName, modifier } — modifier is null if none found.
 */
export function parseModifier(varName: string): {
  cleanName: string;
  modifier: TextModifier | null;
} {
  // Sort by length descending to match longest modifier first
  const sorted = [...KNOWN_MODIFIERS].sort((a, b) => b.length - a.length);
  for (const mod of sorted) {
    if (varName.endsWith(mod)) {
      return {
        cleanName: varName.slice(0, varName.length - mod.length),
        modifier: mod,
      };
    }
  }
  return { cleanName: varName, modifier: null };
}

/**
 * Apply a text modifier to a string value.
 * Returns the original string if modifier is null or unrecognized.
 */
export function applyModifier(text: string, modifier: TextModifier | null): string {
  if (modifier === null) return text;

  switch (modifier) {
    case '_upper':
      return toUpper(text);
    case '_lower':
      return toLower(text);
    case '_capitalize_each_word':
      return toCapitalizeEachWord(text);
    case '_toggle_case':
      return toToggleCase(text);
    case '_sentence_case':
      return toSentenceCase(text);
    default:
      return text;
  }
}

/** ALL CAPS */
export function toUpper(text: string): string {
  return text.toUpperCase();
}

/** all lowercase */
export function toLower(text: string): string {
  return text.toLowerCase();
}

/** Title Case — capitalize first letter of each word */
export function toCapitalizeEachWord(text: string): string {
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Toggle case: first letter of each word is lowercase, rest uppercase.
 * "hello world" → "hELLO wORLD"
 */
export function toToggleCase(text: string): string {
  return text.replace(/\b(\w)(\w*)/g, (_, first, rest) => {
    return first.toLowerCase() + rest.toUpperCase();
  });
}

/**
 * Sentence case: first letter uppercase, rest lowercase.
 * "hello world. another sentence." → "Hello world. Another sentence."
 */
export function toSentenceCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/(^\s*\w|[.!?]\s+\w)/g, (char) => char.toUpperCase());
}
