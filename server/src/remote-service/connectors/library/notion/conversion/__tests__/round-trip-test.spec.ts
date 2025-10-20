import { convertNotionBlockObjectToHtmlv2, NotionBlockObject } from '../notion-rich-text-conversion';
import { convertToNotionBlocks } from '../notion-rich-text-push';
import { CONTENT_MARKETING_BLOCKS } from './test-data/content-marketing';
import { PRODUCT_LAUNCH_BLOCKS } from './test-data/product-launch';
import { SOCIAL_STRATEGY_BLOCKS } from './test-data/social-strategy';
import { WHALE_ENCYCLOPEDIA_BLOCKS } from './test-data/whale-encyclopedia-clean';

describe('HTML ↔ Notion Blocks Round-Trip Tests', () => {
  const TEST_CASES = [
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

  describe('Notion Blocks → HTML conversion', () => {
    test.each(TEST_CASES)('converts $name notion blocks to HTML', ({ name, notionBlocks }) => {
      // Convert Notion blocks to HTML
      let actualHtml = '';
      for (const block of notionBlocks) {
        const convertedHtml = convertNotionBlockObjectToHtmlv2(block as unknown as NotionBlockObject);
        actualHtml += convertedHtml;
      }

      // Wrap in article tags to match expected format
      actualHtml = `<article>${actualHtml}</article>`;

      expect(actualHtml).toMatchSnapshot(`${name}-notion-to-html`);

      // Test round-trip: convert HTML back to Notion blocks
      const roundTripBlocks = convertToNotionBlocks(actualHtml, false);

      // Create snapshot for round-trip blocks
      expect(roundTripBlocks).toMatchSnapshot(`${name}-html-to-notion-roundtrip`);
    });
  });
});
