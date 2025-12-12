import { ConvertedNotionBlock } from '../../notion-rich-text-push-types';

/**
 * Test data for block types not covered in other test files:
 * - toggle blocks
 * - video blocks
 * - audio blocks
 * - link_preview
 * - child_page (data loss test)
 */
export const ADDITIONAL_BLOCK_TYPES = {
  children: [
    // Toggle block
    {
      id: 'toggle-block-1',
      object: 'block',
      has_children: true,
      type: 'toggle',
      toggle: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: 'Click to expand this section',
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
            plain_text: 'Click to expand this section',
            href: null,
          },
        ],
        color: 'default',
      },
      children: [
        {
          id: 'toggle-child-1',
          object: 'block',
          has_children: false,
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: 'This content is hidden inside the toggle.',
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
                plain_text: 'This content is hidden inside the toggle.',
                href: null,
              },
            ],
            color: 'default',
          },
        },
        {
          id: 'toggle-child-2',
          object: 'block',
          has_children: false,
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: 'Nested list item',
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
                plain_text: 'Nested list item',
                href: null,
              },
            ],
            color: 'default',
          },
        },
      ],
    },
    // Video block
    {
      id: 'video-block-1',
      object: 'block',
      has_children: false,
      type: 'video',
      video: {
        type: 'external',
        external: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        },
        caption: [
          {
            type: 'text',
            text: {
              content: 'Tutorial video',
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
            plain_text: 'Tutorial video',
            href: null,
          },
        ],
      },
    },
    // Audio block
    {
      id: 'audio-block-1',
      object: 'block',
      has_children: false,
      type: 'audio',
      audio: {
        type: 'external',
        external: {
          url: 'https://example.com/podcast-episode.mp3',
        },
        caption: [
          {
            type: 'text',
            text: {
              content: 'Podcast Episode 42',
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
            plain_text: 'Podcast Episode 42',
            href: null,
          },
        ],
      },
    },
    // Link preview block
    {
      id: 'link-preview-1',
      object: 'block',
      has_children: false,
      type: 'link_preview',
      link_preview: {
        url: 'https://github.com/anthropics/claude-code',
      },
    },
    // Child page block (should produce data loss warning)
    {
      id: 'child-page-1',
      object: 'block',
      has_children: false,
      type: 'child_page',
      child_page: {
        title: 'Meeting Notes - January 2024',
      },
    },
    // To-do items
    {
      id: 'todo-1',
      object: 'block',
      has_children: false,
      type: 'to_do',
      to_do: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: 'Complete the quarterly report',
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
            plain_text: 'Complete the quarterly report',
            href: null,
          },
        ],
        checked: false,
        color: 'default',
      },
    },
    {
      id: 'todo-2',
      object: 'block',
      has_children: false,
      type: 'to_do',
      to_do: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: 'Review pull requests',
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
            plain_text: 'Review pull requests',
            href: null,
          },
        ],
        checked: true,
        color: 'default',
      },
    },
  ] as ConvertedNotionBlock[],
};
