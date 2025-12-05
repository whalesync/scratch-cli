import MarkdownIt from 'markdown-it';
import { createTurndownService } from 'src/wrappers/turndown';

// Re-export for backward compatibility
export { createTurndownService };

/**
 * Creates a TurndownService configured for Wix content with image preservation.
 */
export function createWixTurndownService() {
  return createTurndownService({ preserveImageAttributes: true });
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
  const turndown = createWixTurndownService();
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
