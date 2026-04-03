/**
 * DocxEngine
 *
 * Handles DOCX file manipulation:
 * - Unzip/rezip via PizZip
 * - Process word/document.xml through TemplateEngine
 * - Handle image replacement (by ALT text) and insertion
 * - Manage word/_rels/document.xml.rels relationships
 * - Update [Content_Types].xml for new image types
 *
 * All operations are in-memory — no file system access.
 */

import PizZip from 'pizzip';
import type { JsonObject } from '../interfaces/TemplateTypes';
import type { ImageConfig } from '../interfaces/ImageConfig';
import { isImageConfig } from '../interfaces/ImageConfig';
import { TemplateEngine } from './TemplateEngine';
import {
  fetchImageBytesWithMime,
  mimeToExtension,
  detectMimeType,
  pxToEmu,
  generateRelId,
  generateImageFilename,
} from '../utils/imageUtils';
import { resolvePath, escapeXml } from '../utils/objectResolver';

// Default image dimensions if none specified
const DEFAULT_WIDTH_PX = 200;
const DEFAULT_HEIGHT_PX = 200;

interface RelationshipEntry {
  id: string;
  type: string;
  target: string;
}

interface ImageEntry {
  source: string;      // original URL/data-URI — used for de-duplication
  filename: string;
  data: Uint8Array;
  mimeType: string;
  relId: string;
}

export class DocxEngine {
  private readonly engine: TemplateEngine;
  // Global counter so wp:docPr id and pic:cNvPr id are unique across the entire document
  private drawingIdCounter = 1;

  constructor() {
    this.engine = new TemplateEngine({ processImages: true });
  }

  /**
   * Main processing method.
   * Takes a DOCX buffer and JSON data, returns processed DOCX as Uint8Array.
   */
  async process(
    templateBuffer: ArrayBuffer | Uint8Array,
    data: JsonObject
  ): Promise<Uint8Array> {
    // Load DOCX (ZIP)
    const zip = new PizZip(templateBuffer);

    // Extract document.xml and relationships
    let documentXml = this.readZipFile(zip, 'word/document.xml');
    // De-fragment placeholder markers (joins markers split by Word)
    documentXml = this.cleanXml(documentXml);

    const relsXml = this.readZipFile(zip, 'word/_rels/document.xml.rels');
    const contentTypesXml = this.readZipFile(zip, '[Content_Types].xml');

    // Parse existing relationships
    const relationships = this.parseRelationships(relsXml);

    // Initialise drawing ID counter ABOVE the highest existing wp:docPr id in this template
    // so that new inline images never collide with existing ones.
    this.drawingIdCounter = this.nextDrawingId(documentXml);

    // Collect image variables from the data
    const imageVariables = this.collectImageVariables(data);

    // Process images — collect all image entries to embed
    const newImageEntries: ImageEntry[] = [];
    const existingMediaFiles = this.getExistingMediaFiles(zip);

    // Process document XML:
    // Step 1: Insert images first (placeholders {%...%} / {%%...%})
    let processedXml = await this.processImageInsertions(
      documentXml,
      data,
      imageVariables,
      relationships,
      newImageEntries,
      existingMediaFiles,
    );

    // Step 2: Replace existing images by ALT variable placeholders (e.g. alt="{{logo_image}}")
    const { xml: afterReplacements, replacedVarNames } = await this.processImageReplacements(
      processedXml,
      data,
      imageVariables,
      relationships,
      newImageEntries,
      existingMediaFiles
    );

    processedXml = this.finalizeImageAltMetadata(afterReplacements, replacedVarNames, imageVariables);

    // Step 3: Process all remaining text variables
    processedXml = this.engine.process(processedXml, data);

    // Step 4: Strip any leftover internal markers (safety cleanup)
    processedXml = this.stripResidualMarkers(processedXml);

    // Write new image files to zip
    for (const entry of newImageEntries) {
      zip.file(`word/media/${entry.filename}`, entry.data);
    }

    // Update relationships XML
    const updatedRelsXml = this.buildRelationshipsXml(relationships);
    zip.file('word/_rels/document.xml.rels', updatedRelsXml);

    // Update [Content_Types].xml for new image types
    const updatedContentTypes = this.updateContentTypes(
      contentTypesXml,
      newImageEntries
    );
    zip.file('[Content_Types].xml', updatedContentTypes);

    // Write processed document
    zip.file('word/document.xml', processedXml);

    // Generate output
    const output = zip.generate({ type: 'uint8array', compression: 'DEFLATE' });
    return output;
  }

  // ---------------------------------------------------------------------------
  // Image: Replacement (replace existing images by ALT text)
  // ---------------------------------------------------------------------------

  private async processImageReplacements(
    xml: string,
    data: JsonObject,
    imageVars: Map<string, ImageConfig>,
    relationships: RelationshipEntry[],
    newImages: ImageEntry[],
    existingMedia: string[]
  ): Promise<{ xml: string; replacedVarNames: Set<string> }> {
    let result = xml;
    const replacedVarNames = new Set<string>();

    for (const [varName, imageConfig] of imageVars.entries()) {
      // Find all wp:docPr tags and check their name or descr for {{varName}}
      // Use a flexible lookahead to match attributes in any order
      const docPrRe = /<wp:docPr\s+([^>]+)>/g;
      let m: RegExpExecArray | null;
      while ((m = docPrRe.exec(result)) !== null) {
        const attrs = m[1];
        const nameMatch = attrs.match(/name="([^"]+)"/);
        const descrMatch = attrs.match(/descr="([^"]+)"/);

        const nameValue = nameMatch ? nameMatch[1] : '';
        const descrValue = descrMatch ? descrMatch[1] : '';

        // Match the placeholder
        if (nameValue === `{{${varName}}}` || descrValue === `{{${varName}}}`) {
          replacedVarNames.add(varName);

          // Do not mutate docPr right now. Keep placeholder until all insertions are complete,
          // then finalize actual alt text in finalizeImageAltMetadata().

          // Find the relationship ID (r:embed) inside this drawing's XML
          // We look forward from the wp:docPr tag until we find the closing </w:drawing>
          const startSearch = m.index;
          const endSearch = result.indexOf('</w:drawing>', startSearch);
          if (endSearch !== -1) {
            const drawingXml = result.slice(startSearch, endSearch);
            const blipMatch = drawingXml.match(/r:embed="([^"]+)"/);

            if (blipMatch) {
              const relId = blipMatch[1];

              // 1. Update dimensions in the template XML
              result = this.updateImageExtent(
                result,
                relId,
                imageConfig.width ?? DEFAULT_WIDTH_PX,
                imageConfig.height ?? DEFAULT_HEIGHT_PX
              );

              // 2. Load the binary data and add to zip, reusing existing RelId
              await this.loadImageEntry(
                imageConfig,
                newImages,
                existingMedia,
                relationships,
                relId // Reuse existing ID
              );
            }
          }
        }
      }
    }

    return { xml: result, replacedVarNames };
  }

  // ---------------------------------------------------------------------------
  // Image: Finalize alt metadata for replaced images after all insertion is done
  // ---------------------------------------------------------------------------

  private finalizeImageAltMetadata(
    xml: string,
    replacedVarNames: Set<string>,
    imageVars: Map<string, ImageConfig>
  ): string {
    let result = xml;

    for (const varName of replacedVarNames) {
      const imageConfig = imageVars.get(varName);
      const configuredAlt = (imageConfig?.altText ?? '').trim();
      const isPlaceholder = /^\{\{\s*[^\}]+\s*\}\}$/.test(configuredAlt);
      const safeAlt = escapeXml(isPlaceholder || !configuredAlt ? varName : configuredAlt);

      const nameRe = new RegExp(`name="\\{\\{${this.escapeRegex(varName)}\\}\\}"`, 'g');
      const descrRe = new RegExp(`descr="\\{\\{${this.escapeRegex(varName)}\\}\\}"`, 'g');

      result = result.replace(nameRe, `name="${safeAlt}"`);
      result = result.replace(descrRe, `descr="${safeAlt}"`);
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Image: Insertion (replace text {{varName}} with inline image drawing)
  // ---------------------------------------------------------------------------

  private async processImageInsertions(
    xml: string,
    data: JsonObject,
    imageVars: Map<string, ImageConfig>,
    relationships: RelationshipEntry[],
    newImages: ImageEntry[],
    existingMedia: string[],
    skipVarNames: Set<string> = new Set()
  ): Promise<string> {
    if (imageVars.size === 0) return xml;

    let result = xml;
    
    // -- Dynamic {%image params...} Extraction --
    const open = this.engine.options.openDelimiter;
    const close = this.engine.options.closeDelimiter;
    const imgRegex = new RegExp(`${this.escapeRegex(open)}(%%?)([^}]+?)${this.escapeRegex(close)}`, 'g');
    let match: RegExpExecArray | null;
    
    while ((match = imgRegex.exec(result)) !== null) {
       const isBlock = match[1] === '%%';
       const expression = match[2];
       const parts = expression.trim().split(/\\s+/);
       const cleanName = parts[0];
       
       // Allow insertion even if already replaced
       
       const baseConfig = imageVars.get(cleanName);
       if (!baseConfig) continue; // Skip if no JSON object matches name
       
       const inlineConfig: any = {};
       for (let i = 1; i < parts.length; i++) {
           if (!parts[i].includes('=')) { inlineConfig[parts[i]] = true; continue; }
           const [k, v] = parts[i].split('=');
           inlineConfig[k] = isNaN(Number(v)) ? (v === 'true' ? true : v === 'false' ? false : v) : Number(v);
       }
       
       const mergedConfig: ImageConfig = { ...baseConfig, ...inlineConfig };
       
       const entry = await this.loadImageEntry(mergedConfig, newImages, existingMedia, relationships);
       const width  = mergedConfig.width  ?? DEFAULT_WIDTH_PX;
       const height = mergedConfig.height ?? DEFAULT_HEIGHT_PX;
       const rawDrawing = this.buildDrawingXml(entry.relId, mergedConfig.name || cleanName, width, height, mergedConfig);
       
       const esc = this.escapeRegex(match[0]); // match[0] is literal {%image width=100}
       
       const soloRunRe = new RegExp(`(<w:r(?:\\s[^>]*)?>)((?:<w:rPr>[\\s\\S]*?</w:rPr>)?)<w:t(?:[^>]*)?>\\s*${esc}\\s*</w:t></w:r>`, 'g');
       const afterCase1 = result.replace(soloRunRe, `$1$2${rawDrawing}</w:r>`);
       
       const mixedRe = new RegExp(`(<w:r(?:\\s[^>]*)?>)((?:<w:rPr>[\\s\\S]*?</w:rPr>)?)<w:t(?:[^>]*)?>([\\s\\S]*?)${esc}([\\s\\S]*?)</w:t></w:r>`, 'g');
       result = afterCase1.replace(mixedRe, (m, rTag, rPr, textBefore, textAfter) => {
          const before = textBefore ? `${rTag}${rPr}<w:t xml:space="preserve">${textBefore}</w:t></w:r>` : '';
          const drawing = `${rTag}${rPr}${rawDrawing}</w:r>`;
          const after = textAfter ? `${rTag}${rPr}<w:t xml:space="preserve">${textAfter}</w:t></w:r>` : '';
          return before + drawing + after;
       });
       
       // Processed
    }
    
    // Legacy {{image}} fallback removed to enforce explicit syntax:
    //   {{%image}} / {{%%image}}.
    // Non-matching variables are kept as text and not converted.

    // keep existing result unchanged
    return result;
  }

  // ---------------------------------------------------------------------------
  // Image: Build OOXML drawing element
  // ---------------------------------------------------------------------------

  private buildDrawingXml(
    relId: string,
    altText: string,
    widthPx: number,
    heightPx: number,
    config?: import('../interfaces/ImageConfig.js').ImageConfig
  ): string {
    const cx = pxToEmu(widthPx);
    const cy = pxToEmu(heightPx);
    // Use a globally incrementing counter to guarantee unique IDs per document
    const numId = String(this.drawingIdCounter++);
    // Escape altText for XML metadata
    const escAlt = escapeXml(altText);

    // Transform properties
    const rot = config?.rotation ? ` rot="${Math.round(config.rotation * 60000)}"` : '';
    const flipH = config?.flipX ? ' flipH="1"' : '';
    const flipV = config?.flipY ? ' flipV="1"' : '';
    
    // Border properties
    let lnXml = '<a:noFill/>';
    if (config?.border) {
        const color = config.border.color || '000000';
        const w = (config.border.size || 1) * 12700; // default 1pt
        const prstDash = config.border.style === 'dashed' ? 'dash' : config.border.style === 'dotted' ? 'dot' : 'solid';
        lnXml = `<a:ln w="${w}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:prstDash val="${prstDash}"/></a:ln>`;
    }

    const isFloating = config?.alignment || config?.background;
    
    let wrapperStart = `<wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">`;
    let wrapperEnd = `</wp:inline>`;
    
    if (isFloating) {
        const behind = config?.background ? '1' : '0';
        let alignH = '<wp:align>left</wp:align>';
        if (config?.alignment === 'center') alignH = '<wp:align>center</wp:align>';
        else if (config?.alignment === 'right') alignH = '<wp:align>right</wp:align>';
        
        wrapperStart = `<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251658240" behindDoc="${behind}" locked="0" layoutInCell="1" allowOverlap="1" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
                       `<wp:simplePos x="0" y="0"/>` +
                       `<wp:positionH relativeFrom="column">${alignH}</wp:positionH>` +
                       `<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>`;
        wrapperEnd = `</wp:anchor>`;
    }

    // Hyperlink handling (Needs a separate relationship in rels XML, here we just attach the skeleton)
    const linkXml = config?.link ? `<a:hlinkClick r:id="${config.link}_skipRelId" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>` : '';

    return `<w:drawing>` +
      wrapperStart +
      `<wp:extent cx="${cx}" cy="${cy}"/>` +
      `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
      `<wp:wrapNone/>` + // Needed for anchor to prevent text wrapping issues
      `<wp:docPr id="${numId}" name="${escAlt}" descr="${escAlt}">${linkXml}</wp:docPr>` +
      `<wp:cNvGraphicFramePr>` +
      `<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>` +
      `</wp:cNvGraphicFramePr>` +
      `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
      `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:nvPicPr>` +
      `<pic:cNvPr id="${numId}" name="${escAlt}"/>` +
      `<pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr>` +
      `</pic:nvPicPr>` +
      `<pic:blipFill>` +
      `<a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>` +
      `<a:stretch><a:fillRect/></a:stretch>` +
      `</pic:blipFill>` +
      `<pic:spPr bwMode="auto">` +
      `<a:xfrm${rot}${flipH}${flipV}><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
      `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
      lnXml +
      `</pic:spPr>` +
      `</pic:pic>` +
      `</a:graphicData>` +
      `</a:graphic>` +
      wrapperEnd +
      `</w:drawing>`;
  }

  // ---------------------------------------------------------------------------
  // Image: Update existing image dimensions
  // ---------------------------------------------------------------------------

  private updateImageExtent(
    xml: string,
    relId: string,
    widthPx: number,
    heightPx: number
  ): string {
    const cx = pxToEmu(widthPx);
    const cy = pxToEmu(heightPx);

    // Find the drawing containing this relId and update its extent
    const embedRe = new RegExp(`r:embed="${this.escapeRegex(relId)}"`, 'g');
    let match: RegExpExecArray | null;
    let result = xml;

    while ((match = embedRe.exec(xml)) !== null) {
      // Find the <wp:extent> before this embed within the same drawing
      const searchBefore = xml.lastIndexOf('<wp:extent', match.index);
      if (searchBefore !== -1) {
        const extentEnd = xml.indexOf('/>', searchBefore);
        if (extentEnd !== -1) {
          const oldExtent = xml.slice(searchBefore, extentEnd + 2);
          const newExtent = `<wp:extent cx="${cx}" cy="${cy}"/>`;
          result = result.replace(oldExtent, newExtent);
        }
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Helpers: Load image and register in zip
  // ---------------------------------------------------------------------------

  private async loadImageEntry(
    config: ImageConfig,
    newImages: ImageEntry[],
    existingMedia: string[],
    relationships: RelationshipEntry[],
    explicitRelId?: string
  ): Promise<ImageEntry> {
    // If we're repeating a replacement of the exact same source, it might already be in newImages
    const existing = newImages.find((e) => e.source === config.source);
    if (existing) {
      // If we were given an explicit relId, ensure it's recorded in the relationships
      if (explicitRelId) {
        const rel = relationships.find(r => r.id === explicitRelId);
        if (rel) {
          rel.target = `media/${existing.filename}`;
        } else {
          relationships.push({
            id: explicitRelId,
            type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
            target: `media/${existing.filename}`,
          });
        }
      }
      return existing;
    }

    const { bytes: imageBytes, mimeType: detectedMime } = await fetchImageBytesWithMime(config.source);
    const mimeType = config.mimeType ?? detectedMime ?? detectMimeType(config.source);
    const rawExt = mimeToExtension(mimeType);
    const ext = rawExt === 'bin' ? 'jpg' : rawExt;

    const allMediaFilenames = [
      ...existingMedia,
      ...newImages.map((e) => e.filename),
    ];
    const filename = generateImageFilename(ext, allMediaFilenames);

    // Reuse explicit RelId if provided, otherwise generate a new one
    let relId: string;
    if (explicitRelId) {
      relId = explicitRelId;
      // Ensure it's not present or update it
      const existingRel = relationships.find(r => r.id === relId);
      if (existingRel) {
        existingRel.target = `media/${filename}`;
      } else {
        relationships.push({
          id: relId,
          type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
          target: `media/${filename}`,
        });
      }
    } else {
      const allRelIds = relationships.map((r) => r.id);
      relId = generateRelId('rId', allRelIds);
      relationships.push({
        id: relId,
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
        target: `media/${filename}`,
      });
    }

    const entry: ImageEntry = {
      source: config.source,
      filename,
      data: imageBytes,
      mimeType,
      relId,
    };

    newImages.push(entry);
    return entry;
  }

  // ---------------------------------------------------------------------------
  // Helpers: Relationships
  // ---------------------------------------------------------------------------

  private parseRelationships(relsXml: string): RelationshipEntry[] {
    const entries: RelationshipEntry[] = [];
    const relRe = /<Relationship\s[^>]*Id="([^"]*)"[^>]*Type="([^"]*)"[^>]*Target="([^"]*)"[^>]*\/?>/g;
    let match: RegExpExecArray | null;

    while ((match = relRe.exec(relsXml)) !== null) {
      entries.push({ id: match[1], type: match[2], target: match[3] });
    }

    return entries;
  }

  private buildRelationshipsXml(relationships: RelationshipEntry[]): string {
    const rels = relationships
      .map(
        (r) =>
          `  <Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
      `${rels}\n` +
      `</Relationships>`;
  }

  private updateContentTypes(xml: string, newImages: ImageEntry[]): string {
    // Collect unique extensions not already present
    const existingExts = new Set<string>();
    const extRe = /<Default Extension="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = extRe.exec(xml)) !== null) {
      existingExts.add(m[1].toLowerCase());
    }

    const newEntries: string[] = [];
    for (const img of newImages) {
      const ext = mimeToExtension(img.mimeType);
      if (!existingExts.has(ext)) {
        newEntries.push(
          `<Default Extension="${ext}" ContentType="${img.mimeType}"/>`
        );
        existingExts.add(ext);
      }
    }

    if (newEntries.length === 0) return xml;

    // Insert before closing </Types>
    return xml.replace(
      '</Types>',
      `${newEntries.join('\n')}\n</Types>`
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers: Find relationship ID near a drawing element
  // ---------------------------------------------------------------------------

  private findRelIdForDrawingNear(xml: string, pos: number): string | null {
    // Look backwards for <a:blip r:embed="rIdX"/> or forwards
    const searchRange = xml.slice(Math.max(0, pos - 2000), pos + 2000);
    const embedRe = /r:embed="(rId\d+)"/g;
    let match: RegExpExecArray | null;
    let lastMatch: string | null = null;

    while ((match = embedRe.exec(searchRange)) !== null) {
      lastMatch = match[1];
    }

    return lastMatch;
  }

  // ---------------------------------------------------------------------------
  // Helpers: Collect image variables from data
  // ---------------------------------------------------------------------------

  private collectImageVariables(data: JsonObject): Map<string, ImageConfig> {
    const map = new Map<string, ImageConfig>();
    this.collectFromObject(data, '', map);
    return map;
  }

  private collectFromObject(
    obj: JsonObject,
    prefix: string,
    map: Map<string, ImageConfig>
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (isImageConfig(value)) {
        map.set(key, value); // Short name (e.g., "profile_image")
        if (prefix) map.set(fullKey, value); // Full path (e.g., "user.profile_image")
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        this.collectFromObject(value as JsonObject, fullKey, map);
      }
    }
  }

  /**
   * Strip any leftover internal markers that weren't consumed by the engine.
   * Safe: only removes known marker tokens, never modifies XML structure.
   */
  private stripResidualMarkers(xml: string): string {
    return xml
      .replace(/__DOCX_STYLE_[PCR]__[^<}]*/g, '')
      .replace(/__DOCX_INCLUDE__[^<}]*/g, '')
      .replace(/__DOCX_DELETE_P__/g, '');
  }

  // ---------------------------------------------------------------------------
  // Helpers: ZIP utilities
  // ---------------------------------------------------------------------------

  private readZipFile(zip: PizZip, path: string): string {
    const file = zip.file(path);
    if (!file) {
      throw new Error(`DOCX missing required file: ${path}`);
    }
    return file.asText();
  }

  private getExistingMediaFiles(zip: PizZip): string[] {
    // PizZip.filter returns array of ZipObject matching predicate
    const mediaFiles = (zip as unknown as { filter: (fn: (path: string) => boolean) => Array<{ name: string }> })
      .filter((relativePath: string) => relativePath.startsWith('word/media/'));
    return mediaFiles.map((f) => f.name.replace('word/media/', ''));
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Scan the template XML for existing wp:docPr id attributes and return
   * max(existing) + 1, so newly inserted drawings never share an ID with
   * drawings that were already present in the template.
   */
  private nextDrawingId(xml: string): number {
    let max = 0;
    const idRe = /wp:docPr\s+id="(\d+)"/g;
    let m: RegExpExecArray | null;
    while ((m = idRe.exec(xml)) !== null) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
    return max + 1;
  }

  /**
   * De-fragment XML content by joining text that MS Word has split across
   * multiple runs/tags due to spellcheck (proofErr), formatting, etc.
   * This ensures markers like {{name}} are seen as a single string.
   */
  private cleanXml(xml: string): string {
    let result = xml;

    // 1. Noise Removal: Strip known visual noise globally (safe)
    result = result.replace(/<w:proofErr[^>]*\/>/g, '');

    // 2. Define the GAP: Matches anything between </w:t> and <w:t> 
    // that stays within the same text layer (doesn't cross p, tbl, tr, or tc).
    // This allows bridging across w:r, w:rPr (styling), w:lang, etc.
    const GAP = '<\\/w:t>(?:(?!<w:p[\\s>]|<w:tbl[\\s>]|<w:tr[\\s>]|<w:tc[\\s>])[\\s\\S])*?<w:t(?:\\s[^>]*)?>';
    
    const openDelim  = this.engine.options.openDelimiter;
    const closeDelim = this.engine.options.closeDelimiter;

    if (openDelim === '{{' && closeDelim === '}}') {
      // Repair split delimiters: { [GAP] {  ->  {{
      result = result.replace(new RegExp(`\\{${GAP}\\{`, 'g'), '{{');
      result = result.replace(new RegExp(`\\}${GAP}\\}`, 'g'), '}}');
      
      // Marker-Vacuum Algorithm:
      // We "vacuum" up all GAPs that exist between an open delimiter and its next close delimiter.
      // This is run in a loop to handle markers fragmented into many pieces (Word's specialty).
      for (let i = 0; i < 20; i++) {
        const open  = this.escapeRegex(openDelim);
        const close = this.escapeRegex(closeDelim);
        
        // Match: (MarkerStart + Content) + (RunGAP)
        // Content must not cross into another marker or structural boundary.
        const vacuumRe = new RegExp(`(${open}(?:(?!${open}|${close}|<w:p[\\s>]|<w:tbl[\\s>]|<w:tr[\\s>]|<w:tc[\\s>])[\\s\\S])*?)${GAP}`, 'g');
        const next = result.replace(vacuumRe, '$1');
        if (next === result) break;
        result = next;
      }
    }

    return result;
  }
}
