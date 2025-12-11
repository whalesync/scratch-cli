import { RecordErrorsMetadata } from './types';

const DATA_LOSS_WARNING_PREFIX = 'POTENTIAL DATA LOSS:';

export class MarkdownErrors {
  /**
   * This must be used to add a warning to the markdown content wherever a node is dropped from the conversion process.
   * It will be displayed in the UI with special treatment, and also be visible to the user.
   */
  static dataLossError(message: string): string {
    return `<!-- ${DATA_LOSS_WARNING_PREFIX} ${message} -->`;
  }

  /**
   * Converters should be smart enough to add specific `dataLossWarning()` messages for the actual fields that aren't supported in MD.
   * Until that time, here's a generic message that can be added anywhere. */
  static addFieldFidelityWarning(
    errors: RecordErrorsMetadata | undefined,
    fieldId: string,
    connectorName: string,
  ): RecordErrorsMetadata {
    const message = `Some ${connectorName} content cannot be represented in Markdown. Content may be lost when you publish this record.`;
    return {
      ...errors,
      byField: {
        ...(errors?.byField ?? {}),
        [fieldId]: [{ message, severity: 'warning' }],
      },
    };
  }

  /** Returns all errors from the markdown content. */
  static extractAllDataLossErrors(
    markdown: string,
    fieldId: string,
    existingErrors: RecordErrorsMetadata | undefined,
  ): RecordErrorsMetadata {
    // TODO: Expand this to get any other types of errors we generate and remember their types.
    const regex = new RegExp(`<!-- ${DATA_LOSS_WARNING_PREFIX} (.*?) -->`, 'g');
    const matches = markdown.matchAll(regex);
    const newErrors: RecordErrorsMetadata = existingErrors ?? {};
    const fieldArray = newErrors.byField?.[fieldId] ?? [];
    for (const match of matches) {
      fieldArray.push({ message: match[1], severity: 'error' });
    }
    if (newErrors.byField) {
      newErrors.byField[fieldId] = fieldArray;
    } else {
      newErrors.byField = {
        [fieldId]: fieldArray,
      };
    }
    return newErrors;
  }
}
