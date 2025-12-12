import { MarkdownToNotionConverter } from '../markdown-to-notion-converter';
import type { ConvertedNotionBlock, RichTextItemWithResponseFields } from '../notion-rich-text-push-types';

describe('MarkdownToNotionConverter - Direct Markdown Input', () => {
  let converter: MarkdownToNotionConverter;

  beforeEach(() => {
    converter = new MarkdownToNotionConverter();
  });

  describe('Headings', () => {
    it('should convert H1-H3 to notion heading blocks', () => {
      const markdown = `# Heading 1
## Heading 2
### Heading 3`;

      const blocks = converter.convert(markdown);

      expect(blocks).toHaveLength(3);

      const block0 = blocks[0];
      expect(block0?.type).toBe('heading_1');
      if (block0?.type === 'heading_1') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const richText: RichTextItemWithResponseFields[] = block0.heading_1.rich_text;
        expect(richText[0]?.plain_text).toBe('Heading 1');
      }

      const block1 = blocks[1];
      expect(block1?.type).toBe('heading_2');
      if (block1?.type === 'heading_2') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const richText: RichTextItemWithResponseFields[] = block1.heading_2.rich_text;
        expect(richText[0]?.plain_text).toBe('Heading 2');
      }

      const block2 = blocks[2];
      expect(block2?.type).toBe('heading_3');
      if (block2?.type === 'heading_3') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const richText: RichTextItemWithResponseFields[] = block2.heading_3.rich_text;
        expect(richText[0]?.plain_text).toBe('Heading 3');
      }
    });

    it('should convert H4-H6 to paragraphs', () => {
      const markdown = `#### Heading 4
##### Heading 5
###### Heading 6`;

      const blocks = converter.convert(markdown);

      expect(blocks).toHaveLength(3);
      expect(blocks.every((b) => b.type === 'paragraph')).toBe(true);
    });
  });

  describe('Paragraphs', () => {
    it('should convert simple paragraphs', () => {
      const markdown = `First paragraph.

Second paragraph.`;

      const blocks = converter.convert(markdown);

      expect(blocks).toHaveLength(2);

      const block0 = blocks[0];
      expect(block0?.type).toBe('paragraph');
      if (block0?.type === 'paragraph') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const richText: RichTextItemWithResponseFields[] = block0.paragraph.rich_text;
        expect(richText[0]?.plain_text).toBe('First paragraph.');
      }

      const block1 = blocks[1];
      expect(block1?.type).toBe('paragraph');
      if (block1?.type === 'paragraph') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const richText: RichTextItemWithResponseFields[] = block1.paragraph.rich_text;
        expect(richText[0]?.plain_text).toBe('Second paragraph.');
      }
    });

    it('should handle inline formatting', () => {
      const markdown = 'Text with **bold** and *italic* and `code` and [link](https://example.com)';

      const blocks = converter.convert(markdown);

      expect(blocks).toHaveLength(1);

      const block0 = blocks[0];
      expect(block0?.type).toBe('paragraph');
      if (block0?.type === 'paragraph') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const richText: RichTextItemWithResponseFields[] = block0.paragraph.rich_text;

        // Check for bold
        const boldItem: RichTextItemWithResponseFields | undefined = richText.find((item) => item.annotations?.bold);
        expect(boldItem?.plain_text).toBe('bold');

        // Check for italic
        const italicItem: RichTextItemWithResponseFields | undefined = richText.find(
          (item) => item.annotations?.italic,
        );
        expect(italicItem?.plain_text).toBe('italic');

        // Check for code
        const codeItem: RichTextItemWithResponseFields | undefined = richText.find((item) => item.annotations?.code);
        expect(codeItem?.plain_text).toBe('code');

        // Check for link
        const linkItem: RichTextItemWithResponseFields | undefined = richText.find(
          (item) => item.href === 'https://example.com',
        );
        expect(linkItem?.plain_text).toBe('link');
      }
    });
  });

  describe('Lists', () => {
    it('should convert bulleted lists', () => {
      const markdown = `* Item 1
* Item 2
* Item 3`;

      const blocks = converter.convert(markdown);

      expect(blocks).toHaveLength(3); // Returns all items

      const block0 = blocks[0];
      expect(block0?.type).toBe('bulleted_list_item');
      if (block0?.type === 'bulleted_list_item') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const richText: RichTextItemWithResponseFields[] = block0.bulleted_list_item.rich_text;
        expect(richText[0]?.plain_text).toBe('Item 1');
      }

      const block1 = blocks[1];
      expect(block1?.type).toBe('bulleted_list_item');
      if (block1?.type === 'bulleted_list_item') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const richText: RichTextItemWithResponseFields[] = block1.bulleted_list_item.rich_text;
        expect(richText[0]?.plain_text).toBe('Item 2');
      }

      const block2 = blocks[2];
      expect(block2?.type).toBe('bulleted_list_item');
      if (block2?.type === 'bulleted_list_item') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const richText: RichTextItemWithResponseFields[] = block2.bulleted_list_item.rich_text;
        expect(richText[0]?.plain_text).toBe('Item 3');
      }
    });

    it('should convert numbered lists', () => {
      const markdown = `1. First
2. Second
3. Third`;

      const blocks = converter.convert(markdown);

      expect(blocks).toHaveLength(3); // Returns all items

      const block0 = blocks[0];
      expect(block0?.type).toBe('numbered_list_item');
      if (block0?.type === 'numbered_list_item') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const richText: RichTextItemWithResponseFields[] = block0.numbered_list_item.rich_text;
        expect(richText[0]?.plain_text).toBe('First');
      }

      const block1 = blocks[1];
      expect(block1?.type).toBe('numbered_list_item');
      if (block1?.type === 'numbered_list_item') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const richText: RichTextItemWithResponseFields[] = block1.numbered_list_item.rich_text;
        expect(richText[0]?.plain_text).toBe('Second');
      }

      const block2 = blocks[2];
      expect(block2?.type).toBe('numbered_list_item');
      if (block2?.type === 'numbered_list_item') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const richText: RichTextItemWithResponseFields[] = block2.numbered_list_item.rich_text;
        expect(richText[0]?.plain_text).toBe('Third');
      }
    });

    it('should handle nested lists', () => {
      const markdown = `* Parent
  * Child
  * Child 2`;

      const blocks = converter.convert(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]?.type).toBe('bulleted_list_item');
      expect(blocks[0]?.has_children).toBe(true);
      expect(blocks[0]?.children).toBeDefined();
      expect(blocks[0]?.children?.[0]?.type).toBe('bulleted_list_item');
    });
  });

  describe('Code blocks', () => {
    it('should convert fenced code blocks', () => {
      const markdown = '```javascript\nconst x = 42;\n```';

      const blocks = converter.convert(markdown);

      expect(blocks).toHaveLength(1);

      const block0 = blocks[0];
      expect(block0?.type).toBe('code');
      if (block0?.type === 'code') {
        expect(block0.code.language).toBe('javascript');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const richText: RichTextItemWithResponseFields[] = block0.code.rich_text;
        expect(richText[0]?.plain_text).toBe('const x = 42;\n');
      }
    });

    it('should handle code blocks without language', () => {
      const markdown = '```\nplain code\n```';

      const blocks = converter.convert(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]?.type).toBe('code');
      if (blocks[0]?.type === 'code') {
        expect(blocks[0].code.language).toBe('plain text');
      }
    });
  });

  describe('Blockquotes', () => {
    it('should convert blockquotes', () => {
      const markdown = '> This is a quote.';

      const blocks = converter.convert(markdown);

      expect(blocks).toHaveLength(1);

      const block0 = blocks[0];
      expect(block0?.type).toBe('quote');
      if (block0?.type === 'quote') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const richText: RichTextItemWithResponseFields[] = block0.quote.rich_text;
        expect(richText[0]?.plain_text).toContain('This is a quote.');
      }
    });

    it('should handle multi-line blockquotes', () => {
      const markdown = `> Line 1
> Line 2`;

      const blocks = converter.convert(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]?.type).toBe('quote');
    });
  });

  describe('Tables', () => {
    it('should convert markdown tables', () => {
      const markdown = `| Name | Age |
| --- | --- |
| Alice | 30 |
| Bob | 25 |`;

      const blocks = converter.convert(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('table');
      expect(blocks[0].table?.has_column_header).toBe(true);
      expect(blocks[0].table?.table_width).toBe(2);
      expect(blocks[0].children).toHaveLength(3); // Header + 2 data rows
    });

    it('should handle tables without headers', () => {
      const markdown = `| Cell 1 | Cell 2 |
| Cell 3 | Cell 4 |`;

      const blocks = converter.convert(markdown);

      // Without separator line (| --- | --- |), markdown-it doesn't recognize as table
      // It treats as regular paragraph text
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('paragraph');
    });
  });

  describe('Horizontal rules', () => {
    it('should convert horizontal rules to dividers', () => {
      const markdown = 'Before\n\n---\n\nAfter';

      const blocks = converter.convert(markdown);

      expect(blocks.length).toBeGreaterThanOrEqual(2);
      const divider = blocks.find((b) => b.type === 'divider');
      expect(divider).toBeDefined();
    });
  });

  describe('Mixed content', () => {
    it('should handle complex documents', () => {
      const markdown = `# Title

This is a paragraph with **bold** text.

## Subtitle

* Item 1
* Item 2

\`\`\`javascript
const x = 1;
\`\`\`

> A quote

---`;

      const blocks = converter.convert(markdown);

      expect(blocks.length).toBeGreaterThan(4);

      // Check heading
      expect(blocks[0].type).toBe('heading_1');

      // Check paragraph
      const paragraph = blocks.find((b) => b.type === 'paragraph');
      expect(paragraph).toBeDefined();

      // Check list
      const list = blocks.find((b) => b.type === 'bulleted_list_item');
      expect(list).toBeDefined();

      // Check code
      const code = blocks.find((b) => b.type === 'code');
      expect(code).toBeDefined();

      // Check quote
      const quote = blocks.find((b) => b.type === 'quote');
      expect(quote).toBeDefined();

      // Check divider
      const divider = blocks.find((b) => b.type === 'divider');
      expect(divider).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty markdown', () => {
      const blocks = converter.convert('');
      expect(blocks).toHaveLength(0);
    });

    it('should handle markdown with only whitespace', () => {
      const blocks = converter.convert('   \n\n   ');
      expect(blocks).toHaveLength(0);
    });

    it('should handle strikethrough', () => {
      const markdown = 'Text with ~~strikethrough~~';

      const blocks = converter.convert(markdown);

      expect(blocks).toHaveLength(1);

      const block0 = blocks[0];
      expect(block0?.type).toBe('paragraph');
      if (block0?.type === 'paragraph') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const richText: RichTextItemWithResponseFields[] = block0.paragraph.rich_text;
        const strikeItem: RichTextItemWithResponseFields | undefined = richText.find(
          (item) => item.annotations?.strikethrough,
        );
        expect(strikeItem?.plain_text).toBe('strikethrough');
      }
    });
  });

  describe('Roundtrip issues', () => {
    it('should handle task lists (checkboxes)', () => {
      const markdown = `- [ ] Unchecked todo
- [x] Checked todo`;

      const blocks = converter.convert(markdown);

      expect(blocks).toHaveLength(2);

      const block0 = blocks[0];
      expect(block0?.type).toBe('to_do');
      if (block0?.type === 'to_do') {
        expect(block0.to_do.checked).toBe(false);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const richText: RichTextItemWithResponseFields[] = block0.to_do.rich_text;
        expect(richText[0]?.plain_text).toBe('Unchecked todo');
      }

      const block1 = blocks[1];
      expect(block1?.type).toBe('to_do');
      if (block1?.type === 'to_do') {
        expect(block1.to_do.checked).toBe(true);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const richText: RichTextItemWithResponseFields[] = block1.to_do.rich_text;
        expect(richText[0]?.plain_text).toBe('Checked todo');
      }
    });

    it('should handle callout HTML blocks', () => {
      const markdown = `<!-- Notion callout block -->
<div style="padding: 16px; background-color: #f1f1f1; border-radius: 4px;">

This is callout text

</div>`;

      const blocks = converter.convert(markdown);

      expect(blocks).toHaveLength(1);

      const block0 = blocks[0];
      expect(block0?.type).toBe('callout');
      if (block0?.type === 'callout') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const richText: RichTextItemWithResponseFields[] = block0.callout.rich_text;
        expect(richText[0]?.plain_text).toBe('This is callout text');
      }
    });

    it('should handle images', () => {
      const markdown = '![Test image](https://example.com/image.png)';

      const blocks = converter.convert(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]?.type).toBe('image');
      if (blocks[0]?.type === 'image') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const external = blocks[0].image.external;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(external?.url).toBe('https://example.com/image.png');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const caption: RichTextItemWithResponseFields[] = blocks[0].image.caption;
        expect(caption[0]?.plain_text).toBe('Test image');
      }
    });

    it('should handle images without alt text', () => {
      const markdown = '![](https://example.com/image.png)';

      const blocks = converter.convert(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]?.type).toBe('image');
      if (blocks[0]?.type === 'image') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const external = blocks[0].image.external;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(external?.url).toBe('https://example.com/image.png');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const caption: RichTextItemWithResponseFields[] = blocks[0].image.caption;
        expect(caption).toEqual([]);
      }
    });

    it('should roundtrip images without adding default caption', () => {
      // Create a Notion image block without caption
      const notionBlock: ConvertedNotionBlock = {
        object: 'block',
        type: 'image',
        has_children: false,
        image: {
          type: 'external',
          external: { url: 'https://example.com/test.png' },
          caption: [], // No caption
        },
      };

      // Convert to markdown
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { NotionMarkdownConverter } = require('../notion-markdown-converter') as {
        NotionMarkdownConverter: typeof import('../notion-markdown-converter').NotionMarkdownConverter;
      };
      const notionConverter = new NotionMarkdownConverter();
      const markdown = notionConverter.notionToMarkdown([notionBlock]);

      // Should produce ![](url) not ![image](url)
      expect(markdown).toBe('![](https://example.com/test.png)');

      // Convert back to Notion
      const blocks = converter.convert(markdown);

      // Should still have no caption
      expect(blocks[0]?.type).toBe('image');
      if (blocks[0]?.type === 'image') {
        expect(blocks[0].image.caption).toEqual([]);
      }
    });

    it('should handle video HTML blocks', () => {
      const markdown = `<!-- Notion video block -->
<video controls src="https://example.com/video.mp4"></video>`;

      const blocks = converter.convert(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]?.type).toBe('video');
      if (blocks[0]?.type === 'video') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const external = blocks[0].video.external;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(external?.url).toBe('https://example.com/video.mp4');
      }
    });
  });
});
