/**
 * Utilities for parsing advanced template variables with embedded parameters.
 * e.g., {%image width=150 height=50 center}
 */

import { ImageConfig } from '../interfaces/ImageConfig';

export function parseTemplateParameters(expression: string): {
  cleanName: string;
  inlineConfig: Partial<ImageConfig> & Record<string, string | number | boolean>;
} {
  const parts = expression.trim().split(/\s+/);
  const cleanName = parts[0];
  const inlineConfig: Partial<ImageConfig> & Record<string, string | number | boolean> = {};

  for (let i = 1; i < parts.length; i++) {
    const param = parts[i];
    
    // Check for boolean flags (e.g. "center", "background", "flipX")
    if (!param.includes('=')) {
        if (param === 'center' || param === 'left' || param === 'right') {
            inlineConfig.alignment = param as 'center' | 'left' | 'right';
        } else if (param === 'background') {
            inlineConfig.background = true;
        } else {
            inlineConfig[param] = true;
        }
        continue;
    }

    const [key, valStr] = param.split('=');
    let val: string | number | boolean = valStr;
    
    // Auto-cast types
    if (valStr === 'true') val = true;
    else if (valStr === 'false') val = false;
    else if (!isNaN(Number(valStr))) val = Number(valStr);

    inlineConfig[key] = val;
  }

  return { cleanName, inlineConfig };
}
