import MarkdownIt from 'markdown-it';
import TurndownService from 'turndown';

/**
 * Creates a configured TurndownService that preserves image dimensions and metadata.
 *
 * Standard Markdown image syntax ![alt](src) doesn't support width/height attributes.
 * This configuration keeps <img> tags as raw HTML in Markdown, which is valid and
 * preserves all attributes (width, height, data-wix-container, etc.).
 */
export function createTurndownService(): TurndownService {
  const turndownService = new TurndownService({ headingStyle: 'atx' });

  // Add rule to preserve img tags as HTML instead of converting to ![alt](src)
  turndownService.addRule('preserveImages', {
    filter: 'img',
    replacement: function (content, node) {
      // TurndownService's node type is HTMLElement, we need to access attributes
      const element = node;
      const src = element.getAttribute('src') ?? '';
      const alt = element.getAttribute('alt');
      const width = element.getAttribute('width');
      const height = element.getAttribute('height');
      const dataWixContainer = element.getAttribute('data-wix-container');

      // Build attributes string
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

  return turndownService;
}

/**
 * Creates a configured MarkdownIt parser that allows HTML tags.
 *
 * This is necessary to parse the <img> tags that we preserve in Markdown.
 */
export function createMarkdownParser(): MarkdownIt {
  return new MarkdownIt({
    html: true, // Enable HTML tags in source
  });
}

/**
 * Converts HTML to Markdown while preserving image dimensions and Wix metadata.
 *
 * @param html - HTML string to convert
 * @returns Markdown string with images preserved as HTML tags
 */
export function htmlToMarkdown(html: string): string {
  const turndown = createTurndownService();
  return turndown.turndown(html);
}

/**
 * Converts Markdown to HTML, parsing any embedded HTML tags.
 *
 * @param markdown - Markdown string (may contain HTML img tags)
 * @returns HTML string
 */
export function markdownToHtml(markdown: string): string {
  const md = createMarkdownParser();
  return md.render(markdown);
}
