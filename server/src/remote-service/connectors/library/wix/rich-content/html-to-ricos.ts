import { Cheerio, CheerioAPI, load } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type {
  ParseContext,
  WixBlockquoteNode,
  WixCodeBlockNode,
  WixDividerNode,
  WixDocument,
  WixHeadingNode,
  WixLinkDecoration,
  WixListItemNode,
  WixListNode,
  WixNode,
  WixParagraphNode,
  WixTextDecoration,
  WixTextNode,
} from './types';

class HtmlToWixConverter {
  private idCounter = 0;

  private generateId(): string {
    return `node_${++this.idCounter}_${Date.now()}`;
  }

  convert(html: string): WixDocument {
    // Load HTML with cheerio
    const $ = load(html, {
      xmlMode: false,
    });

    // Reset counter for each conversion
    this.idCounter = 0;

    // Parse the body content
    const nodes = this.parseCheerioNodes($('body').contents(), $, {
      decorations: [],
      inList: false,
      listType: null,
      listIndentation: 0,
    });

    return {
      nodes: nodes.length > 0 ? nodes : [this.createEmptyParagraph()],
    };
  }

  private parseCheerioNodes(elements: Cheerio<AnyNode>, $: CheerioAPI, context: ParseContext): WixNode[] {
    const result: WixNode[] = [];

    elements.each((index, element) => {
      const parsed = this.parseCheerioNode($(element), $, context);
      if (parsed) {
        if (Array.isArray(parsed)) {
          result.push(...parsed);
        } else {
          result.push(parsed);
        }
      }
    });

    return result;
  }

  private parseCheerioNode(
    $element: Cheerio<AnyNode>,
    $: CheerioAPI,
    context: ParseContext,
  ): WixNode | WixNode[] | null {
    const element = $element.get(0);

    if (!element) {
      return null;
    }

    // Handle text nodes
    if ((element as { type: string }).type === 'text') {
      return this.parseTextNode($element, context);
    }

    // Handle element nodes
    if ((element as { type: string }).type === 'tag') {
      return this.parseElement($element as Cheerio<Element>, $, context);
    }

    return null;
  }

  private parseTextNode($element: Cheerio<AnyNode>, context: ParseContext): WixParagraphNode | null {
    const text = $element.text() || '';

    // Skip empty text nodes or whitespace-only nodes in most cases
    if (!text.trim() && !context.inList) {
      return null;
    }

    const wixTextNode: WixTextNode = {
      type: 'TEXT',
      id: '',
      nodes: [],
      textData: {
        text: text,
        decorations: [...context.decorations],
      },
    };

    return {
      type: 'PARAGRAPH',
      id: this.generateId(),
      nodes: [wixTextNode],
      paragraphData: {
        textStyle: {
          textAlignment: 'AUTO',
        },
      },
    };
  }

  private parseElement($element: Cheerio<Element>, $: CheerioAPI, context: ParseContext): WixNode | WixNode[] | null {
    const tagName = $element.prop('tagName')?.toLowerCase();

    if (!tagName) {
      return null;
    }

    switch (tagName) {
      case 'p':
        return this.parseParagraph($element, $, context);

      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return this.parseHeading($element, $, context);

      case 'div':
        return this.parseDiv($element, $, context);

      case 'br':
        return this.createEmptyParagraph();

      case 'hr':
        return this.createDivider();

      case 'strong':
      case 'b':
        return this.parseStyledElement($element, $, context, 'BOLD');

      case 'em':
      case 'i':
        return this.parseStyledElement($element, $, context, 'ITALIC');

      case 'u':
        return this.parseStyledElement($element, $, context, 'UNDERLINE');

      case 'del':
        return this.parseStyledElement($element, $, context, 'STRIKETHROUGH');

      case 'a':
        return this.parseLink($element, $, context);

      case 'ul':
        return this.parseList($element, $, context, 'BULLETED_LIST');

      case 'ol':
        return this.parseList($element, $, context, 'ORDERED_LIST');

      case 'li':
        return this.parseListItem($element, $, context);

      case 'code':
        return this.parseCode($element, $, context);

      case 'pre':
        return this.parsePreformatted($element, $, context);

      case 'span':
        return this.parseSpan($element, $, context);

      case 'blockquote':
        return this.parseBlockquote($element, $, context);

      default:
        // For unknown elements, parse their children
        return this.parseCheerioNodes($element.contents(), $, context);
    }
  }

  private parseParagraph($element: Cheerio<Element>, $: CheerioAPI, context: ParseContext): WixParagraphNode {
    const textNodes = this.parseInlineContent($element, $, context);
    const alignment = this.getTextAlignment($element);
    const indentation = this.getIndentation($element);

    // For empty paragraphs, return empty nodes array instead of fallback text node
    const hasOnlyEmptyTextNode =
      textNodes.length === 1 && textNodes[0].textData.text === '' && textNodes[0].textData.decorations.length === 0;

    return {
      type: 'PARAGRAPH',
      id: this.generateId(),
      nodes: hasOnlyEmptyTextNode ? [] : textNodes,
      paragraphData: {
        textStyle: {
          textAlignment: alignment,
        },
        ...(indentation > 0 && { indentation }),
      },
    };
  }

  private parseHeading($element: Cheerio<Element>, $: CheerioAPI, context: ParseContext): WixHeadingNode {
    const tagName = $element.prop('tagName')?.toLowerCase() || 'h1';
    const level = parseInt(tagName.charAt(1)) as 1 | 2 | 3 | 4 | 5 | 6;
    const textNodes = this.parseInlineContent($element, $, context);
    const alignment = this.getTextAlignment($element);
    const indentation = this.getIndentation($element);

    return {
      type: 'HEADING',
      id: this.generateId(),
      nodes: textNodes,
      headingData: {
        level,
        textStyle: {
          textAlignment: alignment,
        },
        ...(indentation > 0 && { indentation }),
      },
    };
  }

  private parseDiv($element: Cheerio<Element>, $: CheerioAPI, context: ParseContext): WixNode[] {
    return this.parseCheerioNodes($element.contents(), $, context);
  }

  private parseStyledElement(
    $element: Cheerio<Element>,
    $: CheerioAPI,
    context: ParseContext,
    decorationType: 'BOLD' | 'ITALIC' | 'UNDERLINE' | 'STRIKETHROUGH',
  ): WixNode[] {
    const newDecoration = this.createDecoration(decorationType);
    const newContext: ParseContext = {
      ...context,
      decorations: [...context.decorations, newDecoration],
    };

    return this.parseCheerioNodes($element.contents(), $, newContext);
  }

  private parseLink($element: Cheerio<Element>, $: CheerioAPI, context: ParseContext): WixNode[] {
    const href = $element.attr('href') || '';
    const target = $element.attr('target') as '_blank' | '_self' | undefined;

    const linkDecoration: WixLinkDecoration = {
      type: 'LINK',
      linkData: {
        link: {
          url: href,
          ...(target && { target }),
        },
      },
    };

    const newContext: ParseContext = {
      ...context,
      decorations: [...context.decorations, linkDecoration],
    };

    return this.parseCheerioNodes($element.contents(), $, newContext);
  }

  private parseList(
    $element: Cheerio<Element>,
    $: CheerioAPI,
    context: ParseContext,
    listType: 'BULLETED_LIST' | 'ORDERED_LIST',
  ): WixListNode {
    const newContext: ParseContext = {
      ...context,
      inList: true,
      listType,
      listIndentation: context.listIndentation + 1,
    };

    const listItems: WixListItemNode[] = [];

    $element.children('li').each((index, element) => {
      const listItem = this.parseListItem($(element), $, newContext);
      if (listItem && !Array.isArray(listItem)) {
        listItems.push(listItem);
      }
    });

    const listNode: WixListNode = {
      type: listType,
      id: this.generateId(),
      nodes: listItems,
    };

    // Add the appropriate list data property with indentation
    // Wix uses 0-based indentation where 0 is the top level, 1 is first nest, etc.
    const indentation = Math.max(0, context.listIndentation);
    if (listType === 'BULLETED_LIST') {
      listNode.bulletedListData = { indentation };
    } else {
      listNode.numberedListData = { indentation };
    }

    return listNode;
  }

  private parseListItem($element: Cheerio<Element>, $: CheerioAPI, context: ParseContext): WixListItemNode {
    // Determine if the LI contains any direct block-level children
    const hasBlockChild = $element
      .children()
      .toArray()
      .some((child) => {
        const childType = (child as { type: string }).type;
        if (childType !== 'tag') {
          return false;
        }
        const name = (child as { tagName?: string }).tagName?.toLowerCase();
        return (
          name === 'p' ||
          name === 'h1' ||
          name === 'h2' ||
          name === 'h3' ||
          name === 'h4' ||
          name === 'h5' ||
          name === 'h6' ||
          name === 'blockquote' ||
          name === 'pre' ||
          name === 'div' ||
          name === 'ul' ||
          name === 'ol'
        );
      });

    if (!hasBlockChild) {
      const paragraphNode: WixParagraphNode = {
        type: 'PARAGRAPH',
        id: this.generateId(),
        nodes: this.parseInlineContent($element, $, context),
        paragraphData: {
          textStyle: {
            textAlignment: 'AUTO',
          },
        },
      };

      return {
        type: 'LIST_ITEM',
        id: this.generateId(),
        nodes: [paragraphNode],
        listItemData: {},
      };
    }

    // If there are block-level elements, parse children as blocks
    const childNodes = this.parseCheerioNodes($element.contents(), $, {
      ...context,
      inList: false,
    });

    return {
      type: 'LIST_ITEM',
      id: this.generateId(),
      nodes: childNodes,
      listItemData: {},
    };
  }

  private parseCode($element: Cheerio<Element>, $: CheerioAPI, context: ParseContext): WixNode[] {
    // For inline code, treat as regular text with monospace styling
    return this.parseCheerioNodes($element.contents(), $, context);
  }

  private parsePreformatted($element: Cheerio<Element>, $: CheerioAPI, context: ParseContext): WixCodeBlockNode {
    const textNodes = this.parseInlineContent($element, $, context);

    return {
      type: 'CODE_BLOCK',
      id: this.generateId(),
      nodes: textNodes,
      codeBlockData: {
        textStyle: {
          textAlignment: 'LEFT',
        },
      },
    };
  }

  private parseSpan($element: Cheerio<Element>, $: CheerioAPI, context: ParseContext): WixNode[] {
    const style = $element.attr('style') || '';
    const newDecorations = this.parseStyleDecorations(style);

    const newContext: ParseContext = {
      ...context,
      decorations: [...context.decorations, ...newDecorations],
    };

    return this.parseCheerioNodes($element.contents(), $, newContext);
  }

  private parseBlockquote($element: Cheerio<Element>, $: CheerioAPI, context: ParseContext): WixBlockquoteNode {
    const nodes = this.parseCheerioNodes($element.contents(), $, context);

    return {
      type: 'BLOCKQUOTE',
      id: this.generateId(),
      nodes: nodes,
      quoteData: {
        indentation: 0,
      },
    };
  }

  private parseInlineContent($element: Cheerio<Element>, $: CheerioAPI, context: ParseContext): WixTextNode[] {
    const result: WixTextNode[] = [];

    $element.contents().each((index, child) => {
      const $child = $(child);
      const childType = (child as { type: string }).type;

      if (childType === 'text') {
        const text = $child.text() || '';
        if (text.length > 0) {
          // Include all text content including whitespace
          result.push({
            type: 'TEXT',
            id: '',
            nodes: [],
            textData: {
              text,
              decorations: [...context.decorations],
            },
          });
        }
      } else if (childType === 'tag') {
        const inlineResult = this.parseInlineElement($child as Cheerio<Element>, $, context);
        result.push(...inlineResult);
      }
    });

    return result.length > 0
      ? result
      : [
          {
            type: 'TEXT',
            id: '',
            nodes: [],
            textData: {
              text: '',
              decorations: [],
            },
          },
        ];
  }

  private parseInlineElement($element: Cheerio<Element>, $: CheerioAPI, context: ParseContext): WixTextNode[] {
    const tagName = $element.prop('tagName')?.toLowerCase();

    switch (tagName) {
      case 'strong':
      case 'b':
        return this.parseInlineWithDecoration($element, $, context, 'BOLD');

      case 'em':
      case 'i':
        return this.parseInlineWithDecoration($element, $, context, 'ITALIC');

      case 'u':
        return this.parseInlineWithDecoration($element, $, context, 'UNDERLINE');

      case 'del':
        return this.parseInlineWithDecoration($element, $, context, 'STRIKETHROUGH');

      case 'a':
        return this.parseInlineLink($element, $, context);

      case 'span':
        return this.parseInlineSpan($element, $, context);

      default:
        return this.parseInlineContent($element, $, context);
    }
  }

  private parseInlineWithDecoration(
    $element: Cheerio<Element>,
    $: CheerioAPI,
    context: ParseContext,
    decorationType: 'BOLD' | 'ITALIC' | 'UNDERLINE' | 'STRIKETHROUGH',
  ): WixTextNode[] {
    const newDecoration = this.createDecoration(decorationType);
    const newContext: ParseContext = {
      ...context,
      decorations: [...context.decorations, newDecoration],
    };

    return this.parseInlineContent($element, $, newContext);
  }

  private parseInlineLink($element: Cheerio<Element>, $: CheerioAPI, context: ParseContext): WixTextNode[] {
    const href = $element.attr('href') || '';
    const target = $element.attr('target') as '_blank' | '_self' | undefined;

    const linkDecoration: WixLinkDecoration = {
      type: 'LINK',
      linkData: {
        link: {
          url: href,
          ...(target && { target }),
        },
      },
    };

    const newContext: ParseContext = {
      ...context,
      decorations: [...context.decorations, linkDecoration],
    };

    return this.parseInlineContent($element, $, newContext);
  }

  private parseInlineSpan($element: Cheerio<Element>, $: CheerioAPI, context: ParseContext): WixTextNode[] {
    const style = $element.attr('style') || '';
    const newDecorations = this.parseStyleDecorations(style);

    const newContext: ParseContext = {
      ...context,
      decorations: [...context.decorations, ...newDecorations],
    };

    return this.parseInlineContent($element, $, newContext);
  }

  private createDecoration(type: 'BOLD' | 'ITALIC' | 'UNDERLINE' | 'STRIKETHROUGH'): WixTextDecoration {
    switch (type) {
      case 'BOLD':
        return { type: 'BOLD', fontWeightValue: 700 }; // Use real Wix format
      case 'ITALIC':
        return { type: 'ITALIC', italicData: true };
      case 'UNDERLINE':
        return { type: 'UNDERLINE', underlineData: true };
      case 'STRIKETHROUGH':
        return { type: 'STRIKETHROUGH', strikethroughData: true };
    }
  }

  private parseStyleDecorations(style: string): WixTextDecoration[] {
    const decorations: WixTextDecoration[] = [];

    // Parse color and background-color
    const colorMatch = style.match(/(?:^|;)\s*color:\s*([^;]+)/);
    const bgColorMatch = style.match(/background-color:\s*([^;]+)/);

    if (colorMatch || bgColorMatch) {
      const colorData: { foreground?: string; background?: string } = {};
      if (colorMatch) {
        colorData.foreground = colorMatch[1].trim();
      }
      if (bgColorMatch) {
        colorData.background = bgColorMatch[1].trim();
      }
      decorations.push({
        type: 'COLOR',
        colorData,
      });
    }

    // Parse font-size
    const fontSizeMatch = style.match(/font-size:\s*(\d+)(px|em)/);
    if (fontSizeMatch) {
      decorations.push({
        type: 'FONT_SIZE',
        fontSizeData: {
          unit: fontSizeMatch[2].toUpperCase() as 'PX' | 'EM',
          value: parseInt(fontSizeMatch[1]),
        },
      });
    }

    // Parse font-weight for bold
    if (style.includes('font-weight: bold') || style.includes('font-weight: 700')) {
      decorations.push({ type: 'BOLD', fontWeightValue: 700 });
    }

    // Parse font-style for italic
    if (style.includes('font-style: italic')) {
      decorations.push({ type: 'ITALIC', italicData: true });
    }

    // Parse text-decoration for underline
    if (style.includes('text-decoration: underline')) {
      decorations.push({ type: 'UNDERLINE', underlineData: true });
    }

    return decorations;
  }

  private getTextAlignment($element: Cheerio<Element>): 'AUTO' | 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFY' {
    const style = $element.attr('style') || '';
    const alignMatch = style.match(/text-align:\s*([^;]+)/);

    if (alignMatch) {
      const align = alignMatch[1].trim().toLowerCase();
      switch (align) {
        case 'left':
          return 'LEFT';
        case 'center':
          return 'CENTER';
        case 'right':
          return 'RIGHT';
        case 'justify':
          return 'JUSTIFY';
      }
    }

    return 'AUTO';
  }

  private getIndentation($element: Cheerio<Element>): number {
    const style = $element.attr('style') || '';
    const marginMatch = style.match(/margin-left:\s*(\d+)px/);

    if (marginMatch) {
      const pixels = parseInt(marginMatch[1]);
      // Convert pixels back to indentation levels (20px per level)
      return Math.round(pixels / 20);
    }

    return 0;
  }

  private createEmptyParagraph(): WixParagraphNode {
    return {
      type: 'PARAGRAPH',
      id: this.generateId(),
      nodes: [],
      paragraphData: {
        textStyle: {
          textAlignment: 'AUTO',
        },
      },
    };
  }

  private createDivider(): WixDividerNode {
    return {
      type: 'DIVIDER',
      id: this.generateId(),
      dividerData: {
        lineStyle: 'SINGLE',
        width: 'LARGE',
        alignment: 'CENTER',
      },
    };
  }
}

export { HtmlToWixConverter };
