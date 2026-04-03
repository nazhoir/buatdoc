import { JsonObject, JsonValue } from '../interfaces/TemplateTypes';

/**
 * Registry of supported Template Prefixes and their associated behaviors.
 */
export interface PrefixProcessor {
    /** The symbol used to identify the tag (e.g. '^', '-', '%') */
    prefix: string;
    /** Is this a block tag that requires a closing delimiter? */
    isBlock: boolean;
    /** Default expected closing prefix if it's a block. If empty, uses '/' + name */
    closePrefix?: string;
    /** Human readable name of the feature */
    name: string;
    /** Processor function */
    handler?: (content: string, data: JsonObject, innerVars?: string) => string;
}

export const SUPPORTED_PREFIXES: Record<string, PrefixProcessor> = {
    // Standard and Control Loops
    '#': { prefix: '#', isBlock: true, closePrefix: '/', name: 'Standard Loop' },
    '^': { prefix: '^', isBlock: true, closePrefix: '/', name: 'Inverted Loop' },
    '-': { prefix: '-', isBlock: true, closePrefix: '/', name: 'Dash Run Loop' },
    
    // Formatting and Document Sections
    '@': { prefix: '@', isBlock: false, name: 'Raw XML' },
    'r@': { prefix: 'r@', isBlock: false, name: 'Raw XML Run Level' },
    '=': { prefix: '=', isBlock: false, name: 'Change Delimiter' },
    
    // Media & External Content
    '$': { prefix: '$', isBlock: false, name: 'Chart Injection' },
    '%': { prefix: '%', isBlock: false, name: 'Inline Image' },
    '%%': { prefix: '%%', isBlock: false, name: 'Block Image' },
    '~': { prefix: '~', isBlock: false, name: 'Inline HTML' },
    '~~': { prefix: '~~', isBlock: false, name: 'Block HTML' },
    
    // Subtemplates & Parts
    ':include': { prefix: ':include', isBlock: false, name: 'Include Document' },
    ':segment': { prefix: ':segment', isBlock: true, closePrefix: ':segment/', name: 'Segment Definition' },
    ':includesegment': { prefix: ':includesegment', isBlock: false, name: 'Include Subsegment' },
    ':subsection': { prefix: ':subsection', isBlock: false, name: 'Override Subsection' },
    ':replacesection': { prefix: ':replacesection', isBlock: false, name: 'Replace Section' },
    '?': { prefix: '?', isBlock: true, closePrefix: '/', name: 'Conditional Exist Loop' },
    ':footnote': { prefix: ':footnote', isBlock: false, name: 'Insert Footnote' },
    
    // Table & Grids
    ':stylecell': { prefix: ':stylecell', isBlock: false, name: 'Style Cell' },
    ':stylepar': { prefix: ':stylepar', isBlock: false, name: 'Style Paragraph' },
    ':stylerun': { prefix: ':stylerun', isBlock: false, name: 'Style Text Run' },
    '::stylerun': { prefix: '::stylerun', isBlock: false, name: 'Global Style Run' },
    ':stylebullets': { prefix: ':stylebullets', isBlock: false, name: 'Style Bullets' },
    ':stylerow': { prefix: ':stylerow', isBlock: false, name: 'Style Table Row' },
    ':table': { prefix: ':table', isBlock: false, name: 'Generate Table' },
    ':#1': { prefix: ':#1', isBlock: false, name: 'Grid Static Loop' },
    ':#grid': { prefix: ':#grid', isBlock: true, closePrefix: ':/grid', name: 'Flexible Grid Loop' },
    ':vt#': { prefix: ':vt#', isBlock: true, closePrefix: ':vt/', name: 'Vertical Table Loop' },
    ':merge-cells-col': { prefix: ':merge-cells-col', isBlock: false, name: 'Column Cell Merge' }
};

/**
 * Finds the matching prefix handler based on the expression string
 */
export function matchPrefix(expression: string): { processor: PrefixProcessor; payload: string } | null {
    // Sort prefixes by length to prevent partial matches (e.g. %% vs %)
    const sortedPrefixes = Object.keys(SUPPORTED_PREFIXES).sort((a, b) => b.length - a.length);
    for (const prefix of sortedPrefixes) {
        if (expression.startsWith(prefix)) {
            return {
                processor: SUPPORTED_PREFIXES[prefix],
                payload: expression.slice(prefix.length).trim()
            };
        }
    }
    return null;
}
