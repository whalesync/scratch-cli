/**
 * CSV parsing and markdown generation utilities for CSV to MD folder conversion.
 * Mirrors the logic from scratch-cli/internal/csv/import.go
 */

export interface CsvColumnInfo {
  name: string;
  index: number;
  sampleValues: string[];
  inferredType: 'text' | 'number' | 'boolean';
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  columns: CsvColumnInfo[];
}

/**
 * Parse CSV content string into headers and rows.
 * Handles quoted fields, commas within quotes, and UTF-8 BOM.
 */
export function parseCSV(content: string): ParsedCsv {
  // Strip UTF-8 BOM if present
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const lines = parseCSVLines(content);

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const headers = lines[0];
  const rows = lines.slice(1).filter((row) => row.some((cell) => cell.trim() !== ''));

  if (rows.length === 0) {
    throw new Error('CSV file has no data rows (only headers)');
  }

  const columns = inferColumnTypes(headers, rows);

  return { headers, rows, columns };
}

/**
 * Parse CSV content into array of rows, handling quoted fields properly.
 */
function parseCSVLines(content: string): string[][] {
  const result: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ("")
        if (i + 1 < content.length && content[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      currentField += char;
      i++;
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
        continue;
      }
      if (char === '\n' || (char === '\r' && content[i + 1] === '\n')) {
        currentRow.push(currentField);
        result.push(currentRow);
        currentRow = [];
        currentField = '';
        i += char === '\r' ? 2 : 1;
        continue;
      }
      if (char === '\r') {
        // Handle standalone \r as line ending
        currentRow.push(currentField);
        result.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      }
      currentField += char;
      i++;
    }
  }

  // Handle last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    result.push(currentRow);
  }

  return result;
}

/**
 * Infer column types from sample values.
 */
export function inferColumnTypes(headers: string[], rows: string[][]): CsvColumnInfo[] {
  return headers.map((header, index) => {
    const sampleValues: string[] = [];

    // Collect up to 5 non-empty sample values
    for (let i = 0; i < rows.length && sampleValues.length < 5; i++) {
      const value = rows[i][index];
      if (value && value.trim() !== '') {
        sampleValues.push(value);
      }
    }

    const inferredType = inferType(sampleValues);

    return {
      name: header,
      index,
      sampleValues,
      inferredType,
    };
  });
}

/**
 * Infer the data type from sample values.
 */
function inferType(samples: string[]): 'text' | 'number' | 'boolean' {
  if (samples.length === 0) {
    return 'text';
  }

  let allNumbers = true;
  let allBooleans = true;

  for (const v of samples) {
    const trimmed = v.trim();
    if (trimmed === '') continue;

    // Check if number
    if (isNaN(parseFloat(trimmed)) || !isFinite(Number(trimmed))) {
      allNumbers = false;
    }

    // Check if boolean
    const lower = trimmed.toLowerCase();
    if (!['true', 'false', 'yes', 'no', '1', '0'].includes(lower)) {
      allBooleans = false;
    }
  }

  if (allBooleans) return 'boolean';
  if (allNumbers) return 'number';
  return 'text';
}

/**
 * Convert a string to a valid filename slug.
 */
export function slugify(s: string): string {
  // Convert to lowercase
  let result = s.toLowerCase();

  // Replace spaces and underscores with hyphens
  result = result.replace(/[\s_]+/g, '-');

  // Remove non-alphanumeric characters except hyphens
  result = result.replace(/[^a-z0-9-]/g, '');

  // Collapse multiple hyphens
  result = result.replace(/-+/g, '-');

  // Trim leading/trailing hyphens
  result = result.replace(/^-+|-+$/g, '');

  // Handle empty result
  if (result === '') {
    return 'untitled';
  }

  return result;
}

/**
 * Generate markdown content with YAML frontmatter.
 */
export function generateMarkdown(
  row: Record<string, string>,
  contentColumns: string[],
  metadataColumns: string[]
): string {
  const lines: string[] = [];

  // Build frontmatter
  lines.push('---');

  for (const col of metadataColumns) {
    const value = row[col];
    if (value && value.trim() !== '') {
      // Escape special YAML characters if needed
      const escapedValue = escapeYamlValue(value);
      lines.push(`${col}: ${escapedValue}`);
    }
  }

  lines.push('---');

  // Build content body (concatenate content columns)
  const contentParts: string[] = [];
  for (const col of contentColumns) {
    const value = row[col];
    if (value && value.trim() !== '') {
      contentParts.push(value);
    }
  }

  if (contentParts.length > 0) {
    lines.push(contentParts.join('\n\n'));
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Escape a value for YAML output.
 */
function escapeYamlValue(value: string): string {
  // If value contains special characters, quote it
  if (
    value.includes(':') ||
    value.includes('#') ||
    value.includes("'") ||
    value.includes('"') ||
    value.includes('\n') ||
    value.startsWith(' ') ||
    value.endsWith(' ')
  ) {
    // Use double quotes and escape internal double quotes
    return `"${value.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  }
  return value;
}

/**
 * Generate a unique filename, handling duplicates by appending a suffix.
 */
export function generateUniqueFilename(
  baseName: string,
  usedFilenames: Set<string>
): string {
  let filename = baseName;
  let counter = 1;

  while (usedFilenames.has(filename)) {
    counter++;
    filename = `${baseName}-${counter}`;
  }

  usedFilenames.add(filename);
  return filename;
}

/**
 * Generate preview data for sample rows.
 */
export interface MarkdownPreview {
  filename: string;
  frontmatter: Record<string, string>;
  body: string;
  rawMarkdown: string;
}

export function generatePreviews(
  csv: ParsedCsv,
  config: {
    nameColumn: string;
    contentColumns: string[];
    includedColumns: string[];
  },
  count: number = 3
): MarkdownPreview[] {
  const previews: MarkdownPreview[] = [];
  const usedFilenames = new Set<string>();

  // Determine metadata columns (included minus name and content)
  const metadataColumns = config.includedColumns.filter(
    (col) => col !== config.nameColumn && !config.contentColumns.includes(col)
  );

  const previewCount = Math.min(count, csv.rows.length);

  for (let i = 0; i < previewCount; i++) {
    const row = csv.rows[i];
    const rowMap: Record<string, string> = {};

    for (let j = 0; j < csv.headers.length; j++) {
      rowMap[csv.headers[j]] = row[j] || '';
    }

    // Determine filename
    const nameValue = rowMap[config.nameColumn];
    let baseFilename: string;
    if (nameValue && nameValue.trim() !== '') {
      baseFilename = slugify(nameValue);
    } else {
      baseFilename = `row-${i + 1}`;
    }

    const filename = generateUniqueFilename(baseFilename, usedFilenames) + '.md';

    // Build frontmatter object
    const frontmatter: Record<string, string> = {};
    for (const col of metadataColumns) {
      const value = rowMap[col];
      if (value && value.trim() !== '') {
        frontmatter[col] = value;
      }
    }

    // Build body
    const bodyParts: string[] = [];
    for (const col of config.contentColumns) {
      const value = rowMap[col];
      if (value && value.trim() !== '') {
        bodyParts.push(value);
      }
    }
    const body = bodyParts.join('\n\n');

    const rawMarkdown = generateMarkdown(rowMap, config.contentColumns, metadataColumns);

    previews.push({
      filename,
      frontmatter,
      body,
      rawMarkdown,
    });
  }

  return previews;
}
