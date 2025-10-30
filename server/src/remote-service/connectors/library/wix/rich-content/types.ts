// Wix Rich Content Type Definitions

import { JsonSafeValue } from 'src/utils/objects';

export type WixRichContentValue = {
  object: 'VALUE';
  document: WixDocument;
};

export type WixDocument = {
  nodes: WixNode[];
  documentStyle?: WixDocumentStyle;
};

export function isWixDocument(data: JsonSafeValue): data is WixDocument {
  // Pretty weak check.
  return !!data && typeof data === 'object' && 'nodes' in data && Array.isArray(data.nodes);
}

export type WixDocumentStyle = {
  [key: string]: JsonSafeValue;
};

export type WixNode =
  | WixParagraphNode
  | WixHeadingNode
  | WixListNode
  | WixDividerNode
  | WixCodeBlockNode
  | WixListItemNode
  | WixBlockquoteNode;

export type WixBaseNode = {
  id: string;
  type: string;
};

export type WixParagraphNode = WixBaseNode & {
  type: 'PARAGRAPH';
  nodes: WixTextNode[];
  paragraphData?: WixParagraphData;
};

export type WixHeadingNode = WixBaseNode & {
  type: 'HEADING';
  nodes: WixTextNode[];
  headingData: WixHeadingData;
};

export type WixListNode = WixBaseNode & {
  type: 'BULLETED_LIST' | 'ORDERED_LIST';
  nodes: WixListItemNode[];
  listData?: WixListData;
  bulletedListData?: WixBulletedListData;
  numberedListData?: WixNumberedListData;
};

export type WixListItemNode = WixBaseNode & {
  type: 'LIST_ITEM';
  nodes: WixNode[]; // Can contain paragraphs or text nodes
  listItemData?: WixListItemData;
};

export type WixDividerNode = WixBaseNode & {
  type: 'DIVIDER';
  dividerData: WixDividerData;
};

export type WixCodeBlockNode = WixBaseNode & {
  type: 'CODE_BLOCK';
  nodes: WixTextNode[];
  codeBlockData: WixCodeBlockData;
};

export type WixBlockquoteNode = WixBaseNode & {
  type: 'BLOCKQUOTE';
  nodes: WixNode[];
  quoteData: {
    indentation: number;
  };
};

export type WixTextNode = {
  type: 'TEXT';
  id: string;
  nodes?: WixNode[]; // This can be empty in real Wix data
  textData: WixTextData;
};

export type WixTextData = {
  text: string;
  decorations: WixTextDecoration[];
};

export type WixTextDecoration =
  | WixBoldDecoration
  | WixItalicDecoration
  | WixUnderlineDecoration
  | WixColorDecoration
  | WixFontSizeDecoration
  | WixLinkDecoration
  | WixStrikethroughDecoration;

export type WixBoldDecoration = {
  type: 'BOLD';
  fontWeightValue?: number; // Real Wix format uses this
  // The docs say there is a boolean here, but I don't see it, we only set it.
  boldData?: boolean;
};

export type WixItalicDecoration = {
  type: 'ITALIC';
  italicData: boolean;
};

export type WixUnderlineDecoration = {
  type: 'UNDERLINE';
  underlineData: boolean;
};

export type WixStrikethroughDecoration = {
  type: 'STRIKETHROUGH';
  strikethroughData: boolean;
};

export type WixColorDecoration = {
  type: 'COLOR';
  colorData: {
    foreground?: string;
    background?: string;
  };
};

export type WixFontSizeDecoration = {
  type: 'FONT_SIZE';
  fontSizeData: {
    unit: 'PX' | 'EM';
    value: number;
  };
};

export type WixLinkDecoration = {
  type: 'LINK';
  linkData: {
    link: {
      url: string;
      target?: '_blank' | '_self';
    };
  };
};

export type WixParagraphData = {
  textStyle?: {
    textAlignment?: 'AUTO' | 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFY';
  };
  indentation?: number;
};

export type WixHeadingData = {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  textStyle?: {
    textAlignment?: 'AUTO' | 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFY';
  };
  indentation?: number;
};

export type WixListData = {
  indentation?: number;
};

export type WixBulletedListData = {
  indentation?: number;
};

export type WixNumberedListData = {
  indentation?: number;
};

export type WixListItemData = {
  indentation?: number;
};

export type WixDividerData = {
  lineStyle?: 'SINGLE' | 'DOUBLE' | 'DASHED' | 'DOTTED';
  width?: 'LARGE' | 'MEDIUM' | 'SMALL';
  alignment?: 'LEFT' | 'CENTER' | 'RIGHT';
};

export type WixCodeBlockData = {
  textStyle?: {
    textAlignment?: 'AUTO' | 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFY';
  };
};

// HTML Parser Configuration (for html-to-ricos.ts)
export type ParseContext = {
  decorations: WixTextDecoration[];
  inList: boolean;
  listType: 'BULLETED_LIST' | 'ORDERED_LIST' | null;
  listIndentation: number; // Track nesting level for lists
};

// HTML Conversion Options (for ricos-to-html.ts)
export type HtmlConversionOptions = {
  prettify?: boolean;
  indentSize?: number;
};
