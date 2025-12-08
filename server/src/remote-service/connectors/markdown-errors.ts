const DATA_LOSS_WARNING_PREFIX = 'POTENTIAL DATA LOSS:';

export class MarkdownErrors {
  /**
   * This must be used to add a warning to the markdown content wherever a node is dropped from the conversion process.
   * It will be displayed in the UI with special treatment, and also be visible to the user.
   */
  static dataLossWarning(message: string): string {
    return `<!-- ${DATA_LOSS_WARNING_PREFIX} ${message} -->`;
  }

  /** Returns all errors from the markdown content. */
  static extractAll(markdown: string): string[] {
    // TODO: Expand this to get any other types of errors we generate and remember their types.
    const regex = new RegExp(`<!-- ${DATA_LOSS_WARNING_PREFIX} (.*?) -->`, 'g');
    const matches = markdown.matchAll(regex);
    return Array.from(matches, (match) => match[1]);
  }
}
