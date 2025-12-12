import { NotionMarkdownConverter } from '../notion-markdown-converter';
import { ADDITIONAL_BLOCK_TYPES } from './test-data/additional-block-types';
import { CONTENT_MARKETING_BLOCKS } from './test-data/content-marketing';
import { PRODUCT_LAUNCH_BLOCKS } from './test-data/product-launch';
import { SIMPLE_TABLE_BLOCKS } from './test-data/simple-table';
import { SOCIAL_STRATEGY_BLOCKS } from './test-data/social-strategy';
import { WHALE_ENCYCLOPEDIA_BLOCKS } from './test-data/whale-encyclopedia-clean';

describe('NotionMarkdownConverter', () => {
  let converter: NotionMarkdownConverter;

  const TEST_CASES = [
    {
      name: 'simple-table',
      notionBlocks: SIMPLE_TABLE_BLOCKS.children,
    },
    {
      name: 'additional-block-types',
      notionBlocks: ADDITIONAL_BLOCK_TYPES.children,
    },
    {
      name: 'content-marketing',
      notionBlocks: CONTENT_MARKETING_BLOCKS.children,
    },
    {
      name: 'product-launch',
      notionBlocks: PRODUCT_LAUNCH_BLOCKS.children,
    },
    {
      name: 'social-strategy',
      notionBlocks: SOCIAL_STRATEGY_BLOCKS.children,
    },
    {
      name: 'whale-encyclopedia',
      notionBlocks: WHALE_ENCYCLOPEDIA_BLOCKS.children,
    },
  ];

  beforeEach(() => {
    converter = new NotionMarkdownConverter();
  });

  describe('Notion → Markdown conversion', () => {
    test.each(TEST_CASES)('converts $name notion blocks to markdown', ({ name, notionBlocks }) => {
      const markdown = converter.notionToMarkdown(notionBlocks);

      expect(markdown).toMatchSnapshot(`${name}-notion-to-markdown`);
    });
  });

  describe('Markdown → Notion conversion', () => {
    test.each(TEST_CASES)('converts $name markdown back to notion blocks', ({ name, notionBlocks }) => {
      // First convert to markdown
      const markdown = converter.notionToMarkdown(notionBlocks);

      // Then convert back to notion
      const convertedBlocks = converter.markdownToNotion(markdown);

      expect(convertedBlocks).toMatchSnapshot(`${name}-markdown-to-notion`);
    });
  });

  describe('Round-trip: Notion → Markdown → Notion', () => {
    test.each(TEST_CASES)('maintains content through $name round-trip', ({ name, notionBlocks }) => {
      // Convert to markdown
      const markdown = converter.notionToMarkdown(notionBlocks);

      // Convert back to notion
      const roundTripBlocks = converter.markdownToNotion(markdown);

      expect(roundTripBlocks).toMatchSnapshot(`${name}-notion-markdown-notion-roundtrip`);
    });
  });
});
