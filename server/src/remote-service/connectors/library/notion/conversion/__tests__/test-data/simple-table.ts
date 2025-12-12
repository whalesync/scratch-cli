import { ConvertedNotionBlock } from '../../notion-rich-text-push-types';

/**
 * Simple table test case with column headers
 * Tests basic table structure with headers and data rows
 */
export const SIMPLE_TABLE_BLOCKS = {
  children: [
    {
      id: 'table-block-1',
      object: 'block',
      has_children: true,
      type: 'table',
      table: {
        table_width: 3,
        has_column_header: true,
        has_row_header: false,
      },
      children: [
        // Header row
        {
          id: 'table-row-header',
          object: 'block',
          has_children: false,
          type: 'table_row',
          table_row: {
            cells: [
              [
                {
                  type: 'text',
                  text: {
                    content: 'Name',
                    link: null,
                  },
                  annotations: {
                    bold: false,
                    italic: false,
                    strikethrough: false,
                    underline: false,
                    code: false,
                    color: 'default',
                  },
                  plain_text: 'Name',
                  href: null,
                },
              ],
              [
                {
                  type: 'text',
                  text: {
                    content: 'Age',
                    link: null,
                  },
                  annotations: {
                    bold: false,
                    italic: false,
                    strikethrough: false,
                    underline: false,
                    code: false,
                    color: 'default',
                  },
                  plain_text: 'Age',
                  href: null,
                },
              ],
              [
                {
                  type: 'text',
                  text: {
                    content: 'City',
                    link: null,
                  },
                  annotations: {
                    bold: false,
                    italic: false,
                    strikethrough: false,
                    underline: false,
                    code: false,
                    color: 'default',
                  },
                  plain_text: 'City',
                  href: null,
                },
              ],
            ],
          },
        },
        // Data row 1
        {
          id: 'table-row-1',
          object: 'block',
          has_children: false,
          type: 'table_row',
          table_row: {
            cells: [
              [
                {
                  type: 'text',
                  text: {
                    content: 'Alice',
                    link: null,
                  },
                  annotations: {
                    bold: false,
                    italic: false,
                    strikethrough: false,
                    underline: false,
                    code: false,
                    color: 'default',
                  },
                  plain_text: 'Alice',
                  href: null,
                },
              ],
              [
                {
                  type: 'text',
                  text: {
                    content: '30',
                    link: null,
                  },
                  annotations: {
                    bold: false,
                    italic: false,
                    strikethrough: false,
                    underline: false,
                    code: false,
                    color: 'default',
                  },
                  plain_text: '30',
                  href: null,
                },
              ],
              [
                {
                  type: 'text',
                  text: {
                    content: 'New York',
                    link: null,
                  },
                  annotations: {
                    bold: false,
                    italic: false,
                    strikethrough: false,
                    underline: false,
                    code: false,
                    color: 'default',
                  },
                  plain_text: 'New York',
                  href: null,
                },
              ],
            ],
          },
        },
        // Data row 2
        {
          id: 'table-row-2',
          object: 'block',
          has_children: false,
          type: 'table_row',
          table_row: {
            cells: [
              [
                {
                  type: 'text',
                  text: {
                    content: 'Bob',
                    link: null,
                  },
                  annotations: {
                    bold: false,
                    italic: false,
                    strikethrough: false,
                    underline: false,
                    code: false,
                    color: 'default',
                  },
                  plain_text: 'Bob',
                  href: null,
                },
              ],
              [
                {
                  type: 'text',
                  text: {
                    content: '25',
                    link: null,
                  },
                  annotations: {
                    bold: false,
                    italic: false,
                    strikethrough: false,
                    underline: false,
                    code: false,
                    color: 'default',
                  },
                  plain_text: '25',
                  href: null,
                },
              ],
              [
                {
                  type: 'text',
                  text: {
                    content: 'San Francisco',
                    link: null,
                  },
                  annotations: {
                    bold: false,
                    italic: false,
                    strikethrough: false,
                    underline: false,
                    code: false,
                    color: 'default',
                  },
                  plain_text: 'San Francisco',
                  href: null,
                },
              ],
            ],
          },
        },
        // Data row 3
        {
          id: 'table-row-3',
          object: 'block',
          has_children: false,
          type: 'table_row',
          table_row: {
            cells: [
              [
                {
                  type: 'text',
                  text: {
                    content: 'Charlie',
                    link: null,
                  },
                  annotations: {
                    bold: false,
                    italic: false,
                    strikethrough: false,
                    underline: false,
                    code: false,
                    color: 'default',
                  },
                  plain_text: 'Charlie',
                  href: null,
                },
              ],
              [
                {
                  type: 'text',
                  text: {
                    content: '35',
                    link: null,
                  },
                  annotations: {
                    bold: false,
                    italic: false,
                    strikethrough: false,
                    underline: false,
                    code: false,
                    color: 'default',
                  },
                  plain_text: '35',
                  href: null,
                },
              ],
              [
                {
                  type: 'text',
                  text: {
                    content: 'Los Angeles',
                    link: null,
                  },
                  annotations: {
                    bold: false,
                    italic: false,
                    strikethrough: false,
                    underline: false,
                    code: false,
                    color: 'default',
                  },
                  plain_text: 'Los Angeles',
                  href: null,
                },
              ],
            ],
          },
        },
      ],
    },
  ] as ConvertedNotionBlock[],
};
