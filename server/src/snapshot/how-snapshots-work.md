# Overview

This is a quick overview of how snapshots work.

![[how-snapshots-work.svg]]

A workbook contains multiple snapshot tables. Each snapshot table has:

- "Normal" columns that represent the currently saved values of the data (the remote value if unchanged, or a local value if they've been edited by the user)
- Special columns prefixed with `__` that contain other data like AI suggestions and metadata, such as which fields have been edited.

# Actions

### Publish

- Ask user to accept/reject any pending suggestions into "saved value columns"
- Look at bits in the `__edited_fields`
- Push create/edit/delete diffs depending on which records were edited\*
- Update saved value columns

\*Note: today, we don't know what data changed in a field, we just know that a field did change, so we push that field. We can't show the user "here's the old vs. new value".

### Pull/refresh snapshot (!!!note: this does not work yet; today we just discard user edits)

- Poll data sources for records
- Do the following depending on `__edited_fields`:
  - If a column has not been edited, replace its value
  - If a column has been edited by the user, leave it alone
  - If a record is new, add it
  - If a record has been deleted by the user, we keep it deleted

### Save

- Save any edits in the browser to the current values tables\*

\*Note: for Scratch-only CSVs, this saves CSVs back to our database; that's the only place they live so there's no remote data source to publish back to.

### Download

- Download CSVs of the snapshot tables with saved value columns

Upload:

- Replace saved value tables with changes from the temporary "uploaded" tables
