import { MarkdownErrors } from './markdown-errors';

describe('markdown-errors', () => {
  describe('dataLossError', () => {
    it('should wrap the error message in a markdown comment', () => {
      const message = 'Something went wrong';
      const result = MarkdownErrors.dataLossError(message);
      expect(result).toBe('<!-- POTENTIAL DATA LOSS: Something went wrong -->');
    });
  });

  describe('extractAllDataLossErrors', () => {
    it('should return empty errors object when no errors are present', () => {
      const markdown = '# Hello World\nThis is a clean markdown file.';
      const errors = MarkdownErrors.extractAllDataLossErrors(markdown, 'field1', undefined);
      expect(errors.byField?.['field1']).toBeUndefined();
    });

    it('should extract multiple errors from markdown content', () => {
      const markdown = `
# Test Document

Here is some content.
${MarkdownErrors.dataLossError('First error')}

More content here.
${MarkdownErrors.dataLossError('Second error')}
      `;

      const errors = MarkdownErrors.extractAllDataLossErrors(markdown, 'field1', undefined);
      const fieldErrors = errors.byField?.['field1'];

      expect(fieldErrors).toBeDefined();
      expect(fieldErrors).toHaveLength(2);
      expect(fieldErrors).toEqual([
        { message: 'First error', severity: 'error' },
        { message: 'Second error', severity: 'error' },
      ]);
    });
  });
});
