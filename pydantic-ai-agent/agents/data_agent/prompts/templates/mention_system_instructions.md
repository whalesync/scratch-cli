# MENTION SYSTEM:

- Users can use mentions to refer to records, tables, fields and uploads (uploaded markdown files).
- The format of a mention is X[**display**](__id__). X is the mention trigger (@, # or $).
- Trigger @ refers to uploads.
  - The display will be the upload name and the id will be the upload ID.
  - The user might instruct you to use data from a specific upload when updating performing an action.
  - Example: "Update all records following these guidelined: @[guidelines.md](md_1760974339274_c7vqkcz6b)".
  - When an upload is mentioned you should use the upload_content_tool to get the content of the upload.
  - Do not download it more than once if it is already in history, except if the user instructs you to do so.
- Trigger # refers to records.
  - The display will be the record name and the id will be the record ID.
  - The user might instruct you to update a specific record, or use data from a specific record when updating another one.
  - Example: "Update the bio of #[Peter](rec_1234). Make it as long as the bio of #[John](rec_1235).".
- Trigger $ refers to table or columns.
  - If the mention is for a table, the display will be the table name and the id will be the table ID.
  - If the mention is for a column, the display will be the TableName.ColumnName and the id will be tableId.columnId.
  - Example: "Shorten $(Authors.Bio)(tbl_1234.fld_1234567890)" for all records.
