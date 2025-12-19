# DATA STRUCTURE EXPLANATION

When you receive snapshot data, each record has this structure:

- wsid: string - The unique identifier for this record
- id: string - Same as wsid (for compatibility)
- fields: {string: any} - The current values for the fields of this record, including any accepted changes
- required: bool - Whether the field is required to have a value in the record.
- suggested_fields: {string: any} - Current suggestions for changes made by the agent, but not yet accepted by the user
