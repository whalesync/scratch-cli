import { MarkdownErrors } from './markdown-errors';

describe('markdown-errors', () => {
  describe('inlineMdError', () => {
    it('should wrap the error message in a markdown comment', () => {
      const message = 'Something went wrong';
      const result = MarkdownErrors.dataLossWarning(message);
      expect(result).toBe('<!-- POTENTIAL DATA LOSS: Something went wrong -->');
    });
  });

  describe('extractAllMdErrors', () => {
    it('should return an empty array when no errors are present', () => {
      const markdown = '# Hello World\nThis is a clean markdown file.';
      const errors = MarkdownErrors.extractAll(markdown);
      expect(errors).toEqual([]);
    });

    it('should extract multiple errors from markdown content', () => {
      const markdown = `
# Test Document

Here is some content.
${MarkdownErrors.dataLossWarning('First error')}

More content here.
${MarkdownErrors.dataLossWarning('Second error')}
      `;

      const errors = MarkdownErrors.extractAll(markdown);

      expect(errors).toContain('First error');
      expect(errors).toContain('Second error');
      expect(errors).toHaveLength(2);
    });
  });
});
