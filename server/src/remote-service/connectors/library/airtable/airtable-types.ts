/**
 * Our names for the data types that airtable uses. The original Airtable data type is the part of the string after
 * "airtable/" and before a colon. For example, the `DATETIME` Airtable type is "date", but our versions of it
 * are "airtable/date:dateOnly" and "airtable/date:dateTime" to disambiguate the same type with different options.
 */
export enum AirtableDataType {
  AUTONUMBER = 'airtable/autoNumber',
  BARCODE = 'airtable/barcode',
  BUTTON = 'airtable/button',
  CHECKBOX = 'airtable/checkbox',
  COLLABORATOR = 'airtable/collaborator',
  /** In the Airtable UI, these are "Created By" and "Last Modified By" fields. */
  COMPUTATION = 'airtable/computation',
  COUNT = 'airtable/count',
  DATE_ONLY = 'airtable/date:dateOnly',
  DATETIME = 'airtable/date:dateTime',
  /** This is always an array, even though the UI lets you chose whether to allow multiple items or not. */
  FOREIGN_KEY = 'airtable/foreignKey',
  // The formula types correspond to both "formula" and "rollup" fields in the Airtable UI. We further subdivide
  // them by data type.
  FORMULA_DATE = 'airtable/formula:date',
  FORMULA_NUMBER = 'airtable/formula:number',
  FORMULA_TEXT = 'airtable/formula:text',

  // Lookup fields are special because they can be any other result type.
  // TODO: With the new data type design, these can all be collapsed down to one "LOOKUP" type.
  //
  // NOTE: The values in these lookup fields are **always** arrays. Single-lookup fields (lookup fields that reference
  // single linked record fields) become a one-element array. Multi-lookup fields (lookup fields that reference
  // multi linked record fields) are naturally arrays due to the multiple foreign records. Arrays of arrays, such as
  // multi lookup fields of multi-select fields, get flattened to a single array.
  // NOTE: If adding a new lookup type, you must also add it to LOOKUP_TYPES and AirtableLookupDataType below.
  LOOKUP_BARCODE = 'airtable/lookup:barcode',
  LOOKUP_BUTTON = 'airtable/lookup:button',
  LOOKUP_CHECKBOX = 'airtable/lookup:checkbox',
  LOOKUP_COLLABORATOR = 'airtable/lookup:collaborator',
  LOOKUP_COMPUTATION = 'airtable/lookup:computation',
  LOOKUP_DATE_ONLY = 'airtable/lookup:dateOnly',
  LOOKUP_DATETIME = 'airtable/lookup:dateTime',
  LOOKUP_FOREIGN_KEY = 'airtable/lookup:foreignKey',
  LOOKUP_MULTILINE_TEXT = 'airtable/lookup:multilineText',
  LOOKUP_MULTIPLE_ATTACHMENT = 'airtable/lookup:multipleAttachment',
  LOOKUP_MULTIPLE_ATTACHMENT_V2 = 'airtable/lookup:multipleAttachmentV2',
  LOOKUP_NUMBER = 'airtable/lookup:number',
  LOOKUP_RICH_TEXT = 'airtable/lookup:richText',
  LOOKUP_RICH_TEXT_V2 = 'airtable/lookup:richTextV2',
  LOOKUP_TEXT = 'airtable/lookup:text',
  LOOKUP_AI_MULTILINE_TEXT = 'airtable/lookup:aiText',

  // TODO: Add multi-collaborator.
  MULTICOLLABORATOR = 'airtable/multiCollaborator',
  MULTILINE_TEXT = 'airtable/multilineText',
  MULTIPLE_ATTACHMENT = 'airtable/multipleAttachment',
  MULTIPLE_ATTACHMENT_V2 = 'airtable/multipleAttachmentV2',
  MULTISELECT = 'airtable/multiSelect',
  NUMBER = 'airtable/number',
  PHONE = 'airtable/phone',
  RATING = 'airtable/rating',
  RICH_TEXT = 'airtable/richText',
  RICH_TEXT_V2 = 'airtable/richTextV2',
  SELECT = 'airtable/select',
  TEXT = 'airtable/text',
  URL = 'airtable/url',
  // AI Fields
  AI_MULTILINE_TEXT = 'airtable/aiText',

  // None of the above.
  UNKNOWN = 'airtable/unknown',
}

// Airtable-specific error messages.
export const AIRTABLE_SYNC_TO_VIEW_DISALLOWED = 'Syncing records to an Airtable View is not supported.';

// NOTE: If adding a new lookup type, you must also add it to AirtableLookupDataType below.
const LOOKUP_TYPES = [
  AirtableDataType.LOOKUP_BARCODE,
  AirtableDataType.LOOKUP_BUTTON,
  AirtableDataType.LOOKUP_CHECKBOX,
  AirtableDataType.LOOKUP_COLLABORATOR,
  AirtableDataType.LOOKUP_COMPUTATION,
  AirtableDataType.LOOKUP_DATE_ONLY,
  AirtableDataType.LOOKUP_DATETIME,
  AirtableDataType.LOOKUP_FOREIGN_KEY,
  AirtableDataType.LOOKUP_MULTILINE_TEXT,
  AirtableDataType.LOOKUP_MULTIPLE_ATTACHMENT,
  AirtableDataType.LOOKUP_MULTIPLE_ATTACHMENT_V2,
  AirtableDataType.LOOKUP_NUMBER,
  AirtableDataType.LOOKUP_RICH_TEXT,
  AirtableDataType.LOOKUP_RICH_TEXT_V2,
  AirtableDataType.LOOKUP_TEXT,
  AirtableDataType.LOOKUP_AI_MULTILINE_TEXT,
] as const;

// NOTE: If adding a new lookup type, you must also add it to LOOKUP_TYPES above.
export type AirtableLookupDataType =
  | AirtableDataType.LOOKUP_BARCODE
  | AirtableDataType.LOOKUP_BUTTON
  | AirtableDataType.LOOKUP_CHECKBOX
  | AirtableDataType.LOOKUP_COLLABORATOR
  | AirtableDataType.LOOKUP_COMPUTATION
  | AirtableDataType.LOOKUP_DATE_ONLY
  | AirtableDataType.LOOKUP_DATETIME
  | AirtableDataType.LOOKUP_FOREIGN_KEY
  | AirtableDataType.LOOKUP_MULTILINE_TEXT
  | AirtableDataType.LOOKUP_MULTIPLE_ATTACHMENT
  | AirtableDataType.LOOKUP_MULTIPLE_ATTACHMENT_V2
  | AirtableDataType.LOOKUP_NUMBER
  | AirtableDataType.LOOKUP_RICH_TEXT
  | AirtableDataType.LOOKUP_RICH_TEXT_V2
  | AirtableDataType.LOOKUP_TEXT
  | AirtableDataType.LOOKUP_AI_MULTILINE_TEXT;

/** Returns true if the data type is one of the lookup column types. */
export function isLookupColumn(dataType: AirtableDataType): dataType is AirtableLookupDataType {
  return (LOOKUP_TYPES as unknown as AirtableDataType[]).includes(dataType);
}

/**
 * Format of the type options for a date field. It usually includes more keys than below, but we only care about is
 * `isDateTime`.
 */
export interface AirtableDateTypeOptions {
  isDateTime: boolean;
}

/**
 * Format of the type options for a formula field. It usually includes more keys than below, but we only care about is
 * `resultType`.
 */
export interface AirtableFormulaTypeOptions {
  resultType: string;
}

export interface AirtableColumnTypeOptions {
  /** Present in foreign key fields. */
  foreignTableId?: string;

  /** Present in foreign key fields. 'one' = single foreign key field. 'many' = multi-foreign key field. */
  relationship?: 'one' | 'many';

  /**
   * Present in lookup fields. This is the foreign key column that this lookup fields points to (not the root of the
   * lookup field).
   */
  relationColumnId?: string;

  /**
   * Present if this AirtableColumn is a button, computation, count, formula, lookup, or rollup field. These are
   * fields that depend on a foreign key field.
   */
  dependencies?: {
    /**
     * This is a list of Airtable column IDs that trace back to the next field in the full chain of fields for a source
     * of data (e.g. a lookup fields). This list appears to have at most 2 elements, where the first element is the a
     * foreign key field and the second element is the column in the table pointed to by the foreign key (which can
     * itself be another lookup fields).
     *
     * If there are no other fields for the source of the data (e.g. a computation field or a formula field that doesn't
     * depend on any other fields), this is an empty list.
     */
    referencedColumnIdsForValue: string[];

    /**
     * List of field IDs that are not "valid" for some reason. If this list exists and is non-empty, that indicates the
     * field has a configuration error.
     */
    invalidColumnIds?: string[];
  };

  /**
   * This should always be present in formula and lookup fields. If it isn't, that indicates the field has a
   * configuration error.
   */
  resultType?: string;

  /** Formula fields specify whether they produce an array. */
  resultIsArray?: boolean;

  /** If present, this indicates the field has a configuration error. */
  formulaError?: string;

  /** If present, this is the formula used. */
  formulaTextParsed?: string;

  /** Select and Multiselect fields provide info on the choices as a map from ID to a dictionary of details. */
  choices?: Record<string, { name?: string }>;

  /** Maximum value for a Rating field. Minimum is always '1' */
  max?: number;

  /**
   * Type of number field.
   * Expected values: 'integer', 'decimal', 'currency', "percentV2"
   */
  format?: string;

  /** Precision on a number field. Number of places after the decimal */
  precision?: number;

  /** Whether a number field accepts negative numbers. */
  negative?: boolean;

  /** The validators that airtable applies. */
  validatorName?: string;
}

/**
 * Airtable metadata response for an individual column.
 */
export interface AirtableColumn {
  id: string;
  name: string;
  type: string;
  typeOptions?: AirtableColumnTypeOptions;
}

/**
 * Some column types reference other columns. This captures once we've resolved that indirection. For a column that does
 * not reference another column, the `type === rootType` and `rootType === rootColumn`.
 */
export type ResolvedAirtableColumn = {
  /** The data type of the column. This includes lookup and non-lookup field types. */
  type: AirtableDataType;
  /** The full column data from Airtable. */
  originalColumn: AirtableColumn;
  /**
   * The type of the root column in the chain of references for `originalColumn`. This can never be a lookup type
   * because a lookup type is never a terminal node in the reference chain.
   */
  rootType: Exclude<AirtableDataType, AirtableLookupDataType>;
  /** The full column data from Airtable for the terminal node in the reference chain. */
  rootColumn: AirtableColumn;
};

/**
 * Some column types reference other columns. This captures once we've resolved that indirection. For a column that does
 * not reference another column, the `type === rootType` and `rootType === rootColumn`.
 */
export type ResolvedAirtableColumnV2 = {
  /** The data type of the column. This includes lookup and non-lookup field types. */
  type: AirtableDataType;
  /** The full column data from Airtable. */
  originalColumn: AirtableFieldsV2;
  /**
   * The type of the root column in the chain of references for `originalColumn`. This can never be a lookup type
   * because a lookup type is never a terminal node in the reference chain.
   */
  rootType: Exclude<AirtableDataType, AirtableLookupDataType>;
  /** The full column data from Airtable for the terminal node in the reference chain. */
  rootColumn: AirtableFieldsV2;
};

/** https://airtable.com/developers/web/api/get-base-schema */
export interface AirtableBaseSchemaResponseV2 {
  tables: AirtableTableV2[];
}

export interface AirtableTableV2 {
  description: string;
  fields: AirtableFieldsV2[];
  id: string;
  name: string;
  primaryFieldId: string;
  views: AirtableTableView[];
}

export interface AirtableFieldsV2 {
  description?: string;
  id: string;
  name: string;
  /** https://airtable.com/developers/web/api/field-model */
  type: string;
  options?: AirtableFieldOptionsV2;
}

/** This type includes options for a wide range of different data types.
 * For more in depth info you can check all data types in https://airtable.com/developers/web/api/field-model
 */
export interface AirtableFieldOptionsV2 {
  inverseLinkFieldId?: string;
  isReversed: boolean;
  linkedTableId?: string;
  fieldIdInLinkedTable?: string;
  recordLinkFieldId?: string;
  prefersSingleRecordLink?: boolean;
  isValid?: boolean;
  result?: AirtableFieldsV2;
  precision?: number;
  max?: number;
  formula?: string;
}

/**
 * Airtable metadata response for an individual table.
 */
export interface AirtableTable {
  id: string;
  name: string;
  primaryColumnId: string;
  columns: AirtableColumn[];
  views: AirtableTableView[];
}

export interface AirtableTableView {
  id: string;
  name: string;
  type: string;
}

/**
 * Airtable metadata response for a base.
 */
export interface AirtableMetadata {
  tableSchemas: AirtableTable[];
}

/**
 * The format of a raw Airtable record when sending the record to the API.
 */
export type AirtableRecordRequest = {
  /** The remote ID of the Airtable record. Only populate if updating an existing record, otherwise this is not set. */
  id?: string;

  /**
   * The cells of the record, indexed by the **remote column IDs**. NOTE: The API documentation says that this should be
   * indexed based on the display names, but using the remote column IDs works too (undocumented behavior) and it's
   * better for us.
   */
  fields: Record<string, unknown>;
};

/**
 * The format of a raw Airtable record as sent in a response from the API.
 */
export interface AirtableRecord {
  id: string;

  /** The cells of the record, indexed by the column **display names**, not the column IDs. */
  fields: Record<string, unknown>;

  /** The time the record was created in Airtable, in the ISO format "2021-12-16T21:22:22.000Z". */
  createdTime: string;
}

export interface AirtableApiResponse {
  /** An error, if any. */
  error?: { type?: string } | string;
  // Looks like some endpoints return an array of errors instead of an object
  // TODO: shouldn't we have a separate type for the errors? Can we have a reesponse with both data and errors?
  // https://linear.app/whalesync/issue/DEV-6555/better-error-message-for-when-we-hit-the-airtable-api-limit
  errors?: { error?: string; message?: string }[];
}

/**
 * The format of an Airtable polling response from their normal API.
 */
export interface AirtableApiPollingResponse extends AirtableApiResponse {
  /** The pagination cursor if there's more data in the next page. */
  offset?: string;

  /** The raw records, if any. */
  records?: AirtableRecord[];
}

/** https://airtable.com/developers/web/api/create-a-webhook. */
export type AirtableApiCreateTableRequest = {
  name: string;
  /**
   * Requires initial primary field only. Other fields can be created later
   */
  fields: AirtableApiCreateField[];
};
export interface AirtableApiCreateTableResponse extends AirtableApiResponse {
  description?: string;
  fields: AirtableApiCreateFieldResponse[];
  id: string;
  name: string;
  primaryFieldId: string;
  views: [
    {
      id: string;
      name: string;
      type: string;
    },
  ];
}

export interface AirtableApiCreateFieldResponse extends AirtableApiResponse {
  id: string;
  name: string;
} // TODO: add other fields

/**
 * The format of an Airtable response when fetching one record from their normal API.
 */
export interface AirtableApiGetRecordResponse extends AirtableApiResponse, AirtableRecord {}

export interface AirtableApiPushResponse extends AirtableApiResponse {
  /** The raw records, if any. */
  records?: AirtableRecord[];
}

/**
 * The format of an Airtable response when deleting one or multiple records from their normal API.
 */
export interface AirtableApiDeleteRecordResponse extends AirtableApiResponse {
  /**
   * A list of records that the caller tried to delete, with their IDs and a bit indicating whether they were deleted.
   */
  records?: {
    id: string;
    deleted: boolean;
  }[];
}

/** https://airtable.com/developers/web/api/list-bases. */
export type AirtableBases = {
  id: string;
  name: string;
  permissionLevel: 'none' | 'read' | 'comment' | 'edit' | 'create';
};

/** https://airtable.com/developers/web/api/list-bases. */
export interface AirtableListBasesResponse extends AirtableApiResponse {
  bases: AirtableBases[];
  offset?: string;
}

/** https://airtable.com/developers/web/api/model/webhooks-notification. */
export type AirtableWebhookNotificationResult = {
  completionTimestamp: string; // ISO format, e.g. '2023-01-20T00:00:00.000Z'.
  durationMs: number; // e.g. 2.603.
  retryNumber: number;
  success: boolean;
};

/** https://airtable.com/developers/web/api/model/webhooks-specification. */
export type AirtableWebhookSpecification = {
  options: {
    filters: {
      dataTypes: Array<'tableData' | 'tableFields' | 'tableMetadata'>;
      recordChangeScope?: string;
      changeTypes?: Array<'add' | 'remove' | 'update'>;
      fromSources?: Array<string>;
      sourceOptions?: { formSubmission?: { viewId: string } };
      watchDataInFieldIds?: Array<string>;
      watchSchemasOfFieldIds?: Array<string>;
    };
    includes?: {
      includeCellValuesInFieldIds?: Array<string>;
      includePreviousCellValues?: boolean;
      includePreviousFieldDefinitions?: boolean;
    };
  };
};

/** https://airtable.com/developers/web/api/list-webhooks. */
export type AirtableWebhookRegistration = {
  areNotificationsEnabled: boolean;
  cursorForNextPayload: number;
  expirationTime: string; // ISO format, e.g. '2023-01-20T00:00:00.000Z'.
  id: string; // e.g. 'ach00000000000000'
  isHookEnabled: boolean;
  lastNotificationResult: AirtableWebhookNotificationResult;
  lastSuccessfulNotificationTime: string; // ISO format, e.g. '2023-01-20T00:00:00.000Z'.
  notificationUrl: string; // e.g. 'https://foo.com/receive-ping'
  specification: AirtableWebhookSpecification;
};

/** https://airtable.com/developers/web/api/list-webhooks. */
export type AirtableApiListWebhooksResponse = AirtableApiResponse & {
  webhooks: AirtableWebhookRegistration[];
};

/** https://airtable.com/developers/web/api/create-a-webhook. */
export type AirtableApiCreateWebhookRequest = {
  notificationUrl: string;
  specification: AirtableWebhookSpecification;
};

/** https://airtable.com/developers/web/api/create-a-webhook. */
export type AirtableApiCreateWebhookResponse = AirtableApiResponse & {
  expirationTime: string; // ISO format, e.g. '2023-01-20T00:00:00.000Z'.
  id: string; // e.g. 'ach00000000000000'
  macSecretBase64: string;
};

/** https://airtable.com/developers/web/api/delete-a-webhook. */
export type AirtableApiDeleteWebhookResponse = Record<string, never>;

/** https://airtable.com/developers/web/api/refresh-a-webhook. */
export type AirtableApiRefreshWebhookResponse = AirtableApiResponse & {
  expirationTime: string; // ISO format, e.g. '2023-01-20T00:00:00.000Z'.
};

/**
 * This is the payload that Airtable sends to Whalesync when an event happens in a base. It only has the base ID and the
 * webhook ID, which need to be used to fetched the full payload from Airtable.
 *
 * https://airtable.com/developers/web/api/webhooks-overview#webhook-notification-delivery.
 */
export type AirtableWebhookNotificationTiny = {
  base: {
    id: string; // The base ID, e.g. 'app00000000000000'.
  };
  webhook: {
    id: string; // The webhook ID, e.g. 'ach00000000000000'.
  };
  timestamp: string; // ISO format, e.g. '2023-01-20T00:00:00.000Z'.
};

/** https://airtable.com/developers/web/api/list-webhook-payloads. */
export type AirtableWebhookListPayloadsResponse = AirtableApiResponse & {
  cursor: number;
  mightHaveMore: boolean;
  payloads: AirtableWebhookFullPayload[];
};

/** https://airtable.com/developers/web/api/model/webhooks-payload. */
export type AirtableWebhookFullPayload = {
  timestamp: string; // ISO format, e.g. '2023-01-20T00:00:00.000Z'.
  baseTransactionNumber: number;
  // We don't care about the action metadata which describes the source of the change. We just care about what changed,
  // which is in `changedTablesById` and `createdTablesById`.
  actionMetadata: unknown;
  payloadFormat: 'v0';

  /**
   * Lots of information about what changed in a table or records.
   * https://airtable.com/developers/web/api/model/webhooks-table-changed.
   */
  changedTablesById?: {
    [remoteTableId: string]: {
      //
      // The stuff we care a lot about.
      //
      createdRecordsById?: {
        [recordId: string]: unknown;
      };
      changedRecordsById?: {
        [recordId: string]: unknown;
      };
      destroyedRecordIds?: string[];
      changedViewsById?: {
        [viewId: string]: {
          createdRecordsById?: {
            [recordId: string]: unknown;
          };
          changedRecordsById: {
            [recordId: string]: unknown;
          };
          destroyedRecordIds: string[];
        };
      };

      //
      // The stuff we don't care as much about.
      //
      changedMetadata?: unknown;
      createdFieldsById?: {
        [fieldId: string]: unknown;
      };
      changedFieldsById?: {
        [fieldId: string]: unknown;
      };
      destroyedFieldIds?: string[];
    };
  };

  /**
   * Lots of information about what changed in a table or records.
   * https://airtable.com/developers/web/api/model/webhooks-table-created.
   *
   * If this object is ever populated, it probably means we just need to do another schema fetch.
   */
  createdTablesById?: unknown;
};

/**
 * The format of our `baseBundle` {@link RawBundle} for an Airtable base.
 */
export interface AirtableBaseBundle {
  /**
   * True if the Airtable connector should use the new implementation of AirMark to HTML for rich text fields. In order
   * to preserve old Markdown-to-HTML functionality, customers that created bases before July 2022 had Airtable rich
   * text converted to HTML via a normal Markdown data converter library. We then wrote our own conversion because
   * AirMark is so different from Markdown. Any new bases created after that change shipped have this boolean set to
   * true, which enables the new converter.
   */
  useRichTextV2?: boolean;

  /**
   * True if the Airtable connector should use Whalesync file hosting. In order to not cause data changes in existing
   * bases, customers that created bases before February 2023 are using raw Airtable file links to sync to other
   * destinations. These links expire after 2-4 hours. We implemented Whalesync file hosting to re-host all Airtable
   * files with URLs that don't expire. Any new bases created after this change shipped have this boolean set to true,
   * which enables file hosting.
   */
  useMultipleAttachmentV2?: boolean;

  /**
   * Bases that we fetch during the base preview building
   * these bases come from the new APIs airtable has for schema discovery
   * this should only contain bases we have permission level for.
   * https://airtable.com/developers/web/api/list-bases
   */
  basesPreviews?: AirtableBases[];
}

export interface AirtableWebhookStateBundle {
  /**
   * This is a dictionary of registered webhook IDs to the last "cursor" we got from requesting the latest webhook
   * payloads from Airtable. We should always keep increasing the cursors so we don't get old payloads that we've
   * already handled.
   *
   * See this: https://airtable.com/developers/web/api/list-webhook-payloads.
   */
  webhookCursors?: {
    [webhookId: string]: number;
  };
}

/**
 * The format of our `tablePollingSessionBundle` {@link RawBundle} for an Airtable table.
 */
export interface AirtableTablePollingSessionBundle {
  cursor?: string;
}

/**
 * The format of the data in an Airtable barcode field.
 */
export interface AirtableBarcodeData {
  text: string;
}

/**
 * The format of the data in an Airtable collaborator field. It includes an Airtable user ID, and email, and their name.
 */
export interface AirtableCollaboratorResponseData {
  id: string;
  email: string;
  name: string;
}

export type AirtableAttachmentFieldData = Array<{
  /** A unique ID for a file. This is the value that will be used in {@link ColumnTypeMetadata.comparisonPath}. */
  id: string;
  url: string;
  filename?: string; // I've always seen this defined, but I don't want to count on it.
  size?: number; // Will not be defined if a file was just pushed.
  type?: string; // Will not be defined if a file was just pushed.
}>;

export function isAirtableAttachmentFieldData(o: unknown): o is AirtableAttachmentFieldData {
  if (!Array.isArray(o)) {
    return false;
  }

  for (const element of o) {
    if (element === null && element === undefined && typeof element !== 'object' && Array.isArray(element)) {
      return false;
    }
    const r = element as Record<string, unknown>;
    if (typeof r['id'] !== 'string' || typeof r['url'] !== 'string') {
      return false;
    }
  }
  return true;
}

/**
 * The format of the data we send to Airtable to edit a collaborator. Although we could send the Airtable user ID, email
 * also works and seems like a better option because it's user-visible, so we only support email addresses.
 */
export type AirtableCollaboratorRequestData = {
  email: string;
};

// https://airtable.com/developers/web/api/create-field
export type AirtableApiCreateFieldTypeAndOptions =
  | AirtableApiCreateNumberField
  | AirtableApiCreateSinglelilneTextField
  | AirtableApiCreateRichTextField
  | AirtableApiCreateCheckboxField
  | AirtableApiCreateEmailField
  | AirtableApiCreateMultilineTextField
  | AirtableApiCreateUrlField
  | AirtableApiCreateAttachmentField
  | AirtableApiCreateCurrencyField
  | AirtableApiCreateSingleSelectField
  | AirtableApiCreateMultipleSelectsField
  | AirtableApiCreateDateField
  | AirtableApiCreateDateTimeField
  | AirtableApiCreateLinkToAnotherRecordField
  | AirtableApiPhoneField;

export type AirtableApiCreateFieldCommon = {
  name: string;
  description?: string;
};

export type AirtableApiCreateField = AirtableApiCreateFieldCommon & AirtableApiCreateFieldTypeAndOptions;

export type AirtableNumberPrecisios = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type AirtableApiCreateNumberField = {
  type: 'number';
  options: {
    precision: AirtableNumberPrecisios;
  };
};

export type AirtableApiCreateCheckboxField = {
  type: 'checkbox';
  options: {
    color: 'greenBright';
    icon: 'check';
  };
};

export type AirtableApiCreateCurrencyField = {
  type: 'currency';
  options: {
    precision: 2;
    symbol: string;
  };
};

export type AirtableApiCreateSingleSelectField = { type: 'singleSelect' } & AirtableCreateSelectOptions;
export type AirtableApiCreateMultipleSelectsField = { type: 'multipleSelects' } & AirtableCreateSelectOptions;
type AirtableCreateSelectOptions = {
  options: {
    choices: { name: string }[];
  };
};

export type AirtableApiPhoneField = { type: 'phoneNumber' };
export type AirtableApiCreateDateField = { type: 'date'; options: AirtableCreateDateFormat };
export type AirtableApiCreateDateTimeField = {
  type: 'dateTime';
  options: { timeZone: 'utc' } & AirtableCreateDateFormat & AirtableCreateTimeFormat;
};
type AirtableCreateDateFormat = {
  dateFormat: {
    name: 'local';
  };
};
type AirtableCreateTimeFormat = {
  timeFormat: {
    format: 'HH:mm';
    name: '24hour';
  };
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ApiCreateAttachmentField = {
  type: 'dateTime';
};

export type AirtableApiCreateLinkToAnotherRecordField = {
  type: 'multipleRecordLinks';
  options: {
    linkedTableId: string;
    // /**
    //  * Whether linked records are rendered in the reverse order from the cell value in the Airtable UI (i.e. most recent first).
    //  * You generally do not need to rely on this option.
    //  */
    // isReversed: false;
    // /** Whether this field prefers to only have a single linked record. While this preference is enforced in the Airtable UI, it is possible for a field that prefers single linked records to have multiple record links (for example, via copy-and-paste or programmatic updates). */
    // prefersSingleRecordLink: false;
  };
};

type AirtableApiCreateSinglelilneTextField = { type: 'singleLineText' };
type AirtableApiCreateMultilineTextField = { type: 'multilineText' };
type AirtableApiCreateEmailField = { type: 'email' };
type AirtableApiCreateUrlField = { type: 'url' };
type AirtableApiCreateRichTextField = { type: 'richText' };
type AirtableApiCreateAttachmentField = {
  type: 'multipleAttachments';
  // options: {};
};

// Finish when airtable v2 api is merged. This is a function that determines the type for a field that is about to be craeted
// based on the field metadata that we have barsed from the field on the opposite side. Return type should be an enum of this:
// https://airtable.com/developers/web/api/field-model

// [-] AI Text
// [ ] Attachment
// [-] Auto number
// [-] Barcode
// [-] Button
// [x] Checkbox {target of booleans}
// [-] Collaborator
// [-] Count
// [-] Created by
// [-] Created time
// [ ] Date
// [ ] Date and time
// [-] Duration

// [-] Formula
// [-] Last modified by
// [-] Last modified time
// [ ] Link to another record
// [ ] Lookup
// [-] Multiple collaborator
// [ ] Multiple select
// [ ] Number
// [ ] Percent
// [x] Phone
// [x] Rating
// [x] Rich text
// [ ] Rollup
// [ ] Single line text
// [ ] Single select
// [-] Sync source
// [x] Url

// dateMetadata?: DateColumnTypeMetadata;

// jsonObjectMetadata?: JsonObjectColumnTypeMetadata;

// foreignKeyMetadata?: ForeignKeyColumnTypeMetadata;

export const airtableFirstColumnIncompatibleTypes: AirtableApiCreateFieldTypeAndOptions['type'][] = [
  'checkbox',
  'richText',
  'singleSelect',
  'multipleSelects',
  'multipleRecordLinks',
  'multipleAttachments',
];
