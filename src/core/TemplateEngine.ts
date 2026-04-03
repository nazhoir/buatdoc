/**
 * TemplateEngine
 *
 * A zero-dependency template engine that processes XML/text content.
 * Uses manual regex parsing — no eval, no new Function, no external template libs.
 *
 * Supported syntax:
 *   {{variable}}                    Simple variable substitution
 *   {{user.name}}                   Nested property access (dot notation)
 *   {{name|Default}}                Default value if variable missing/falsy
 *   {{name_upper}}                  Text modifier (_upper, _lower, etc.)
 *   {{#varName}}...{{/varName}}     Conditional / loop block
 *   {{^varName}}...{{/varName}}     Inverted conditional block
 *   {{?varName}}...{{/varName}}     Render content only if truthy (alias of #)
 *   {{-varName}}...{{/varName}}     Dash loop (same as # but DOCX-node aware)
 *   {{@raw}}                        Raw XML injection (no escaping)
 */

import type { JsonObject, JsonValue, EngineOptions } from '../interfaces/TemplateTypes';
import { parseModifier, applyModifier } from '../utils/textTransform';
import { resolveValue, resolvePath, valueToString, isTruthy } from '../utils/objectResolver';
import { isImageConfig } from '../interfaces/ImageConfig';
import { SUPPORTED_PREFIXES } from './PrefixDispatcher';

interface VariableMatch {
  fullMatch: string;
  expression: string;
}

// Sorted prefixes (longest-first) — computed once for performance
const SORTED_BLOCK_PREFIXES = Object.values(SUPPORTED_PREFIXES)
  .filter(p => p.isBlock)
  .sort((a, b) => b.prefix.length - a.prefix.length);

export class TemplateEngine {
  public readonly options: Required<EngineOptions>;

  private readonly VAR_RE: RegExp;

  constructor(options: EngineOptions = {}) {
    this.options = {
      missingVariableBehavior: options.missingVariableBehavior ?? 'empty',
      processImages: options.processImages ?? true,
      openDelimiter: options.openDelimiter ?? '{{',
      closeDelimiter: options.closeDelimiter ?? '}}',
    };

    const open = this.escapeRegex(this.options.openDelimiter);
    const close = this.escapeRegex(this.options.closeDelimiter);

    this.VAR_RE = new RegExp(`${open}([^{}]+?)${close}`, 'g');
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  process(template: string, data: JsonObject): string {
    this.validateNesting(template);
    let result = this.processBlocks(template, data);
    result = this.processVariables(result, data);
    return result;
  }

  resolveExpression(expression: string, data: JsonObject): string {
    let isRaw = false;
    let expr = expression;

    if (expr.startsWith('r@')) {
      isRaw = true;
      expr = expr.slice(2).trim();
    } else if (expr.startsWith('@')) {
      // Preserve metadata variables like @index, @first, @last, @value
      // when they exist on the data object. Otherwise fall back to raw mode.
      if (resolvePath(data, expr) !== undefined) {
        isRaw = false;
      } else {
        isRaw = true;
        expr = expr.slice(1).trim();
      }
    }

    const pipeIdx = expr.indexOf('|');
    let pathPart = pipeIdx !== -1 ? expr.slice(0, pipeIdx).trim() : expr;
    const defaultVal = pipeIdx !== -1 ? expr.slice(pipeIdx + 1) : undefined;

    // Style markers — pass through as plain text markers for DocxEngine post-processing
    if (expression.startsWith(':stylepar')) return `__DOCX_STYLE_P__${expression.slice(9).trim()}`;
    if (expression.startsWith(':stylecell')) return `__DOCX_STYLE_C__${expression.slice(10).trim()}`;
    if (expression.startsWith(':stylerun')) return `__DOCX_STYLE_R__${expression.slice(10).trim()}`;
    if (expression.startsWith(':include')) return `__DOCX_INCLUDE__${expression.slice(8).trim()}`;

    const { cleanName, modifier } = parseModifier(pathPart);
    const resolved = resolveValue(
      data,
      cleanName + (defaultVal !== undefined ? `|${defaultVal}` : '')
    );

    if (isImageConfig(resolved)) return '';

    if (isRaw) {
      if (resolved === null || resolved === undefined) return '';
      return typeof resolved === 'string' ? resolved : String(resolved);
    }

    return applyModifier(valueToString(resolved), modifier);
  }

  extractVariables(template: string): VariableMatch[] {
    this.VAR_RE.lastIndex = 0;
    const matches: VariableMatch[] = [];
    let m: RegExpExecArray | null;
    while ((m = this.VAR_RE.exec(template)) !== null) {
      const expr = m[1].trim();
      if (!this.isBlockOrClosingExpr(expr)) {
        matches.push({ fullMatch: m[0], expression: expr });
      }
    }
    return matches;
  }

  // ---------------------------------------------------------------------------
  // Block Processing
  // ---------------------------------------------------------------------------

  private processBlocks(template: string, data: JsonObject): string {
    const open  = this.options.openDelimiter;
    const close = this.options.closeDelimiter;
    const esc   = this.escapeRegex.bind(this);

    // Matches opening block tags: {{#...}}, {{^...}}, {{-...}}, {{?...}}, {{:something ...}}
    // Must be followed by a non-} and non-/ character so closing tags aren't matched.
    const OPEN_TAG_RE = new RegExp(
      `${esc(open)}([#^\\-?]|:[a-z#%:@~_-]+)([^}]*)${esc(close)}`,
      'g'
    );

    let result = '';
    let pos = 0;

    while (pos < template.length) {
      OPEN_TAG_RE.lastIndex = pos;
      const match = OPEN_TAG_RE.exec(template);

      if (!match) {
        result += template.slice(pos);
        break;
      }

      const matchStart = match.index;
      const fullOpenTag = match[0];
      // Inner content of the tag without delimiters
      const tagInner = (match[1] + match[2]).trim();

      // Skip closing-style tags (they start with /:)
      if (tagInner.startsWith('/')) {
        result += template.slice(pos, matchStart + fullOpenTag.length);
        pos = matchStart + fullOpenTag.length;
        continue;
      }

      // Find matching block prefix (longest match first)
      let prefix = '';
      let path = '';

      for (const p of SORTED_BLOCK_PREFIXES) {
        if (tagInner.startsWith(p.prefix)) {
          prefix = p.prefix;
          path = tagInner.slice(p.prefix.length).trim();
          break;
        }
      }

      // No block prefix matched — treat as literal text and move on
      if (!prefix) {
        result += template.slice(pos, matchStart + fullOpenTag.length);
        pos = matchStart + fullOpenTag.length;
        continue;
      }

      // Everything before this block tag is plain text
      result += template.slice(pos, matchStart);

      // Figure out where the opening tag ends
      const afterOpenTag = matchStart + fullOpenTag.length;

      // Determine the expected closing tag string
      const processorDef = SUPPORTED_PREFIXES[prefix];
      const closeMarker  = processorDef?.closePrefix ?? '/';
      const blockName    = path.split(/\s+/)[0];
      let expectedClose: string;
      if (closeMarker === '/') {
        expectedClose = `${open}/${blockName}${close}`;
      } else if (closeMarker.endsWith('/')) {
        expectedClose = `${open}${closeMarker}${blockName}${close}`;
      } else {
        expectedClose = `${open}${closeMarker}${close}`;
      }

      const blockOpenHint = `${open}${prefix}${blockName}`;
      const { blockContent, endPos } = this.findMatchingEnd(
        template,
        afterOpenTag,
        blockOpenHint,
        expectedClose
      );

      // Resolve the data value for this path
      const value = resolvePath(data, blockName);

      // Dispatch
      if (prefix === '#' || prefix === '-' || prefix === '?') {
        // Unified: Standard Loop / Conditional Exist / Dash Loop
        const isLegacyIf   = path.startsWith('if ');
        const isLegacyEach = path.startsWith('each ');
        const cleanPath    = isLegacyIf ? path.slice(3).trim()
                           : isLegacyEach ? path.slice(5).trim()
                           : blockName;
        const resolved     = (isLegacyIf || isLegacyEach) ? resolvePath(data, cleanPath) : value;

        if (Array.isArray(resolved)) {
          if (this.isInsideOpenTableRow(result)) {
            // Row-loop inside <w:tr> — only DATA rows between markers are repeated
            const { loopResult, nextPos } = this.processRowLoop(
              result, resolved, cleanPath, template, matchStart, endPos, data
            );
            result = loopResult;
            pos = nextPos;
            continue;
          } else {
            result += this.renderLoop(blockContent, resolved, data);
          }
        } else if (isTruthy(resolved as JsonValue)) {
          result += this.process(blockContent, data);
        }

      } else if (prefix === '^') {
        // Inverted: render only if falsy / empty
        const isEmpty = value == null || value === false || value === ''
          || (Array.isArray(value) && (value as any[]).length === 0);
        if (isEmpty) result += this.process(blockContent, data);

      } else if (prefix === ':#grid') {
        // Grid — repeat content for each item in array
        if (Array.isArray(value)) {
          result += this.renderLoop(blockContent, value as any[], data);
        }

      } else {
        // Unknown block prefix — just process inner content
        result += this.process(blockContent, data);
      }

      pos = endPos;
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Row-Loop (repeats <w:tr> for each item)
  // ---------------------------------------------------------------------------

  private processRowLoop(
    currentResult: string,
    items: any[],
    path: string,
    template: string,
    matchStart: number,
    endPos: number,
    data: JsonObject
  ): { loopResult: string; nextPos: number } {
    const CLOSE_TR = '</w:tr>';

    // ── 1. Prefix: everything BEFORE the opening marker <w:tr> ───────────────
    const lastTrIdx = this.findLastUnclosedTrStart(currentResult);
    const outPrefix = currentResult.slice(0, lastTrIdx);

    // ── 2. Skip past the opening marker row ──────────────────────────────────
    // Find first </w:tr> at or after the opening tag position
    const endOfOpenRow = template.indexOf(CLOSE_TR, matchStart);
    if (endOfOpenRow === -1) {
      // No table row — fall back to block loop
      return { loopResult: currentResult + this.renderLoop('', items, data), nextPos: endPos };
    }
    const afterOpenRow = endOfOpenRow + CLOSE_TR.length;

    // ── 3. Find start of closing marker row ──────────────────────────────────
    // Scan the region between the end of open row and {{/items}} for <w:tr> starts.
    // The LAST <w:tr> before {{/items}} is the closing marker row.
    const regionBeforeClose = template.slice(afterOpenRow, endPos);
    const trMatches = [...regionBeforeClose.matchAll(/<w:tr[\s>]/g)];
    const closeRowStart = trMatches.length > 0
      ? afterOpenRow + (trMatches[trMatches.length - 1].index ?? 0)
      : -1; // no data rows between markers

    // ── 4. DATA rows block: between the two marker rows ──────────────────────
    const dataRowsBlock = closeRowStart > afterOpenRow
      ? template.slice(afterOpenRow, closeRowStart)
      : ''; // nothing to repeat if no data rows

    // ── 5. Skip past the closing marker row ──────────────────────────────────
    const endOfCloseRow = template.indexOf(CLOSE_TR, endPos);
    const nextPos = endOfCloseRow !== -1 ? endOfCloseRow + CLOSE_TR.length : endPos;

    // ── 6. Repeat data rows for each item ────────────────────────────────────
    let loopedRows = '';
    for (let i = 0; i < items.length; i++) {
      const ctx: JsonObject = { ...data, ...this.iterData(items[i], i, items.length) };
      loopedRows += this.process(dataRowsBlock, ctx);
    }

    return { loopResult: outPrefix + loopedRows, nextPos };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private renderLoop(content: string, items: any[], data: JsonObject): string {
    let out = '';
    for (let i = 0; i < items.length; i++) {
      out += this.process(content, { ...this.iterData(items[i], i, items.length), ...data,
        '@index': i, '@first': i === 0, '@last': i === items.length - 1,
        ...(items[i] !== null && typeof items[i] === 'object' && !Array.isArray(items[i]) ? items[i] : { '@value': items[i] })
      });
    }
    return out;
  }

  private iterData(item: any, index: number, total: number): JsonObject {
    const d: JsonObject = { '@index': index, '@first': index === 0, '@last': index === total - 1 };
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      Object.assign(d, item as JsonObject);
    } else {
      d['@value'] = item as JsonValue;
    }
    return d;
  }

  // ---------------------------------------------------------------------------
  // Variable Substitution
  // ---------------------------------------------------------------------------

  private processVariables(template: string, data: JsonObject): string {
    this.VAR_RE.lastIndex = 0;
    return template.replace(this.VAR_RE, (_full, expr: string) => {
      const trimmed = expr.trim();
      if (this.isBlockOrClosingExpr(trimmed)) return _full;
      return this.resolveExpression(trimmed, data);
    });
  }

  /** Returns true for expressions that should NOT be resolved as variables */
  private isBlockOrClosingExpr(expr: string): boolean {
    if (expr.startsWith('/') || expr.startsWith('#') || expr.startsWith('^')
        || expr.startsWith('-') || expr.startsWith('?')) return true;
    // ':' prefixes that are NOT style markers
    if (expr.startsWith(':') && !expr.startsWith(':style') && !expr.startsWith(':vt')) return true;
    return false;
  }

  // ---------------------------------------------------------------------------
  // Nesting Validation
  // ---------------------------------------------------------------------------

  private validateNesting(template: string): void {
    const open  = this.options.openDelimiter;
    const close = this.options.closeDelimiter;
    const esc   = this.escapeRegex.bind(this);
    const stack: { prefix: string; name: string; expectedClose: string; pos: number }[] = [];

    const tagRe = new RegExp(
      `${esc(open)}(/[^}]*|[#^\\-?][^}]*|:[a-z#%_@~:-]+[^}]*)${esc(close)}`,
      'g'
    );

    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(template)) !== null) {
      const fullTag = m[0];
      const inner   = m[1].trim();
      if (!inner) continue;

      const isOpening = this.matchOpeningBlockPrefix(inner);
      const isClosing = inner.startsWith('/') || inner.startsWith(':vt/')
        || inner.startsWith(':/grid') || inner.startsWith(':segment/');

      if (isOpening && !isClosing) {
        const { prefix, name, expectedClose } = isOpening;
        stack.push({ prefix, name, expectedClose, pos: m.index });

      } else if (isClosing) {
        if (stack.length === 0) {
          throw new Error(
            `Invalid tag nesting: Found closing tag "${fullTag}" without matching open tag at position ${m.index}.`
          );
        }
        const top = stack.pop()!;
        const closeNorm = inner.replace(/\s+/g, '');
        const ok = closeNorm === top.expectedClose
          || closeNorm === `/${top.name}`
          || closeNorm === '/';

        if (!ok) {
          throw new Error(
            `Invalid tag nesting: Expected "${open}${top.expectedClose}${close}" but found "${fullTag}" ` +
            `closing "${open}${top.prefix}${top.name}${close}" at position ${m.index}.`
          );
        }
      }
    }

    if (stack.length > 0) {
      const top = stack[stack.length - 1];
      throw new Error(
        `Invalid tag nesting: Unclosed block "${open}${top.prefix}${top.name}${close}" at position ${top.pos}.`
      );
    }
  }

  private matchOpeningBlockPrefix(inner: string): { prefix: string; name: string; expectedClose: string } | null {
    for (const p of SORTED_BLOCK_PREFIXES) {
      if (inner.startsWith(p.prefix)) {
        const name = inner.slice(p.prefix.length).trim().split(/\s+/)[0];
        const closeMarker = p.closePrefix ?? '/';
        const expectedClose = closeMarker === '/' ? `/${name}` : `${closeMarker}${name}`;
        return { prefix: p.prefix, name, expectedClose };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // findMatchingEnd — nested-aware block content extractor
  // ---------------------------------------------------------------------------

  private findMatchingEnd(
    template: string,
    startPos: number,
    openTagHint: string,
    closeTag: string
  ): { blockContent: string; endPos: number } {
    let depth = 1;
    let pos   = startPos;

    while (pos < template.length && depth > 0) {
      const nextOpen  = template.indexOf(openTagHint, pos);
      const nextClose = template.indexOf(closeTag, pos);

      if (nextClose === -1) {
        return { blockContent: template.slice(startPos), endPos: template.length };
      }

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + openTagHint.length;
      } else {
        depth--;
        if (depth === 0) {
          return {
            blockContent: template.slice(startPos, nextClose),
            endPos: nextClose + closeTag.length,
          };
        }
        pos = nextClose + closeTag.length;
      }
    }

    return { blockContent: template.slice(startPos), endPos: template.length };
  }

  // ---------------------------------------------------------------------------
  // Table Row helpers
  // ---------------------------------------------------------------------------

  private isInsideOpenTableRow(result: string): boolean {
    return this.findLastUnclosedTrStart(result) !== -1;
  }

  private findLastUnclosedTrStart(result: string): number {
    const trRe = /<w:tr[\s>]/g;
    let lastOpen = -1;
    let m: RegExpExecArray | null;
    while ((m = trRe.exec(result)) !== null) lastOpen = m.index;
    const lastClose = result.lastIndexOf('</w:tr>');
    return (lastOpen > lastClose && lastOpen !== -1) ? lastOpen : -1;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
