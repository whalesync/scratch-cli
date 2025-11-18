Experiment: asked AI to sumarize the feature, mostly for it's own sake so that it can reason about it more easily in future prompts.

# Import Suggestions Feature

## Overview

This feature allows users to import suggestions from a CSV file. The CSV file should have a specific format where:

- The first column must be named `wsId` (the record identifier)
- Each subsequent column corresponds to a field in the table
- Only non-empty values are imported as suggestions
- The CSV is processed in chunks of 5 records at a time (configurable)

## CSV Format Example

```csv
wsId,c1,c2,c3
abc,,1,
xyz,,,2
def,hello,world,
```

In this example:

- Record `abc` will get a suggestion to update column `c2` to `1`
- Record `xyz` will get a suggestion to update column `c3` to `2`
- Record `def` will get suggestions to update column `c1` to `hello` and column `c2` to `world`

## Implementation Details

### Backend

1. **Controller** (`server/src/workbook/snapshot.controller.ts`):

   - New endpoint: `POST /workbook/:id/tables/:tableId/import-suggestions`
   - Accepts file upload via multipart/form-data
   - Returns: `{ recordsProcessed: number, suggestionsCreated: number }`

2. **Service** (`server/src/workbook/snapshot.service.ts`):

   - Method: `importSuggestions(workbookId, tableId, buffer, userId)`
   - Uses `csv-parse` library to parse CSV
   - Validates that `wsId` column exists
   - Maps column names to column IDs
   - Processes records in chunks of 5
   - Creates suggestions using existing `bulkUpdateRecords` method with type='suggested'

3. **DTO** (`server/src/workbook/dto/import-suggestions.dto.ts`):

   - `ImportSuggestionsDto`: Request DTO (currently minimal)
   - `ImportSuggestionsResponseDto`: Response with counts

4. **Middleware** (`server/src/app.module.ts`):
   - Excluded the import-suggestions endpoint from JSON body middleware to allow file uploads

### Frontend

1. **API Client** (`client/src/lib/api/snapshot.ts`):

   - New method: `importSuggestions(workbookId, tableId, file)`
   - Uses FormData to upload file

2. **UI** (`client/src/app/snapshots/[...slug]/components/SnapshotActionsMenu.tsx`):
   - Added "Import Suggestions" button in the CSV section of the menu
   - File input accepts only `.csv` files
   - Shows loading state while uploading
   - Displays success/error notifications

## How to Use

1. Navigate to a snapshot with tables
2. Click the three-dot menu in the top right
3. Under the "CSV" section, click "Import Suggestions" for the desired table
4. Select a CSV file with the correct format
5. The system will process the file and create suggestions
6. A notification will show how many records were processed and suggestions created

## Testing

To test this feature:

1. Create a CSV file with the format described above
2. Ensure the `wsId` values correspond to existing records in the table
3. Ensure the column names match the table's column names
4. Upload the file using the "Import Suggestions" button
5. Verify the suggestions appear in the grid
6. Accept or reject the suggestions as needed

### Sample CSV for Testing

Create a file named `test-suggestions.csv`:

```csv
wsId,ColumnName1,ColumnName2,ColumnName3
record_id_1,new_value_1,,
record_id_2,,new_value_2,
record_id_3,,,new_value_3
```

Replace:

- `ColumnName1`, `ColumnName2`, `ColumnName3` with actual column names from your table
- `record_id_1`, `record_id_2`, `record_id_3` with actual record wsId values

## Configuration

The chunk size is currently hardcoded to 5 records in `server/src/workbook/snapshot.service.ts` at line ~1511:

```typescript
const chunkSize = 5;
```

This can be changed to 100 or any other value as needed.

## Notes

- Empty cells in the CSV are ignored (no suggestion created)
- If a column name in the CSV doesn't match any table column, a warning is logged
- The feature uses the same suggestion mechanism as the AI agent
- Suggestions require user approval before being applied to records
