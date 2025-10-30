import MarkdownIt from 'markdown-it';
import TurndownService from 'turndown';
import { HtmlToWixConverter } from './html-to-ricos';
import { WixToHtmlConverter } from './ricos-to-html';
import type {
  WixBlockquoteNode,
  WixDocument,
  WixHeadingNode,
  WixListNode,
  WixParagraphNode,
  WixTextData,
} from './types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toEqualWixRichText(expected: string): R;
    }
  }
}

expect.extend({
  toEqualWixRichText(this: jest.MatcherContext, received: WixDocument, expected: string) {
    // Remove any key named "id" anywhere in the structure
    const stripIds = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        return value.map(stripIds);
      }
      if (value && typeof value === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
          if (key === 'id') {
            continue;
          }
          // Also drop undefined to reduce noise
          if (val === undefined) {
            continue;
          }
          result[key] = stripIds(val);
        }
        return result;
      }
      return value;
    };

    let expectedDocument: unknown;
    try {
      expectedDocument = JSON.parse(expected);
    } catch (err) {
      const { matcherHint } = this.utils;
      return {
        pass: false,
        message: (): string =>
          `${matcherHint('.toEqualWixRichText')}\n\n` +
          `Could not parse expected JSON string.\n` +
          `Parse error: ${(err as Error).message}\n\n` +
          `Expected (raw string):\n${expected}`,
      };
    }

    const sanitizedExpected = stripIds(expectedDocument);
    const sanitizedReceived = stripIds(received);

    const pass = this.equals(sanitizedReceived, sanitizedExpected);

    if (pass) {
      return {
        pass: true,
        message: (): string =>
          `${this.utils.matcherHint('.toEqualWixRichText', 'received', 'expected')}\n\n` +
          `Expected Wix rich text not to match (ids ignored), but it did.`,
      };
    }

    const { matcherHint, printExpected, printReceived, diff } = this.utils;
    const difference =
      diff(sanitizedExpected, sanitizedReceived) ??
      `${printExpected(sanitizedExpected)}\nvs\n${printReceived(sanitizedReceived)}`;

    return {
      pass: false,
      message: (): string =>
        `${matcherHint('.toEqualWixRichText', 'received', 'expected')}\n\n` +
        `Wix rich text mismatch (ids ignored).\n\n` +
        `Expected:\n${printExpected(sanitizedExpected)}\n\n` +
        `Received:\n${printReceived(sanitizedReceived)}\n\n` +
        `Diff:\n${difference}`,
    };
  },
});

describe('HtmlToWixConverter', () => {
  let converter: HtmlToWixConverter;

  beforeEach(() => {
    converter = new HtmlToWixConverter();
  });

  describe('Basic text conversion', () => {
    it('should convert simple paragraph', () => {
      const html = '<p>Hello world</p>';
      const result = converter.convert(html);

      expect(result).toEqualWixRichText(`
        {
          "nodes": [
            {
              "type": "PARAGRAPH",
              "nodes": [
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": {
                    "text": "Hello world",
                    "decorations": []
                  }
                }
              ],
              "paragraphData": {
                "textStyle": {
                  "textAlignment": "AUTO"
                }
              }
            }
          ]
        }
      `);
    });

    it('should convert empty paragraph to empty nodes', () => {
      const html = '<p></p>';
      const result = converter.convert(html);

      expect(result).toEqualWixRichText(`
        {
          "nodes": [
            {
              "type": "PARAGRAPH",
              "nodes": [],
              "paragraphData": {
                "textStyle": {
                  "textAlignment": "AUTO"
                }
              }
            }
          ]
        }
      `);
    });

    it('should handle plain text without tags', () => {
      const html = 'Plain text';
      const result = converter.convert(html);

      expect(result).toEqualWixRichText(`
        {
          "nodes": [
            {
              "type": "PARAGRAPH",
              "nodes": [
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": {
                    "text": "Plain text",
                    "decorations": []
                  }
                }
              ],
              "paragraphData": {
                "textStyle": {
                  "textAlignment": "AUTO"
                }
              }
            }
          ]
        }
      `);
    });

    it('should handle multiple paragraphs', () => {
      const html = '<p>First paragraph</p><p>Second paragraph</p>';
      const result = converter.convert(html);

      expect(result).toEqualWixRichText(`
        {
          "nodes": [
            {
              "type": "PARAGRAPH",
              "nodes": [
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": {
                    "text": "First paragraph",
                    "decorations": []
                  }
                }
              ],
              "paragraphData": {
                "textStyle": {
                  "textAlignment": "AUTO"
                }
              }
            },
            {
              "type": "PARAGRAPH",
              "nodes": [
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": {
                    "text": "Second paragraph",
                    "decorations": []
                  }
                }
              ],
              "paragraphData": {
                "textStyle": {
                  "textAlignment": "AUTO"
                }
              }
            }
          ]
        }
      `);
    });
  });

  describe('Text formatting', () => {
    it('should convert bold text with fontWeightValue', () => {
      const html = '<p>This is <strong>bold</strong> text</p>';
      const result = converter.convert(html);

      expect(result).toEqualWixRichText(`
        {
          "nodes": [
            {
              "type": "PARAGRAPH",
              "nodes": [
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": { "text": "This is ", "decorations": [] }
                },
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": {
                    "text": "bold",
                    "decorations": [{ "type": "BOLD", "fontWeightValue": 700 }]
                  }
                },
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": { "text": " text", "decorations": [] }
                }
              ],
              "paragraphData": {
                "textStyle": { "textAlignment": "AUTO" }
              }
            }
          ]
        }
      `);
    });

    it('should convert italic text', () => {
      const html = '<p>This is <em>italic</em> text</p>';
      const result = converter.convert(html);

      expect(result).toEqualWixRichText(`
        {
          "nodes": [
            {
              "type": "PARAGRAPH",
              "nodes": [
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": { "text": "This is ", "decorations": [] }
                },
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": {
                    "text": "italic",
                    "decorations": [{ "type": "ITALIC", "italicData": true }]
                  }
                },
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": { "text": " text", "decorations": [] }
                }
              ],
              "paragraphData": {
                "textStyle": { "textAlignment": "AUTO" }
              }
            }
          ]
        }
      `);
    });

    it('should convert underlined text', () => {
      const html = '<p>This is <u>underlined</u> text</p>';
      const result = converter.convert(html);

      expect(result).toEqualWixRichText(`
        {
          "nodes": [
            {
              "type": "PARAGRAPH",
              "nodes": [
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": { "text": "This is ", "decorations": [] }
                },
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": {
                    "text": "underlined",
                    "decorations": [{ "type": "UNDERLINE", "underlineData": true }]
                  }
                },
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": { "text": " text", "decorations": [] }
                }
              ],
              "paragraphData": {
                "textStyle": { "textAlignment": "AUTO" }
              }
            }
          ]
        }
      `);
    });

    it('should convert strikethrough text', () => {
      const html = '<p>This is <del>strikethrough</del> text</p>';
      const result = converter.convert(html);

      expect(result).toEqualWixRichText(`
        {
          "nodes": [
            {
              "type": "PARAGRAPH",
              "nodes": [
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": { "text": "This is ", "decorations": [] }
                },
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": {
                    "text": "strikethrough",
                    "decorations": [{ "type": "STRIKETHROUGH", "strikethroughData": true }]
                  }
                },
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": { "text": " text", "decorations": [] }
                }
              ],
              "paragraphData": {
                "textStyle": { "textAlignment": "AUTO" }
              }
            }
          ]
        }
      `);
    });

    it('should handle nested formatting', () => {
      const html = '<p><strong><em>Bold and italic</em></strong></p>';
      const result = converter.convert(html);

      expect(result).toEqualWixRichText(`
        {
          "nodes": [
            {
              "type": "PARAGRAPH",
              "nodes": [
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": {
                    "text": "Bold and italic",
                    "decorations": [
                      { "type": "BOLD", "fontWeightValue": 700 },
                      { "type": "ITALIC", "italicData": true }
                    ]
                  }
                }
              ],
              "paragraphData": {
                "textStyle": { "textAlignment": "AUTO" }
              }
            }
          ]
        }
      `);
    });

    it('should handle styled spans with color', () => {
      const html = '<p><span style="color: red;">Red text</span></p>';
      const result = converter.convert(html);

      expect(result).toEqualWixRichText(`
        {
          "nodes": [
            {
              "type": "PARAGRAPH",
              "nodes": [
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": {
                    "text": "Red text",
                    "decorations": [{ "type": "COLOR", "colorData": { "foreground": "red" } }]
                  }
                }
              ],
              "paragraphData": {
                "textStyle": { "textAlignment": "AUTO" }
              }
            }
          ]
        }
      `);
    });

    it('should handle font-size in spans', () => {
      const html = '<p><span style="font-size: 16px;">Sized text</span></p>';
      const result = converter.convert(html);

      expect(result).toEqualWixRichText(`
        {
          "nodes": [
            {
              "type": "PARAGRAPH",
              "nodes": [
                {
                  "type": "TEXT",
                  "nodes": [],
                  "textData": {
                    "text": "Sized text",
                    "decorations": [{ "type": "FONT_SIZE", "fontSizeData": { "unit": "PX", "value": 16 } }]
                  }
                }
              ],
              "paragraphData": {
                "textStyle": { "textAlignment": "AUTO" }
              }
            }
          ]
        }
      `);
    });
  });

  describe('Headings', () => {
    it('should convert all heading levels', () => {
      const html = '<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>';
      const result = converter.convert(html);

      expect(result.nodes).toHaveLength(6);
      for (let i = 0; i < 6; i++) {
        expect(result.nodes[i].type).toBe('HEADING');
        const heading = result.nodes[i] as WixHeadingNode;
        expect(heading.headingData.level).toBe(i + 1);
        expect(heading.nodes[0].textData.text).toBe(`H${i + 1}`);
      }
    });

    it('should handle heading with text alignment', () => {
      const html = '<h1 style="text-align: center;">Centered Heading</h1>';
      const result = converter.convert(html);

      const heading = result.nodes[0] as WixHeadingNode;
      expect(heading.headingData.textStyle?.textAlignment).toBe('CENTER');
    });
  });

  describe('Links', () => {
    it('should convert simple links', () => {
      const html = '<p><a href="https://example.com">Link text</a></p>';
      const result = converter.convert(html);

      const paragraph = result.nodes[0] as WixParagraphNode;
      expect(paragraph.nodes[0].textData.decorations[0]).toEqual({
        type: 'LINK',
        linkData: {
          link: {
            url: 'https://example.com',
          },
        },
      });
    });

    it('should convert links with target', () => {
      const html = '<p><a href="https://example.com" target="_blank">External link</a></p>';
      const result = converter.convert(html);

      const paragraph = result.nodes[0] as WixParagraphNode;
      expect(paragraph.nodes[0].textData.decorations[0]).toEqual({
        type: 'LINK',
        linkData: {
          link: {
            url: 'https://example.com',
            target: '_blank',
          },
        },
      });
    });
  });

  describe('Lists', () => {
    it('should convert bulleted lists', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const result = converter.convert(html);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('BULLETED_LIST');

      const list = result.nodes[0] as WixListNode;
      expect(list.nodes).toHaveLength(2);
      expect(list.bulletedListData).toEqual({ indentation: 0 });
      expect(list.nodes[0].type).toBe('LIST_ITEM');
      expect(list.nodes[1].type).toBe('LIST_ITEM');
    });

    it('should convert numbered lists correctly', () => {
      const html = '<ol><li><p>First</p></li><li><p>Second</p></li></ol>';
      const result = converter.convert(html);

      expect(result).toEqualWixRichText(`
        {
          "nodes": [
            {
              "type": "ORDERED_LIST",
              "nodes": [
                {
                  "type": "LIST_ITEM",
                  "nodes": [
                    {
                      "type": "PARAGRAPH",
                      "nodes": [
                        {
                          "type": "TEXT",
                          "nodes": [],
                          "textData": {
                            "text": "First",
                            "decorations": []
                          }
                        }
                      ],
                      "paragraphData": {
                        "textStyle": {
                          "textAlignment": "AUTO"
                        }
                      }
                    }
                  ],
                  "listItemData": {}
                },
                {
                  "type": "LIST_ITEM",
                  "nodes": [
                    {
                      "type": "PARAGRAPH",
                      "nodes": [
                        {
                          "type": "TEXT",
                          "nodes": [],
                          "textData": {
                            "text": "Second",
                            "decorations": []
                          }
                        }
                      ],
                      "paragraphData": {
                        "textStyle": {
                          "textAlignment": "AUTO"
                        }
                      }
                    }
                  ],
                  "listItemData": {}
                }
              ],
              "numberedListData": {
                "indentation": 0
              }
            }
          ]
        }
      `);
    });

    it('should handle complex list items with formatting', () => {
      const html = '<ul><li><strong>Bold item</strong> with normal text</li></ul>';
      const result = converter.convert(html);

      expect(result).toEqualWixRichText(`
        {
          "nodes": [
            {
              "type": "BULLETED_LIST",
              "nodes": [
                {
                  "type": "LIST_ITEM",
                  "nodes": [
                    {
                      "type": "PARAGRAPH",
                      "nodes": [
                        {
                          "type": "TEXT",
                          "nodes": [],
                          "textData": {
                            "text": "Bold item",
                            "decorations": [
                              {
                                "type": "BOLD",
                                "fontWeightValue": 700
                              }
                            ]
                          }
                        },
                        {
                          "type": "TEXT",
                          "nodes": [],
                          "textData": {
                            "text": " with normal text",
                            "decorations": []
                          }
                        }
                      ],
                      "paragraphData": {
                        "textStyle": {
                          "textAlignment": "AUTO"
                        }
                      }
                    }
                  ],
                  "listItemData": {}
                }
              ],
              "bulletedListData": {
                "indentation": 0
              }
            }
          ]
        }
      `);
    });
  });

  describe('Special elements', () => {
    it('should convert line breaks', () => {
      const html = 'Line 1<br>Line 2';
      const result = converter.convert(html);

      expect(result.nodes).toHaveLength(3);
      expect(result.nodes[1].type).toBe('PARAGRAPH');
      const brParagraph = result.nodes[1] as WixParagraphNode;
      expect(brParagraph.nodes).toEqual([]);
    });

    it('should convert horizontal rules', () => {
      const html = '<p>Before</p><hr><p>After</p>';
      const result = converter.convert(html);

      expect(result.nodes).toHaveLength(3);
      expect(result.nodes[1].type).toBe('DIVIDER');
    });

    it('should convert preformatted text', () => {
      const html = '<pre>Code block</pre>';
      const result = converter.convert(html);

      expect(result.nodes[0].type).toBe('CODE_BLOCK');
    });

    it('should convert blockquotes', () => {
      const html = '<blockquote><p>This is a quote</p></blockquote>';
      const result = converter.convert(html);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('BLOCKQUOTE');

      const blockquote = result.nodes[0] as WixBlockquoteNode;
      expect(blockquote.nodes).toHaveLength(1);
      expect(blockquote.nodes[0].type).toBe('PARAGRAPH');
      expect((blockquote.nodes[0] as WixParagraphNode).nodes[0].textData.text).toBe('This is a quote');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty HTML', () => {
      const html = '';
      const result = converter.convert(html);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('PARAGRAPH');
    });

    it('should handle whitespace-only text', () => {
      const html = '<p>   </p>';
      const result = converter.convert(html);

      const paragraph = result.nodes[0] as WixParagraphNode;
      expect(paragraph.nodes[0].textData.text).toBe('   ');
    });

    it('should generate unique IDs', () => {
      const html = '<p>Para 1</p><p>Para 2</p>';
      const result = converter.convert(html);

      expect(result.nodes[0].id).not.toBe(result.nodes[1].id);
      expect(result.nodes[0].id).toMatch(/^node_\d+_\d+$/);
    });

    it('should handle text alignment styles', () => {
      const alignments = ['left', 'center', 'right', 'justify'];
      const expectedAlignments = ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFY'];

      alignments.forEach((align, index) => {
        const html = `<p style="text-align: ${align};">Aligned text</p>`;
        const result = converter.convert(html);

        const paragraph = result.nodes[0] as WixParagraphNode;
        expect(paragraph.paragraphData?.textStyle?.textAlignment).toBe(expectedAlignments[index]);
      });
    });
  });
});

describe('WixToHtmlConverter', () => {
  let converter: WixToHtmlConverter;

  beforeEach(() => {
    converter = new WixToHtmlConverter({ prettify: false });
  });

  describe('Basic conversion', () => {
    it('should convert simple paragraph', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'PARAGRAPH',
            id: 'para1',
            nodes: [
              {
                type: 'TEXT',
                id: 'text1',
                nodes: [],
                textData: {
                  text: 'Hello world',
                  decorations: [],
                },
              },
            ],
            paragraphData: {},
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<p>Hello world</p>');
    });

    it('should convert empty paragraph to br tag', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'PARAGRAPH',
            id: 'para1',
            nodes: [],
            paragraphData: {},
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<br>');
    });

    it('should handle missing textData gracefully', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'PARAGRAPH',
            id: 'para1',
            nodes: [
              {
                type: 'TEXT',
                id: 'text1',
                nodes: [],
                textData: null as unknown as WixTextData,
              },
            ],
            paragraphData: {},
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<br>');
    });
  });

  describe('Text formatting', () => {
    it('should convert bold text with fontWeightValue', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'PARAGRAPH',
            id: 'para1',
            nodes: [
              {
                type: 'TEXT',
                id: 'text1',
                nodes: [],
                textData: {
                  text: 'Bold text',
                  decorations: [
                    {
                      type: 'BOLD',
                      fontWeightValue: 700,
                    },
                  ],
                },
              },
            ],
            paragraphData: {},
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<p><strong>Bold text</strong></p>');
    });

    it('should convert bold text with boldData', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'PARAGRAPH',
            id: 'para1',
            nodes: [
              {
                type: 'TEXT',
                id: 'text1',
                nodes: [],
                textData: {
                  text: 'Bold text',
                  decorations: [
                    {
                      type: 'BOLD',
                      boldData: true,
                    },
                  ],
                },
              },
            ],
            paragraphData: {},
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<p><strong>Bold text</strong></p>');
    });

    it('should convert italic text', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'PARAGRAPH',
            id: 'para1',
            nodes: [
              {
                type: 'TEXT',
                id: 'text1',
                nodes: [],
                textData: {
                  text: 'Italic text',
                  decorations: [
                    {
                      type: 'ITALIC',
                      italicData: true,
                    },
                  ],
                },
              },
            ],
            paragraphData: {},
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<p><em>Italic text</em></p>');
    });

    it('should convert strikethrough text', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'PARAGRAPH',
            id: 'para1',
            nodes: [
              {
                type: 'TEXT',
                id: 'text1',
                nodes: [],
                textData: {
                  text: 'Strikethrough text',
                  decorations: [
                    {
                      type: 'STRIKETHROUGH',
                      strikethroughData: true,
                    },
                  ],
                },
              },
            ],
            paragraphData: {},
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<p><del>Strikethrough text</del></p>');
    });

    it('should handle multiple decorations', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'PARAGRAPH',
            id: 'para1',
            nodes: [
              {
                type: 'TEXT',
                id: 'text1',
                nodes: [],
                textData: {
                  text: 'Formatted text',
                  decorations: [
                    { type: 'BOLD', fontWeightValue: 700 },
                    { type: 'ITALIC', italicData: true },
                  ],
                },
              },
            ],
            paragraphData: {},
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<p><em><strong>Formatted text</strong></em></p>');
    });

    it('should convert color decorations', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'PARAGRAPH',
            id: 'para1',
            nodes: [
              {
                type: 'TEXT',
                id: 'text1',
                nodes: [],
                textData: {
                  text: 'Red text',
                  decorations: [
                    {
                      type: 'COLOR',
                      colorData: {
                        foreground: '#ff0000',
                      },
                    },
                  ],
                },
              },
            ],
            paragraphData: {},
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<p><span style="color: #ff0000">Red text</span></p>');
    });

    it('should convert font size decorations', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'PARAGRAPH',
            id: 'para1',
            nodes: [
              {
                type: 'TEXT',
                id: 'text1',
                nodes: [],
                textData: {
                  text: 'Large text',
                  decorations: [
                    {
                      type: 'FONT_SIZE',
                      fontSizeData: {
                        unit: 'PX',
                        value: 24,
                      },
                    },
                  ],
                },
              },
            ],
            paragraphData: {},
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<p><span style="font-size: 24px">Large text</span></p>');
    });

    it('should convert link decorations', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'PARAGRAPH',
            id: 'para1',
            nodes: [
              {
                type: 'TEXT',
                id: 'text1',
                nodes: [],
                textData: {
                  text: 'Link text',
                  decorations: [
                    {
                      type: 'LINK',
                      linkData: {
                        link: {
                          url: 'https://example.com',
                          target: '_blank',
                        },
                      },
                    },
                  ],
                },
              },
            ],
            paragraphData: {},
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<p><a href="https://example.com" target="_blank">Link text</a></p>');
    });
  });

  describe('Headings', () => {
    it('should convert all heading levels', () => {
      for (let level = 1; level <= 6; level++) {
        const wixDoc: WixDocument = {
          nodes: [
            {
              type: 'HEADING',
              id: 'heading1',
              nodes: [
                {
                  type: 'TEXT',
                  id: 'text1',
                  nodes: [],
                  textData: {
                    text: `Heading ${level}`,
                    decorations: [],
                  },
                },
              ],
              headingData: {
                level: level as 1 | 2 | 3 | 4 | 5 | 6,
                textStyle: {
                  textAlignment: 'AUTO',
                },
              },
            },
          ],
        };

        const result = converter.convert(wixDoc);
        expect(result).toBe(`<h${level}>Heading ${level}</h${level}>`);
      }
    });

    it('should handle heading with text alignment', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'HEADING',
            id: 'heading1',
            nodes: [
              {
                type: 'TEXT',
                id: 'text1',
                nodes: [],
                textData: {
                  text: 'Centered heading',
                  decorations: [],
                },
              },
            ],
            headingData: {
              level: 1,
              textStyle: {
                textAlignment: 'CENTER',
              },
            },
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<h1 style="text-align: center">Centered heading</h1>');
    });
  });

  describe('Lists', () => {
    it('should convert bulleted lists', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'BULLETED_LIST',
            id: 'list1',
            nodes: [
              {
                type: 'LIST_ITEM',
                id: 'item1',
                nodes: [
                  {
                    type: 'PARAGRAPH',
                    id: 'para1',
                    nodes: [
                      {
                        type: 'TEXT',
                        id: 'text1',
                        nodes: [],
                        textData: {
                          text: 'Item 1',
                          decorations: [],
                        },
                      },
                    ],
                    paragraphData: {},
                  },
                ],
                listItemData: {},
              },
            ],
            bulletedListData: {
              indentation: 0,
            },
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<ul><li>Item 1</li></ul>');
    });

    it('should convert numbered lists', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'ORDERED_LIST',
            id: 'list1',
            nodes: [
              {
                type: 'LIST_ITEM',
                id: 'item1',
                nodes: [
                  {
                    type: 'PARAGRAPH',
                    id: 'para1',
                    nodes: [
                      {
                        type: 'TEXT',
                        id: 'text1',
                        nodes: [],
                        textData: {
                          text: 'First item',
                          decorations: [],
                        },
                      },
                    ],
                    paragraphData: {},
                  },
                ],
                listItemData: {},
              },
            ],
            numberedListData: {
              indentation: 0,
            },
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<ol><li>First item</li></ol>');
    });

    it('should handle empty list items', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'BULLETED_LIST',
            id: 'list1',
            nodes: [
              {
                type: 'LIST_ITEM',
                id: 'item1',
                nodes: [],
                listItemData: {},
              },
            ],
            bulletedListData: {
              indentation: 0,
            },
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<ul><li></li></ul>');
    });
  });

  describe('Special elements', () => {
    it('should convert dividers', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'DIVIDER',
            id: 'divider1',
            dividerData: {
              lineStyle: 'SINGLE',
            },
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<hr>');
    });

    it('should convert code blocks', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'CODE_BLOCK',
            id: 'code1',
            nodes: [
              {
                type: 'TEXT',
                id: 'text1',
                nodes: [],
                textData: {
                  text: 'console.log("Hello");',
                  decorations: [],
                },
              },
            ],
            codeBlockData: {
              textStyle: {
                textAlignment: 'LEFT',
              },
            },
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<pre>console.log("Hello");</pre>');
    });
  });

  describe('HTML escaping', () => {
    it('should escape HTML special characters', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'PARAGRAPH',
            id: 'para1',
            nodes: [
              {
                type: 'TEXT',
                id: 'text1',
                nodes: [],
                textData: {
                  text: '<script>alert("xss")</script>',
                  decorations: [],
                },
              },
            ],
            paragraphData: {},
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<p>&lt;script&gt;alert("xss")&lt;/script&gt;</p>');
    });

    it('should escape link URLs', () => {
      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'PARAGRAPH',
            id: 'para1',
            nodes: [
              {
                type: 'TEXT',
                id: 'text1',
                nodes: [],
                textData: {
                  text: 'Link',
                  decorations: [
                    {
                      type: 'LINK',
                      linkData: {
                        link: {
                          url: 'javascript:alert("xss")',
                        },
                      },
                    },
                  ],
                },
              },
            ],
            paragraphData: {},
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toBe('<p><a href="javascript:alert(&quot;xss&quot;)">Link</a></p>');
    });
  });

  describe('Prettification options', () => {
    it('should format with indentation when prettify is true', () => {
      const converter = new WixToHtmlConverter({ prettify: true, indentSize: 2 });

      const wixDoc: WixDocument = {
        nodes: [
          {
            type: 'BULLETED_LIST',
            id: 'list1',
            nodes: [
              {
                type: 'LIST_ITEM',
                id: 'item1',
                nodes: [
                  {
                    type: 'PARAGRAPH',
                    id: 'para1',
                    nodes: [
                      {
                        type: 'TEXT',
                        id: 'text1',
                        nodes: [],
                        textData: {
                          text: 'Item',
                          decorations: [],
                        },
                      },
                    ],
                    paragraphData: {},
                  },
                ],
                listItemData: {},
              },
            ],
            bulletedListData: { indentation: 0 },
          },
        ],
      };

      const result = converter.convert(wixDoc);
      expect(result).toContain('\n');
      expect(result).toContain('  <li>Item</li>');
    });
  });
});

describe('Round-trip conversion', () => {
  let htmlToWix: HtmlToWixConverter;
  let wixToHtml: WixToHtmlConverter;

  beforeEach(() => {
    htmlToWix = new HtmlToWixConverter();
    wixToHtml = new WixToHtmlConverter({ prettify: false });
  });

  it('should maintain content through round-trip conversion', () => {
    const originalHtml = '<h1>Title</h1><p>This is <strong>bold</strong> and <em>italic</em> text.</p>';

    const wixDoc = htmlToWix.convert(originalHtml);
    const convertedHtml = wixToHtml.convert(wixDoc);

    // The structure should be preserved even if formatting changes slightly
    expect(convertedHtml).toContain('<h1>Title</h1>');
    expect(convertedHtml).toContain('<strong>bold</strong>');
    expect(convertedHtml).toContain('<em>italic</em>');
  });

  it('should handle complex nested structures', () => {
    const originalHtml = `
      <h2>My List</h2>
      <ul>
        <li><strong>Bold item</strong> with normal text</li>
        <li>Item with <a href="https://example.com">link</a></li>
      </ul>
      <hr>
      <p>After divider</p>
    `;

    const wixDoc = htmlToWix.convert(originalHtml);
    const convertedHtml = wixToHtml.convert(wixDoc);

    expect(convertedHtml).toContain('<h2>My List</h2>');
    expect(convertedHtml).toContain('<ul>');
    expect(convertedHtml).toContain('<strong>Bold item</strong>');
    expect(convertedHtml).toContain('<a href="https://example.com">link</a>');
    expect(convertedHtml).toContain('<hr>');
  });

  it('should preserve text alignment', () => {
    const originalHtml = '<p style="text-align: center;">Centered text</p>';

    const wixDoc = htmlToWix.convert(originalHtml);
    const convertedHtml = wixToHtml.convert(wixDoc);

    expect(convertedHtml).toContain('style="text-align: center"');
  });

  it('should handle empty content gracefully', () => {
    const originalHtml = '';

    const wixDoc = htmlToWix.convert(originalHtml);
    const convertedHtml = wixToHtml.convert(wixDoc);

    expect(convertedHtml).toBe('<br>');
  });

  it('should preserve spacing between sections with empty paragraphs', () => {
    const originalHtml = '<h2>Section 1</h2><p>Content 1</p><p></p><h2>Section 2</h2><p>Content 2</p>';

    const wixDoc = htmlToWix.convert(originalHtml);
    const convertedHtml = wixToHtml.convert(wixDoc);

    // Empty paragraphs should become <br> tags to preserve spacing
    expect(convertedHtml).toContain('<br>');
    expect(convertedHtml).toContain('<h2>Section 1</h2>');
    expect(convertedHtml).toContain('<h2>Section 2</h2>');
  });

  it('should maintain spacing between multiple block elements', () => {
    const wixDoc: WixDocument = {
      nodes: [
        {
          type: 'HEADING',
          id: 'h1',
          nodes: [
            {
              type: 'TEXT',
              id: 't1',
              nodes: [],
              textData: { text: 'Heading', decorations: [] },
            },
          ],
          headingData: { level: 2 },
        },
        {
          type: 'PARAGRAPH',
          id: 'p1',
          nodes: [
            {
              type: 'TEXT',
              id: 't2',
              nodes: [],
              textData: { text: 'Paragraph', decorations: [] },
            },
          ],
          paragraphData: {},
        },
        {
          type: 'PARAGRAPH',
          id: 'p2',
          nodes: [], // Empty paragraph for spacing
          paragraphData: {},
        },
      ],
    };

    // Test with prettify=true (default)
    const prettifiedConverter = new WixToHtmlConverter({ prettify: true });
    const prettifiedHtml = prettifiedConverter.convert(wixDoc);

    // Should have all three elements
    expect(prettifiedHtml).toContain('<h2>Heading</h2>');
    expect(prettifiedHtml).toContain('<p>Paragraph</p>');
    expect(prettifiedHtml).toContain('<br>'); // Empty paragraph becomes br

    // Should have newlines between elements when prettified
    const parts = prettifiedHtml.split('\n');
    expect(parts.length).toBeGreaterThan(1);

    // Test with prettify=false
    const html = wixToHtml.convert(wixDoc);
    expect(html).toContain('<h2>Heading</h2>');
    expect(html).toContain('<p>Paragraph</p>');
    expect(html).toContain('<br>');
  });
});

describe('Markdown conversion pipeline', () => {
  let htmlToWix: HtmlToWixConverter;
  let wixToHtml: WixToHtmlConverter;
  let markdownIt: MarkdownIt;
  let turndownService: TurndownService;

  beforeEach(() => {
    htmlToWix = new HtmlToWixConverter();
    wixToHtml = new WixToHtmlConverter({ prettify: false });
    markdownIt = new MarkdownIt({});
    turndownService = new TurndownService({ headingStyle: 'atx' });
  });

  it('should preserve spacing through markdown round-trip (download path)', () => {
    // Simulate Wix content with spacing
    const wixDoc: WixDocument = {
      nodes: [
        {
          type: 'HEADING',
          id: 'h1',
          nodes: [
            {
              type: 'TEXT',
              id: 't1',
              nodes: [],
              textData: { text: 'Feeding and Diet', decorations: [] },
            },
          ],
          headingData: { level: 2 },
        },
        {
          type: 'PARAGRAPH',
          id: 'p1',
          nodes: [
            {
              type: 'TEXT',
              id: 't2',
              nodes: [],
              textData: { text: 'Whales have diverse diets depending on their type.', decorations: [] },
            },
          ],
          paragraphData: {},
        },
        {
          type: 'PARAGRAPH',
          id: 'p2',
          nodes: [], // Empty paragraph for spacing
          paragraphData: {},
        },
        {
          type: 'HEADING',
          id: 'h2',
          nodes: [
            {
              type: 'TEXT',
              id: 't3',
              nodes: [],
              textData: { text: 'Social Behavior', decorations: [] },
            },
          ],
          headingData: { level: 2 },
        },
        {
          type: 'PARAGRAPH',
          id: 'p3',
          nodes: [
            {
              type: 'TEXT',
              id: 't4',
              nodes: [],
              textData: { text: 'Whales exhibit a range of social behaviors.', decorations: [] },
            },
          ],
          paragraphData: {},
        },
      ],
    };

    // Simulate download: RICOS → HTML → Markdown
    const html = wixToHtml.convert(wixDoc);
    const markdown = turndownService.turndown(html);

    // Check markdown contains all content
    expect(markdown).toContain('## Feeding and Diet');
    expect(markdown).toContain('Whales have diverse diets');
    expect(markdown).toContain('## Social Behavior');
    expect(markdown).toContain('Whales exhibit a range');

    // Check for spacing/blank lines in markdown
    const markdownLines = markdown.split('\n');
    expect(markdownLines.length).toBeGreaterThan(4); // Should have multiple lines
  });

  it('should preserve spacing through markdown round-trip (upload path)', () => {
    // Simulate user creating markdown with spacing
    const markdown = `## Feeding and Diet

Whales have diverse diets depending on their type.

## Social Behavior

Whales exhibit a range of social behaviors.`;

    // Simulate upload: Markdown → HTML → RICOS
    const html = markdownIt.render(markdown);
    const wixDoc = htmlToWix.convert(html);

    // Should have headings and paragraphs
    expect(wixDoc.nodes.some((n) => n.type === 'HEADING')).toBe(true);
    expect(wixDoc.nodes.some((n) => n.type === 'PARAGRAPH')).toBe(true);

    // Count nodes to see if spacing is preserved
    const headings = wixDoc.nodes.filter((n) => n.type === 'HEADING');
    const paragraphs = wixDoc.nodes.filter((n) => n.type === 'PARAGRAPH');

    expect(headings.length).toBe(2);
    expect(paragraphs.length).toBeGreaterThanOrEqual(2); // At least the content paragraphs
  });

  it('should preserve content through full markdown round-trip', () => {
    // Start with markdown
    const originalMarkdown = `## Introduction

This is the first paragraph.

## Conclusion

This is the last paragraph.`;

    // Upload: Markdown → HTML → RICOS
    const htmlFromMarkdown = markdownIt.render(originalMarkdown);
    const wixDoc = htmlToWix.convert(htmlFromMarkdown);

    // Download: RICOS → HTML → Markdown
    const htmlFromWix = wixToHtml.convert(wixDoc);
    const finalMarkdown = turndownService.turndown(htmlFromWix);

    // Check that content is preserved
    expect(finalMarkdown).toContain('Introduction');
    expect(finalMarkdown).toContain('first paragraph');
    expect(finalMarkdown).toContain('Conclusion');
    expect(finalMarkdown).toContain('last paragraph');
  });
});
