-- I'm changing the default data converter from HTML to Markdown for Webflow tables.
-- Before, we need to materialize the default to the existing one, so we don't get a mismatch between what we
-- downloaded and what we will write back.
UPDATE
	"SnapshotTable" st
SET
	"columnSettings" = coalesce(st."columnSettings", '{}'::jsonb) || (
		SELECT
			jsonb_object_agg(col -> 'id' ->> 'wsId', jsonb_build_object('dataConverter', 'markdown'))
		FROM
			jsonb_array_elements(st."tableSpec" -> 'columns') AS col
		WHERE
			col -> 'metadata' ->> 'textFormat' = 'html'
			AND (st."columnSettings" IS NULL
				OR st."columnSettings" -> (col -> 'id' ->> 'wsId') IS NULL
				OR st."columnSettings" -> (col -> 'id' ->> 'wsId') ->> 'dataConverter' IS NULL
				OR st."columnSettings" -> (col -> 'id' ->> 'wsId') ->> 'dataConverter' = ''))
WHERE
	EXISTS (
		SELECT
			1
		FROM
			jsonb_array_elements(st."tableSpec" -> 'columns') AS col
		WHERE
			st."connectorService" = 'WEBFLOW'
			AND col -> 'metadata' ->> 'textFormat' = 'html'
			AND (st."columnSettings" IS NULL
				OR st."columnSettings" -> (col -> 'id' ->> 'wsId') IS NULL
				OR st."columnSettings" -> (col -> 'id' ->> 'wsId') ->> 'dataConverter' IS NULL
				OR st."columnSettings" -> (col -> 'id' ->> 'wsId') ->> 'dataConverter' = ''));