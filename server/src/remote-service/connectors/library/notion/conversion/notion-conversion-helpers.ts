/**
 * Escapes HTML special characters and preserves spaces
 */
export function escapeHtmlAndSpaces(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/ /g, '&nbsp;');
}

/**
 * Unescapes safe spaces in HTML (those not in tags)
 */
export function unescapeSafeSpacesInHtml(html: string): string {
  return html.replace(/&nbsp;/g, ' ');
}

/**
 * Checks if a tag is a block-level HTML element
 */
export function isHtmlBlockLevelTag(tagName: string): boolean {
  const blockLevelTags = [
    'address',
    'article',
    'aside',
    'blockquote',
    'details',
    'dialog',
    'dd',
    'div',
    'dl',
    'dt',
    'fieldset',
    'figcaption',
    'figure',
    'footer',
    'form',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'hgroup',
    'hr',
    'li',
    'main',
    'nav',
    'ol',
    'p',
    'pre',
    'section',
    'table',
    'ul',
  ];
  return blockLevelTags.includes(tagName);
}
