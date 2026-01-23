import {
  BaseColumnSpec,
  BaseTableSpec,
  FieldValidationContext,
  FileValidationInput,
  FileValidationResult,
  FileValidatorOptions,
  PostgresColumnType,
} from './types';

// ============================================================================
// Default Validators
// ============================================================================

/**
 * Default email validation regex.
 * Simple pattern that covers most common cases.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates a boolean field.
 * Accepts actual booleans or string representations 'true'/'false'.
 */
function validateBoolean(ctx: FieldValidationContext): string | undefined {
  const { value, fieldName } = ctx;
  if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
    return `Invalid type for "${fieldName}": expected boolean, got ${typeof value}`;
  }
  return undefined;
}

/**
 * Validates a numeric field.
 * Accepts numbers or strings that can be parsed as numbers.
 * Respects numberFormat metadata for integer validation.
 */
function validateNumeric(ctx: FieldValidationContext): string | undefined {
  const { value, fieldName, metadata } = ctx;
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (typeof numValue !== 'number' || isNaN(numValue)) {
    return `Invalid type for "${fieldName}": expected number, got ${typeof value}`;
  }

  // Check integer format if specified
  if (metadata?.numberFormat === 'integer' && !Number.isInteger(numValue)) {
    return `Invalid type for "${fieldName}": expected integer, got decimal`;
  }

  return undefined;
}

/**
 * Validates a timestamp field (PostgreSQL TIMESTAMP type).
 * Accepts Date objects or strings that can be parsed as dates.
 */
function validateTimestamp(ctx: FieldValidationContext): string | undefined {
  const { value, fieldName } = ctx;

  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return `Invalid type for "${fieldName}": expected valid date string, got "${value}"`;
    }
  } else if (!(value instanceof Date)) {
    return `Invalid type for "${fieldName}": expected date, got ${typeof value}`;
  }

  return undefined;
}

/**
 * Validates a text field.
 * Handles special text formats: email, url, and options/enum validation.
 */
function validateText(ctx: FieldValidationContext): string | undefined {
  const { value, fieldName, metadata } = ctx;

  if (typeof value !== 'string') {
    return `Invalid type for "${fieldName}": expected string, got ${typeof value}`;
  }

  // Validate email format
  if (metadata?.textFormat === 'email') {
    if (!EMAIL_REGEX.test(value)) {
      return `Invalid format for "${fieldName}": expected valid email address`;
    }
  }

  // Validate URL format
  if (metadata?.textFormat === 'url') {
    try {
      new URL(value);
    } catch {
      return `Invalid format for "${fieldName}": expected valid URL`;
    }
  }

  // Validate date format (for connectors that store dates as TEXT)
  if (metadata?.dateFormat) {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return `Invalid format for "${fieldName}": expected valid ${metadata.dateFormat} string`;
    }
  }

  // Validate option fields (if options are defined)
  if (metadata?.options && metadata.options.length > 0 && !metadata.allowAnyOption) {
    const validValues = metadata.options.map((opt) => opt.value);
    if (!validValues.includes(value)) {
      const validLabels = metadata.options.map((opt) => opt.label || opt.value).join(', ');
      return `Invalid value for "${fieldName}": must be one of: ${validLabels}`;
    }
  }

  return undefined;
}

/**
 * Validates a JSONB field.
 * Accepts objects, arrays, or strings that can be parsed as JSON.
 */
function validateJsonb(ctx: FieldValidationContext): string | undefined {
  const { value, fieldName } = ctx;

  if (typeof value !== 'object' && !Array.isArray(value)) {
    // Allow strings that might be JSON
    if (typeof value === 'string') {
      try {
        JSON.parse(value);
      } catch {
        return `Invalid type for "${fieldName}": expected JSON object or array`;
      }
    } else {
      return `Invalid type for "${fieldName}": expected JSON object or array`;
    }
  }

  return undefined;
}

/**
 * Validates a TEXT_ARRAY field.
 * Accepts arrays or strings that can be parsed as JSON arrays.
 */
function validateTextArray(ctx: FieldValidationContext): string | undefined {
  const { value, fieldName } = ctx;

  if (Array.isArray(value)) {
    return undefined;
  }

  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        return `Invalid type for "${fieldName}": expected array`;
      }
    } catch {
      return `Invalid type for "${fieldName}": expected array or JSON array string`;
    }
  } else {
    return `Invalid type for "${fieldName}": expected array, got ${typeof value}`;
  }

  return undefined;
}

// ============================================================================
// Core Validation Functions
// ============================================================================

/**
 * Validates a NUMERIC_ARRAY field.
 * Accepts arrays of numbers or strings that can be parsed as JSON arrays of numbers.
 */
function validateNumericArray(ctx: FieldValidationContext): string | undefined {
  const { value, fieldName } = ctx;

  if (Array.isArray(value)) {
    for (const item of value as unknown[]) {
      const numValue = typeof item === 'string' ? parseFloat(item) : item;
      if (typeof numValue !== 'number' || isNaN(numValue)) {
        return `Invalid type for "${fieldName}": expected array of numbers`;
      }
    }
    return undefined;
  }

  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        return `Invalid type for "${fieldName}": expected array of numbers`;
      }
    } catch {
      return `Invalid type for "${fieldName}": expected array of numbers or JSON array string`;
    }
  } else {
    return `Invalid type for "${fieldName}": expected array of numbers, got ${typeof value}`;
  }

  return undefined;
}

/**
 * Validates a BOOLEAN_ARRAY field.
 * Accepts arrays of booleans or strings that can be parsed as JSON arrays of booleans.
 */
function validateBooleanArray(ctx: FieldValidationContext): string | undefined {
  const { value, fieldName } = ctx;

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== 'boolean' && item !== 'true' && item !== 'false') {
        return `Invalid type for "${fieldName}": expected array of booleans`;
      }
    }
    return undefined;
  }

  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        return `Invalid type for "${fieldName}": expected array of booleans`;
      }
    } catch {
      return `Invalid type for "${fieldName}": expected array of booleans or JSON array string`;
    }
  } else {
    return `Invalid type for "${fieldName}": expected array of booleans, got ${typeof value}`;
  }

  return undefined;
}

/**
 * Default type validators mapped by PostgreSQL column type.
 */
const DEFAULT_TYPE_VALIDATORS: Partial<
  Record<PostgresColumnType, (ctx: FieldValidationContext) => string | undefined>
> = {
  [PostgresColumnType.BOOLEAN]: validateBoolean,
  [PostgresColumnType.NUMERIC]: validateNumeric,
  [PostgresColumnType.TIMESTAMP]: validateTimestamp,
  [PostgresColumnType.TEXT]: validateText,
  [PostgresColumnType.JSONB]: validateJsonb,
  [PostgresColumnType.TEXT_ARRAY]: validateTextArray,
  [PostgresColumnType.NUMERIC_ARRAY]: validateNumericArray,
  [PostgresColumnType.BOOLEAN_ARRAY]: validateBooleanArray,
};

/**
 * Validates a single field value against its expected type.
 * Uses default validators that can be overridden via options.
 *
 * @param ctx - The field validation context
 * @param options - Optional custom validators and settings
 * @returns An error message if validation fails, undefined if valid
 */
export function validateFieldType(ctx: FieldValidationContext, options?: FileValidatorOptions): string | undefined {
  const { pgType } = ctx;

  // Check for custom validator override
  const customValidator = options?.customTypeValidators?.[pgType];
  if (customValidator) {
    const customResult = customValidator(ctx);
    // null means skip validation entirely
    if (customResult === null) {
      return undefined;
    }
    // string means error, undefined means fall through to default
    if (customResult !== undefined) {
      return customResult;
    }
  }

  // Use default validator
  const defaultValidator = DEFAULT_TYPE_VALIDATORS[pgType];
  if (defaultValidator) {
    const error = defaultValidator(ctx);
    if (error) {
      return error;
    }
  }

  // Run additional validators if provided
  if (options?.additionalValidators) {
    for (const validator of options.additionalValidators) {
      const error = validator(ctx);
      if (error) {
        return error;
      }
    }
  }

  return undefined;
}

/**
 * Validates files against a table schema.
 * Checks for:
 * - Missing required fields
 * - Unknown fields not in schema
 * - Data type validation based on pgType and metadata
 *
 * @param tableSpec - The table specification with column definitions
 * @param files - The files to validate
 * @param options - Optional customization for connector-specific behavior
 * @returns Validation results for each file
 */
export function validate<TColumn extends BaseColumnSpec>(
  tableSpec: BaseTableSpec<TColumn>,
  files: FileValidationInput[],
  options?: FileValidatorOptions,
): FileValidationResult[] {
  // Build a map of field names to column specs for easy lookup
  const columnMap = new Map<string, TColumn>();
  const requiredFields: string[] = [];

  for (const column of tableSpec.columns) {
    columnMap.set(column.id.wsId, column);
    if (column.required && !column.readonly) {
      requiredFields.push(column.id.wsId);
    }
  }

  // Default ignored fields
  const defaultIgnoredFields = ['remoteId', '_content'];
  const ignoredFields = new Set(
    options?.ignoredFields ? defaultIgnoredFields.concat(Array.from(options.ignoredFields)) : defaultIgnoredFields,
  );

  return files.map((file) => {
    const errors: string[] = [];

    // Check for missing required fields
    for (const requiredField of requiredFields) {
      const value = file.data[requiredField];
      if (value === undefined || value === null || value === '') {
        const column = columnMap.get(requiredField);
        const fieldName = column?.slug || column?.name || requiredField;
        errors.push(`Missing required field: "${fieldName}"`);
      }
    }

    // Check for unknown fields and validate data types
    for (const [fieldKey, value] of Object.entries(file.data)) {
      if (ignoredFields.has(fieldKey)) {
        continue;
      }

      const column = columnMap.get(fieldKey);

      // Check for unknown fields
      if (!column) {
        errors.push(`Unknown field not in schema: "${fieldKey}"`);
        continue;
      }

      // Skip type validation for null/undefined/empty values (handled by required check)
      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Build validation context
      const ctx: FieldValidationContext = {
        fieldKey,
        fieldName: column.slug || column.name || fieldKey,
        value,
        pgType: column.pgType,
        metadata: column.metadata,
      };

      // Validate data types based on pgType and metadata
      const typeError = validateFieldType(ctx, options);
      if (typeError) {
        errors.push(typeError);
      }
    }

    return {
      filename: file.filename,
      id: file.id,
      data: file.data,
      publishable: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  });
}

// ============================================================================
// Pre-built Options for Common Connectors
// ============================================================================

/**
 * Default options for Webflow connector.
 * Uses TIMESTAMP pgType for date fields.
 */
export const WEBFLOW_VALIDATOR_OPTIONS: FileValidatorOptions = {
  // Webflow uses standard validation
};

/**
 * Default options for WordPress connector.
 * WordPress stores dates as TEXT with dateFormat metadata.
 */
export const WORDPRESS_VALIDATOR_OPTIONS: FileValidatorOptions = {
  // WordPress uses TEXT+dateFormat for dates, which is handled by validateText
  // No special overrides needed since validateText checks metadata.dateFormat
};
