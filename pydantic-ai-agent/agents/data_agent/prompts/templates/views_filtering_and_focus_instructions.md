# RECORD FILTERING:

- The user can filter the data so you can see a subset of the records using SQL WHERE clauses.
- When users want to hide certain records from future analysis or processing, they can ask you to apply SQL filters
- Use set_filter_tool to apply SQL WHERE clauses as filters on tables
- IMPORTANT: Only call set_filter_tool ONCE per table per conversation - if you need to modify the filter, call it again with the new SQL clause
- Filtered records are excluded from future data retrieval operations, so they won't appear in subsequent prompts
- This is useful when users want to focus on a subset of records or exclude irrelevant data from future processing

## SQL Filtering Examples:

- "Show only active records" → SQL: `status = 'active'`
- "Hide records older than 2024" → SQL: `created_at >= '2024-01-01'`
- "Show only high priority items" → SQL: `priority IN ('high', 'critical')`
- "Filter out records with empty names" → SQL: `name IS NOT NULL AND name != ''`
- "Show records from engineering department with age > 25" → SQL: `department = 'engineering' AND age > 25`
- "Clear the filter" → SQL: `null` or empty string

## SQL Filter Syntax:

- Use standard SQL WHERE clause syntax without the "WHERE" keyword. You can only provide the content of the `WHERE` clause.
- **You cannot use `ORDER BY`, `LIMIT`, or other clauses that are not part of a `WHERE` clause.** However, you can use these within a subquery. For example: `id IN (SELECT id FROM "{workbook_id}"."{wsId}" ORDER BY age DESC LIMIT 2)`.
- When filtering by record identifiers, you **must** use the `"wsId"` column (e.g., `"wsId" IN ('sre_AJqpyocH4L', 'sre_00d4vQEF9u')`). Do not use `id`.
- The SQL clause is applied directly to the **current active table**. Therefore, you **must not** include the table name (e.g., `FROM "Table 1"`) in the SQL clause itself for direct column references.
- Refer to columns by their names directly (e.g., `age > 25`, not `"Table 1".age > 25`).
- **IMPORTANT for Subqueries**: If you need to refer to a table within a subquery (e.g., `(SELECT MAX(age) FROM ...)`), you **must** use the fully qualified table name in the format: `"{workbook_id}"."{wsId}"` (e.g., `"sna_FUxZJOTmRL"."table_1"`). Do not use the display name (e.g., "Table 1"). The `workbook_id` and `wsId` can be found in the current context.
- Support operators: =, !=, >, <, >=, <=, LIKE, IN, IS NULL, IS NOT NULL, AND, OR
- String values should be quoted: `status = 'active'`
- Multiple conditions use AND/OR: `age > 25 AND department = 'engineering'`
- Pattern matching: `name LIKE '%john%'`
- Lists: `priority IN ('high', 'medium', 'critical')`

# TABLE and COLUMN VIEWS:

- Tables and columns can be set as hidden (in which case you see no values at all in this table/column).
