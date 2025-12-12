import MarkdownIt from 'markdown-it';
import { ConvertedNotionBlock, RichTextItemWithResponseFields } from './notion-rich-text-push-types';

/**
 * Direct Markdown to Notion converter that parses markdown tokens
 * without going through HTML as an intermediary.
 */
export class MarkdownToNotionConverter {
  private md: MarkdownIt;

  constructor() {
    this.md = new MarkdownIt({
      html: true, // Allow HTML tags in markdown
    });
  }

  /**
   * Converts markdown string to Notion blocks.
   */
  convert(markdown: string): ConvertedNotionBlock[] {
    const tokens = this.md.parse(markdown, {});
    return this.convertTokens(tokens);
  }

  private convertTokens(tokens: MarkdownIt.Token[], startIndex = 0, endIndex?: number): ConvertedNotionBlock[] {
    const blocks: ConvertedNotionBlock[] = [];
    const end = endIndex ?? tokens.length;

    for (let i = startIndex; i < end; i++) {
      const token = tokens[i];

      // Skip closing tokens and inline tokens (handled by their parent)
      if (token.type.endsWith('_close') || token.type === 'inline') {
        continue;
      }

      const result = this.convertToken(token, tokens, i);
      if (result.block) {
        blocks.push(result.block);
      }
      // Add multiple blocks if returned
      if (result.blocks && result.blocks.length > 0) {
        blocks.push(...result.blocks);
      }
      // Skip ahead by the number of tokens consumed
      i += result.tokensConsumed;
    }

    return blocks;
  }

  private convertToken(
    token: MarkdownIt.Token,
    allTokens: MarkdownIt.Token[],
    currentIndex: number,
  ): { block: ConvertedNotionBlock | null; blocks?: ConvertedNotionBlock[]; tokensConsumed: number } {
    switch (token.type) {
      case 'heading_open': {
        const level = parseInt(token.tag.substring(1)); // h1 -> 1, h2 -> 2, etc.
        const inlineToken = allTokens[currentIndex + 1];
        const richText = this.convertInlineContent(inlineToken);

        let block: ConvertedNotionBlock;
        if (level === 1) {
          block = this.createHeadingBlock('heading_1', richText);
        } else if (level === 2) {
          block = this.createHeadingBlock('heading_2', richText);
        } else if (level === 3) {
          block = this.createHeadingBlock('heading_3', richText);
        } else {
          // h4, h5, h6 -> convert to paragraph
          block = this.createParagraphBlock(richText);
        }
        // heading_open, inline, heading_close = 3 tokens, we return after processing first, skip next 2
        return { block, tokensConsumed: 2 };
      }

      case 'paragraph_open': {
        const inlineToken = allTokens[currentIndex + 1];

        // Check if this paragraph contains only an image - if so, create image block instead
        if (inlineToken && inlineToken.children && inlineToken.children.length === 1) {
          const child = inlineToken.children[0];
          if (child.type === 'image') {
            const src = child.attrGet('src') || '';
            const alt = child.attrGet('alt') || '';
            // Get the text content from image's children for caption
            const caption = child.children && child.children[0] ? child.children[0].content : alt;

            const block: ConvertedNotionBlock = {
              object: 'block',
              type: 'image',
              has_children: false,
              image: {
                type: 'external',
                external: { url: src },
                caption: caption
                  ? [
                      {
                        type: 'text',
                        text: { content: caption, link: null },
                        annotations: {
                          bold: false,
                          italic: false,
                          strikethrough: false,
                          underline: false,
                          code: false,
                          color: 'default',
                        },
                        plain_text: caption,
                        href: null,
                      },
                    ]
                  : [],
              },
            };
            return { block, tokensConsumed: 2 };
          }
        }

        const richText = this.convertInlineContent(inlineToken);
        const block = this.createParagraphBlock(richText);
        // paragraph_open, inline, paragraph_close = 3 tokens, skip next 2
        return { block, tokensConsumed: 2 };
      }

      case 'bullet_list_open': {
        // Find the matching close token
        let depth = 1;
        let closeIndex = currentIndex + 1;
        while (closeIndex < allTokens.length && depth > 0) {
          if (allTokens[closeIndex].type === 'bullet_list_open') depth++;
          if (allTokens[closeIndex].type === 'bullet_list_close') depth--;
          closeIndex++;
        }

        // Process all list items within this list
        const itemBlocks: ConvertedNotionBlock[] = [];
        for (let i = currentIndex + 1; i < closeIndex - 1; i++) {
          const t = allTokens[i];
          if (t.type === 'list_item_open') {
            // Find matching close for this item
            let itemCloseIndex = i + 1;
            let itemDepth = 1;
            while (itemCloseIndex < closeIndex && itemDepth > 0) {
              if (allTokens[itemCloseIndex].type === 'list_item_open') itemDepth++;
              if (allTokens[itemCloseIndex].type === 'list_item_close') itemDepth--;
              itemCloseIndex++;
            }

            const itemTokens = allTokens.slice(i + 1, itemCloseIndex - 1);
            const item = this.convertListItem(itemTokens, 'bulleted');
            if (item) {
              itemBlocks.push(item);
            }
            i = itemCloseIndex - 1; // Skip to end of this item
          }
        }

        // Return all list items
        return { block: null, blocks: itemBlocks, tokensConsumed: closeIndex - currentIndex - 1 };
      }

      case 'ordered_list_open': {
        // Find the matching close token
        let depth = 1;
        let closeIndex = currentIndex + 1;
        while (closeIndex < allTokens.length && depth > 0) {
          if (allTokens[closeIndex].type === 'ordered_list_open') depth++;
          if (allTokens[closeIndex].type === 'ordered_list_close') depth--;
          closeIndex++;
        }

        // Process all list items
        const itemBlocks: ConvertedNotionBlock[] = [];
        for (let i = currentIndex + 1; i < closeIndex - 1; i++) {
          const t = allTokens[i];
          if (t.type === 'list_item_open') {
            let itemCloseIndex = i + 1;
            let itemDepth = 1;
            while (itemCloseIndex < closeIndex && itemDepth > 0) {
              if (allTokens[itemCloseIndex].type === 'list_item_open') itemDepth++;
              if (allTokens[itemCloseIndex].type === 'list_item_close') itemDepth--;
              itemCloseIndex++;
            }

            const itemTokens = allTokens.slice(i + 1, itemCloseIndex - 1);
            const item = this.convertListItem(itemTokens, 'numbered');
            if (item) {
              itemBlocks.push(item);
            }
            i = itemCloseIndex - 1;
          }
        }

        return { block: null, blocks: itemBlocks, tokensConsumed: closeIndex - currentIndex - 1 };
      }

      case 'blockquote_open': {
        // Find matching close
        let closeIndex = currentIndex + 1;
        let depth = 1;
        while (closeIndex < allTokens.length && depth > 0) {
          if (allTokens[closeIndex].type === 'blockquote_open') depth++;
          if (allTokens[closeIndex].type === 'blockquote_close') depth--;
          closeIndex++;
        }

        // Extract only the inline content, skip paragraph wrappers
        const contentTokens = allTokens.slice(currentIndex + 1, closeIndex - 1);
        const inlineTokens = contentTokens.filter((t) => t.type === 'inline');

        const richText: typeof this.createEmptyText extends () => infer T ? T[] : never = [];
        for (const inlineToken of inlineTokens) {
          richText.push(...this.convertInlineContent(inlineToken));
        }

        const block = {
          object: 'block',
          type: 'quote',
          has_children: false,
          quote: {
            rich_text: richText.length > 0 ? richText : [this.createEmptyText()],
            color: 'default',
          },
        } as ConvertedNotionBlock;

        // Skip all tokens within the blockquote
        return { block, tokensConsumed: closeIndex - currentIndex - 1 };
      }

      case 'fence':
      case 'code_block': {
        const code = token.content;
        const language = token.info || 'plain text';

        const block = {
          object: 'block',
          type: 'code',
          has_children: false,
          code: {
            rich_text: [
              {
                type: 'text',
                text: { content: code, link: null },
                annotations: {
                  bold: false,
                  italic: false,
                  strikethrough: false,
                  underline: false,
                  code: false,
                  color: 'default',
                },
                plain_text: code,
                href: null,
              },
            ],
            language,
            caption: [],
          },
        } as ConvertedNotionBlock;

        return { block, tokensConsumed: 0 };
      }

      case 'hr': {
        const block = {
          object: 'block',
          type: 'divider',
          has_children: false,
          divider: {},
        } as ConvertedNotionBlock;

        return { block, tokensConsumed: 0 };
      }

      case 'html_block': {
        // Try to parse special HTML blocks we generate (callouts, toggles, etc.)
        const html = token.content;

        // Check for callout marker
        if (html.includes('<!-- Notion callout block -->')) {
          // Look ahead to collect content
          const result = this.parseMultiTokenHTMLBlock(allTokens, currentIndex, 'callout');
          return result;
        }

        // Check for toggle marker
        if (html.includes('<!-- Notion toggle block -->')) {
          const result = this.parseMultiTokenHTMLBlock(allTokens, currentIndex, 'toggle');
          return result;
        }

        // Check for video marker
        if (html.includes('<!-- Notion video block -->')) {
          const result = this.parseMultiTokenHTMLBlock(allTokens, currentIndex, 'video');
          return result;
        }

        // Check for audio marker
        if (html.includes('<!-- Notion audio block -->')) {
          const result = this.parseMultiTokenHTMLBlock(allTokens, currentIndex, 'audio');
          return result;
        }

        // Check for column_list marker
        if (html.includes('<!-- Notion column_list block -->')) {
          const result = this.parseMultiTokenHTMLBlock(allTokens, currentIndex, 'column_list');
          return result;
        }

        // For other HTML, skip it (likely closing tags or other fragments)
        return { block: null, tokensConsumed: 0 };
      }

      case 'table_open': {
        // Find matching close
        let closeIndex = currentIndex + 1;
        while (closeIndex < allTokens.length && allTokens[closeIndex].type !== 'table_close') {
          closeIndex++;
        }

        const block = this.parseTable(allTokens, currentIndex, closeIndex);
        // Skip all tokens within the table
        return { block, tokensConsumed: closeIndex - currentIndex };
      }

      default:
        return { block: null, tokensConsumed: 0 };
    }
  }

  private convertListItems(
    tokens: MarkdownIt.Token[],
    startIndex: number,
    endIndex: number,
    type: 'bulleted' | 'numbered',
  ): ConvertedNotionBlock | null {
    const items: ConvertedNotionBlock[] = [];
    let i = startIndex;

    while (i < endIndex) {
      const token = tokens[i];

      if (token.type === 'list_item_open') {
        // Find matching close
        let closeIndex = i + 1;
        let depth = 1;
        while (closeIndex < endIndex && depth > 0) {
          if (tokens[closeIndex].type === 'list_item_open') depth++;
          if (tokens[closeIndex].type === 'list_item_close') depth--;
          closeIndex++;
        }

        const itemTokens = tokens.slice(i + 1, closeIndex - 1);
        const item = this.convertListItem(itemTokens, type);
        if (item) {
          items.push(item);
        }

        i = closeIndex;
      } else {
        i++;
      }
    }

    // Return first item (caller expects a single block)
    return items[0] || null;
  }

  private convertListItem(tokens: MarkdownIt.Token[], type: 'bulleted' | 'numbered'): ConvertedNotionBlock | null {
    // Extract rich text and check for nested lists
    const richText: RichTextItemWithResponseFields[] = [];
    const children: ConvertedNotionBlock[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === 'paragraph_open') {
        const inlineToken = tokens[i + 1];
        if (inlineToken && inlineToken.type === 'inline') {
          const text = this.convertInlineContent(inlineToken);
          richText.push(...text);
        }
        i++; // Skip inline token
      } else if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') {
        // Find matching close
        let closeIndex = i + 1;
        let depth = 1;
        while (closeIndex < tokens.length && depth > 0) {
          if (tokens[closeIndex].type === token.type) depth++;
          if (tokens[closeIndex].type === token.type.replace('_open', '_close')) depth--;
          closeIndex++;
        }

        const nestedType = token.type === 'bullet_list_open' ? 'bulleted' : 'numbered';
        const nestedItem = this.convertListItems(tokens, i + 1, closeIndex - 1, nestedType);
        if (nestedItem) {
          children.push(nestedItem);
        }

        i = closeIndex - 1;
      }
    }

    // Check if this is a task list item (checkbox syntax: [ ] or [x])
    if (richText.length > 0 && richText[0].type === 'text') {
      const firstText = richText[0].text?.content || '';
      const checkboxMatch = firstText.match(/^\[([ x])\]\s*/);

      if (checkboxMatch) {
        const checked = checkboxMatch[1] === 'x';
        // Remove checkbox syntax from text
        const cleanedText = firstText.replace(/^\[([ x])\]\s*/, '');

        // Update first rich text item
        richText[0] = {
          ...richText[0],
          text: { content: cleanedText, link: null },
          plain_text: cleanedText,
        };

        // Return as to_do block
        return {
          object: 'block',
          type: 'to_do',
          has_children: children.length > 0,
          to_do: {
            rich_text: richText,
            checked,
            color: 'default',
          },
          children: children.length > 0 ? children : undefined,
        };
      }
    }

    const blockType = type === 'bulleted' ? 'bulleted_list_item' : 'numbered_list_item';
    return {
      object: 'block',
      type: blockType,
      has_children: children.length > 0,
      [blockType]: {
        rich_text: richText.length > 0 ? richText : [this.createEmptyText()],
        color: 'default',
      },
      children: children.length > 0 ? children : undefined,
    };
  }

  private parseTable(tokens: MarkdownIt.Token[], startIndex: number, endIndex: number): ConvertedNotionBlock | null {
    const rows: RichTextItemWithResponseFields[][][] = [];
    let hasColumnHeader = false;

    let i = startIndex + 1;
    while (i < endIndex) {
      const token = tokens[i];

      if (token.type === 'thead_open') {
        hasColumnHeader = true;
      } else if (token.type === 'tr_open') {
        // Find matching close
        let closeIndex = i + 1;
        while (closeIndex < endIndex && tokens[closeIndex].type !== 'tr_close') {
          closeIndex++;
        }

        const row = this.parseTableRow(tokens, i + 1, closeIndex);
        if (row) {
          rows.push(row);
        }

        i = closeIndex;
      }

      i++;
    }

    if (rows.length === 0) {
      return null;
    }

    const tableWidth = rows[0]?.length || 1;
    const children: ConvertedNotionBlock[] = rows.map((cells) => ({
      object: 'block',
      type: 'table_row',
      has_children: false,
      table_row: {
        cells,
      },
    }));

    const block: ConvertedNotionBlock = {
      object: 'block',
      type: 'table',
      has_children: true,
      table: {
        table_width: tableWidth,
        has_column_header: hasColumnHeader,
        has_row_header: false,
      },
    };

    // Add children after other properties to match expected structure
    if (children.length > 0) {
      block.children = children;
    }

    return block;
  }

  private parseTableRow(
    tokens: MarkdownIt.Token[],
    startIndex: number,
    endIndex: number,
  ): RichTextItemWithResponseFields[][] | null {
    const cells: RichTextItemWithResponseFields[][] = [];

    let i = startIndex;
    while (i < endIndex) {
      const token = tokens[i];

      if (token.type === 'th_open' || token.type === 'td_open') {
        // Find matching close
        let closeIndex = i + 1;
        while (closeIndex < endIndex && !tokens[closeIndex].type.includes('_close')) {
          closeIndex++;
        }

        const inlineToken = tokens[i + 1];
        if (inlineToken && inlineToken.type === 'inline') {
          const cellContent = this.convertInlineContent(inlineToken);
          cells.push(cellContent);
        } else {
          cells.push([this.createEmptyText()]);
        }

        i = closeIndex;
      }

      i++;
    }

    return cells.length > 0 ? cells : null;
  }

  /**
   * Parses multi-token HTML blocks (callouts, videos, etc.) that are split across multiple markdown tokens.
   * The HTML we generate for these blocks gets parsed by markdown-it into separate tokens:
   * - Comment marker (<!-- Notion X block -->)
   * - Opening tag (<div> or <video>)
   * - Content paragraphs
   * - Closing tag
   */
  private parseMultiTokenHTMLBlock(
    tokens: MarkdownIt.Token[],
    startIndex: number,
    blockType: 'callout' | 'toggle' | 'video' | 'audio' | 'column_list',
  ): { block: ConvertedNotionBlock | null; tokensConsumed: number } {
    // Skip comment token, next should be opening tag
    let i = startIndex + 1;
    if (i >= tokens.length) {
      return { block: null, tokensConsumed: 0 };
    }

    // Collect HTML tokens and content
    let openingTag = '';
    const contentRichText: RichTextItemWithResponseFields[] = [];
    let tokensConsumed = 0;

    // Get the opening HTML tag - could be html_block or inline HTML within paragraph
    if (tokens[i].type === 'html_block') {
      openingTag = tokens[i].content;
      i++;
      tokensConsumed++;
    } else if (tokens[i].type === 'paragraph_open' && i + 1 < tokens.length) {
      // Check if paragraph contains inline HTML
      const inlineToken = tokens[i + 1];
      if (inlineToken.type === 'inline' && inlineToken.children) {
        // Look for html_inline tokens
        for (const child of inlineToken.children) {
          if (child.type === 'html_inline') {
            openingTag += child.content;
          }
        }
        // Skip paragraph tokens
        i += 3;
        tokensConsumed += 3;
      }
    }

    // For video/audio, we might have all HTML in opening tag already
    if (blockType === 'video' || blockType === 'audio') {
      // Already have the tag from inline HTML
      // No need to collect more content
    } else {
      // Collect content until we hit closing HTML tag (for callout, toggle, etc.)
      while (i < tokens.length) {
        const token = tokens[i];

        // Check if this is a closing tag
        if (token.type === 'html_block' && (token.content.includes('</div>') || token.content.includes('</details>'))) {
          tokensConsumed++;
          break;
        }

        // If it's a paragraph, extract its content
        if (token.type === 'paragraph_open' && i + 1 < tokens.length) {
          const inlineToken = tokens[i + 1];
          if (inlineToken.type === 'inline') {
            const richText = this.convertInlineContent(inlineToken);
            contentRichText.push(...richText);
          }
          // Skip paragraph_open, inline, paragraph_close
          i += 3;
          tokensConsumed += 3;
          continue;
        }

        i++;
        tokensConsumed++;
      }
    }

    // Create appropriate block based on type
    if (blockType === 'callout') {
      return {
        block: {
          object: 'block',
          type: 'callout',
          has_children: false,
          callout: {
            rich_text: contentRichText.length > 0 ? contentRichText : [this.createEmptyText()],
            color: 'default',
          },
        },
        tokensConsumed,
      };
    }

    if (blockType === 'video') {
      // Extract URL from opening tag
      const urlMatch = openingTag.match(/src="([^"]+)"/);
      const url = urlMatch ? urlMatch[1] : '';

      return {
        block: {
          object: 'block',
          type: 'video',
          has_children: false,
          video: {
            type: 'external',
            external: { url },
            caption: [],
          },
        },
        tokensConsumed,
      };
    }

    if (blockType === 'audio') {
      const urlMatch = openingTag.match(/src="([^"]+)"/);
      const url = urlMatch ? urlMatch[1] : '';

      return {
        block: {
          object: 'block',
          type: 'audio',
          has_children: false,
          audio: {
            type: 'external',
            external: { url },
            caption: [],
          },
        },
        tokensConsumed,
      };
    }

    // For toggle and column_list, fall back to old parsing
    return { block: null, tokensConsumed: 0 };
  }

  private parseCalloutBlock(html: string): ConvertedNotionBlock {
    // Extract text from <div>content</div>
    const match = html.match(/<div[^>]*>(.*?)<\/div>/s);
    const content = match ? match[1].trim() : '';

    return {
      object: 'block',
      type: 'callout',
      has_children: false,
      callout: {
        rich_text: [
          {
            type: 'text',
            text: { content, link: null },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: 'default',
            },
            plain_text: content,
            href: null,
          },
        ],
        color: 'default',
      },
    };
  }

  private parseToggleBlock(html: string): ConvertedNotionBlock {
    // Extract summary text
    const summaryMatch = html.match(/<summary>(.*?)<\/summary>/s);
    const summary = summaryMatch ? summaryMatch[1].trim() : '';

    return {
      object: 'block',
      type: 'toggle',
      has_children: false,
      toggle: {
        rich_text: [
          {
            type: 'text',
            text: { content: summary, link: null },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: 'default',
            },
            plain_text: summary,
            href: null,
          },
        ],
        color: 'default',
      },
    };
  }

  private convertInlineContent(token: MarkdownIt.Token | undefined): RichTextItemWithResponseFields[] {
    if (!token || !token.children) {
      return [this.createEmptyText()];
    }

    const richText: RichTextItemWithResponseFields[] = [];
    const stack: Array<{
      bold: boolean;
      italic: boolean;
      strikethrough: boolean;
      code: boolean;
      link: string | null;
    }> = [{ bold: false, italic: false, strikethrough: false, code: false, link: null }];

    for (const child of token.children) {
      const current = stack[stack.length - 1];

      switch (child.type) {
        case 'text':
          if (child.content) {
            richText.push({
              type: 'text',
              text: { content: child.content, link: current.link ? { url: current.link } : null },
              annotations: {
                bold: current.bold,
                italic: current.italic,
                strikethrough: current.strikethrough,
                underline: false,
                code: current.code,
                color: 'default',
              },
              plain_text: child.content,
              href: current.link,
            });
          }
          break;

        case 'code_inline':
          richText.push({
            type: 'text',
            text: { content: child.content, link: null },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: true,
              color: 'default',
            },
            plain_text: child.content,
            href: null,
          });
          break;

        case 'strong_open':
          stack.push({ ...current, bold: true });
          break;

        case 'strong_close':
          stack.pop();
          break;

        case 'em_open':
          stack.push({ ...current, italic: true });
          break;

        case 'em_close':
          stack.pop();
          break;

        case 's_open':
          stack.push({ ...current, strikethrough: true });
          break;

        case 's_close':
          stack.pop();
          break;

        case 'link_open': {
          const href = child.attrGet('href');
          stack.push({ ...current, link: href });
          break;
        }
        case 'link_close':
          stack.pop();
          break;

        case 'softbreak':
        case 'hardbreak':
          richText.push({
            type: 'text',
            text: { content: '\n', link: null },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: 'default',
            },
            plain_text: '\n',
            href: null,
          });
          break;
      }
    }

    return richText.length > 0 ? richText : [this.createEmptyText()];
  }

  private extractRichTextFromTokens(tokens: MarkdownIt.Token[]): RichTextItemWithResponseFields[] {
    const richText: RichTextItemWithResponseFields[] = [];

    for (const token of tokens) {
      if (token.type === 'inline' || token.type === 'paragraph_open') {
        const inline = token.type === 'inline' ? token : tokens.find((t) => t.type === 'inline');
        if (inline) {
          richText.push(...this.convertInlineContent(inline));
        }
      }
    }

    return richText.length > 0 ? richText : [this.createEmptyText()];
  }

  private createHeadingBlock(
    type: 'heading_1' | 'heading_2' | 'heading_3',
    richText: RichTextItemWithResponseFields[],
  ): ConvertedNotionBlock {
    return {
      object: 'block',
      type,
      has_children: false,
      [type]: {
        rich_text: richText,
        is_toggleable: false,
        color: 'default',
      },
    };
  }

  private createParagraphBlock(richText: RichTextItemWithResponseFields[]): ConvertedNotionBlock {
    return {
      object: 'block',
      type: 'paragraph',
      has_children: false,
      paragraph: {
        rich_text: richText,
        color: 'default',
      },
    };
  }

  private createEmptyText(): RichTextItemWithResponseFields {
    return {
      type: 'text',
      text: { content: '', link: null },
      annotations: {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: 'default',
      },
      plain_text: '',
      href: null,
    };
  }
}
