export interface CsvRecord {
  id: string;
  fields: Record<string, string>;
}

export interface CsvData {
  headers: string[];
  records: CsvRecord[];
}

export function parseCsv(csvContent: string): CsvData {
  const lines = csvContent.split('\n').filter((line) => line.trim() !== '');

  if (lines.length === 0) {
    return { headers: [], records: [] };
  }

  // Parse headers from first line
  const headers = parseCsvLine(lines[0]);

  // Parse records from remaining lines
  const records: CsvRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const fields: Record<string, string> = {};

    // Map values to headers
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = j < values.length ? values[j] : '';
      fields[header] = value;
    }

    // Use row index as ID (1-based to match spreadsheet rows)
    records.push({
      id: (i + 1).toString(),
      fields,
    });
  }

  return { headers, records };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add the last field
  result.push(current.trim());

  return result;
}
