import TurndownService from 'turndown';

export type { TurndownService };

export interface TurndownOptions {
  /**
   * When true, adds a rule to preserve img tags as HTML instead of converting to ![alt](src).
   * This preserves width, height, and custom data attributes.
   * @default false
   */
  preserveImageAttributes?: boolean;
}

/**
 * Creates a configured TurndownService for converting HTML to Markdown.
 *
 * This wrapper provides consistent configuration across the application and fixes
 * the default TurndownService behavior of escaping periods after numbers (e.g., "1." → "1\.").
 *
 * The default escaping is overly aggressive - it escapes periods everywhere to prevent
 * ordered list interpretation, but this is unnecessary inside headings where the ## marker
 * takes precedence. For example, `<h2>1. Introduction</h2>` should become `## 1. Introduction`,
 * not `## 1\. Introduction`.
 *
 * @see https://www.npmjs.com/package/turndown#overriding-turndownserviceprototypeescape
 */
export function createTurndownService(options?: TurndownOptions): TurndownService {
  const turndownService = new TurndownService({ headingStyle: 'atx' });

  // Override default escape to not escape periods after numbers.
  // This is the exact TurndownService default escapes array, minus the last rule:
  //   [/^(\d+)\. /g, '$1\\. ']  // numbered list escape - REMOVED
  // See: node_modules/turndown/lib/turndown.cjs.js lines 707-721
  turndownService.escape = function (string: string) {
    const escapes: Array<[RegExp, string]> = [
      [/\\/g, '\\\\'],
      [/\*/g, '\\*'],
      [/^-/g, '\\-'],
      [/^\+ /g, '\\+ '],
      [/^(=+)/g, '\\$1'],
      [/^(#{1,6}) /g, '\\$1 '],
      [/`/g, '\\`'],
      [/^~~~/g, '\\~~~'],
      [/\[/g, '\\['],
      [/\]/g, '\\]'],
      [/^>/g, '\\>'],
      [/_/g, '\\_'],
      // REMOVED: [/^(\d+)\. /g, '$1\\. '] - unnecessary period escaping
    ];
    return escapes.reduce((acc, [regex, replacement]) => {
      return acc.replace(regex, replacement);
    }, string);
  };

  if (options?.preserveImageAttributes) {
    // Add rule to preserve img tags as HTML instead of converting to ![alt](src).
    // Standard Markdown image syntax doesn't support width/height attributes.
    // This keeps <img> tags as raw HTML in Markdown, which is valid and
    // preserves all attributes (width, height, data-wix-container, etc.).
    turndownService.addRule('preserveImages', {
      filter: 'img',
      replacement: function (_content, node: HTMLElement) {
        const element = node;
        const src = element.getAttribute('src') ?? '';
        const alt = element.getAttribute('alt');
        const width = element.getAttribute('width');
        const height = element.getAttribute('height');
        const dataWixContainer = element.getAttribute('data-wix-container');

        const attrs: string[] = [`src="${src}"`];

        if (alt) {
          attrs.push(`alt="${alt}"`);
        }
        if (width) {
          attrs.push(`width="${width}"`);
        }
        if (height) {
          attrs.push(`height="${height}"`);
        }
        if (dataWixContainer) {
          // Use single quotes for the attribute value since it contains JSON with double quotes
          attrs.push(`data-wix-container='${dataWixContainer}'`);
        }

        return `<img ${attrs.join(' ')}>`;
      },
    });
  }

  return turndownService;
}
