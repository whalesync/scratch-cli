import _ from 'lodash';
import { customAlphabet } from 'nanoid';

// NOTE!! This file is copied to the client by `yarn run copy-server-files`.
// Please run that command so the changes are included in your commit.

/**
 * The prefix at the front of a database ID.
 * Each will prefix a db id like: "usr_1hk6pq6rlq5ksyfh"
 * When adding a new one:
 *  - Add a new entry to this enum: 3 lowercase letters plus underscore
 *  - Add the type, is*Id(), and create*Id() functions below
 *  - Add the generator for it below
 */
export enum IdPrefixes {
  USER = 'usr_',
  API_TOKEN = 'atk_',
  CONNECTOR_ACCOUNT = 'coa_',
  WORKBOOK = 'wkb_',
  SNAPSHOT_TABLE = 'snt_',
  SNAPSHOT_RECORD = 'sre_',
  CUSTOM_CONNECTOR = 'cuc_',
  SNAPSHOT_TABLE_VIEW = 'stv_',
  STYLE_GUIDE = 'sgd_',
  CSV_FILE_RECORD = 'cfr_', // Record in CSV upload table
  CSV_SNAPSHOT_RECORD = 'csr_', // Record in snapshot created from CSV
  VIEW = 'vew_',
  AI_AGENT_CREDENTIAL = 'aac_',
  AI_AGENT_TOKEN_USAGE_EVENT = 'uev_',
  SUBSCRIPTION = 'sub_',
  INVOICE_RESULT = 'inv_',
  UPLOAD = 'upl_',
  AUDIT_LOG_EVENT = 'ael_', // Audit log event
  ORGANIZATION = 'org_', // Organization
  JOB = 'job_', // Job
}

type PrefixedId<T extends IdPrefixes> = `${T}${string}`;

export type IdType = keyof typeof IdPrefixes;

export type AnyId = PrefixedId<IdPrefixes>;

const ID_RANDOM_LENGTH = 10;
const ID_LENGTH = ID_RANDOM_LENGTH + 4; /* prefix with underscore */

export function isId(id: unknown, prefix: IdPrefixes): boolean {
  return typeof id === 'string' && id.length === ID_LENGTH && id.startsWith(prefix);
}

// Normal alphabet without - or _ so it can be selected in text editors more easily.
const alphabet: string = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const nanoid = customAlphabet(alphabet, ID_RANDOM_LENGTH);

export function createId(prefix: IdPrefixes): string {
  return `${prefix}${nanoid()}`;
}

export function createPlainId(length?: number): string {
  return length ? nanoid(length) : nanoid();
}

export function typeForId(id: AnyId): IdType | null {
  return (_.findKey(IdPrefixes, (value) => id.startsWith(value)) as IdType) ?? null;
}

// ------- Users -------
export type UserId = PrefixedId<IdPrefixes.USER>;

export function isUserId(id: unknown): id is UserId {
  return isId(id, IdPrefixes.USER);
}

export function createUserId(): UserId {
  return createId(IdPrefixes.USER) as UserId;
}

// ------- API Tokens -------
export type ApiTokenId = PrefixedId<IdPrefixes.API_TOKEN>;

export function isApiTokenId(id: unknown): id is ApiTokenId {
  return isId(id, IdPrefixes.API_TOKEN);
}

export function createApiTokenId(): ApiTokenId {
  return createId(IdPrefixes.API_TOKEN) as ApiTokenId;
}

// ------- ConnectorAccount -------
export type ConnectorAccountId = PrefixedId<IdPrefixes.CONNECTOR_ACCOUNT>;

export function isConnectorAccountId(id: unknown): id is ConnectorAccountId {
  return isId(id, IdPrefixes.CONNECTOR_ACCOUNT);
}

export function createConnectorAccountId(): ConnectorAccountId {
  return createId(IdPrefixes.CONNECTOR_ACCOUNT) as ConnectorAccountId;
}

// ------- Workbook -------
export type WorkbookId = PrefixedId<IdPrefixes.WORKBOOK>;

export function isWorkbookId(id: unknown): id is WorkbookId {
  return isId(id, IdPrefixes.WORKBOOK) || isId(id, 'sna_' as IdPrefixes /* Legacy migration */);
}

export function createWorkbookId(): WorkbookId {
  return createId(IdPrefixes.WORKBOOK) as WorkbookId;
}

// ------- SnapshotTable -------
export type SnapshotTableId = PrefixedId<IdPrefixes.SNAPSHOT_TABLE>;

export function isSnapshotTableId(id: unknown): id is SnapshotTableId {
  return isId(id, IdPrefixes.SNAPSHOT_TABLE);
}

export function createSnapshotTableId(): SnapshotTableId {
  return createId(IdPrefixes.SNAPSHOT_TABLE) as SnapshotTableId;
}

// ------- SnapshotRecord -------
export type SnapshotRecordId = PrefixedId<IdPrefixes.SNAPSHOT_RECORD>;

export function isSnapshotRecordId(id: unknown): id is SnapshotRecordId {
  return isId(id, IdPrefixes.SNAPSHOT_RECORD);
}

export function createSnapshotRecordId(): SnapshotRecordId {
  return createId(IdPrefixes.SNAPSHOT_RECORD) as SnapshotRecordId;
}

// ------- CustomConnector -------
export type CustomConnectorId = PrefixedId<IdPrefixes.CUSTOM_CONNECTOR>;

export function isCustomConnectorId(id: unknown): id is CustomConnectorId {
  return isId(id, IdPrefixes.CUSTOM_CONNECTOR);
}

export function createCustomConnectorId(): CustomConnectorId {
  return createId(IdPrefixes.CUSTOM_CONNECTOR) as CustomConnectorId;
}

// ------- StyleGuide -------
export type StyleGuideId = PrefixedId<IdPrefixes.STYLE_GUIDE>;

export function isStyleGuideId(id: unknown): id is StyleGuideId {
  return isId(id, IdPrefixes.STYLE_GUIDE);
}

export function createStyleGuideId(): StyleGuideId {
  return createId(IdPrefixes.STYLE_GUIDE) as StyleGuideId;
}

// ------- AiAgentCredential -------
export type AiAgentCredentialId = PrefixedId<IdPrefixes.AI_AGENT_CREDENTIAL>;

export function isAiAgentCredentialId(id: unknown): id is AiAgentCredentialId {
  return isId(id, IdPrefixes.AI_AGENT_CREDENTIAL);
}

export function createAiAgentCredentialId(): AiAgentCredentialId {
  return createId(IdPrefixes.AI_AGENT_CREDENTIAL) as AiAgentCredentialId;
}

// ------- AiAgentTokenUsageEvent -------
export type AiAgentTokenUsageEventId = PrefixedId<IdPrefixes.AI_AGENT_TOKEN_USAGE_EVENT>;

export function isAiAgentTokenUsageEventId(id: unknown): id is AiAgentTokenUsageEventId {
  return isId(id, IdPrefixes.AI_AGENT_TOKEN_USAGE_EVENT);
}

export function createAiAgentTokenUsageEventId(): AiAgentTokenUsageEventId {
  return createId(IdPrefixes.AI_AGENT_TOKEN_USAGE_EVENT) as AiAgentTokenUsageEventId;
}

// ------- Subscription -------
export type SubscriptionId = PrefixedId<IdPrefixes.SUBSCRIPTION>;

export function isSubscriptionId(id: unknown): id is SubscriptionId {
  return isId(id, IdPrefixes.SUBSCRIPTION);
}

export function createSubscriptionId(): SubscriptionId {
  return createId(IdPrefixes.SUBSCRIPTION) as SubscriptionId;
}

// ------- InvoiceResult -------
export type InvoiceResultId = PrefixedId<IdPrefixes.INVOICE_RESULT>;

export function isInvoiceResultId(id: unknown): id is InvoiceResultId {
  return isId(id, IdPrefixes.INVOICE_RESULT);
}

export function createInvoiceResultId(): InvoiceResultId {
  return createId(IdPrefixes.INVOICE_RESULT) as InvoiceResultId;
}

// ------- Upload -------
export type UploadId = PrefixedId<IdPrefixes.UPLOAD>;

export function isUploadId(id: unknown): id is UploadId {
  return isId(id, IdPrefixes.UPLOAD);
}

export function createUploadId(): UploadId {
  return createId(IdPrefixes.UPLOAD) as UploadId;
}

// ------- CsvFileRecord -------
export type CsvFileRecordId = PrefixedId<IdPrefixes.CSV_FILE_RECORD>;

export function isCsvFileRecordId(id: unknown): id is CsvFileRecordId {
  return isId(id, IdPrefixes.CSV_FILE_RECORD);
}

export function createCsvFileRecordId(): CsvFileRecordId {
  return createId(IdPrefixes.CSV_FILE_RECORD) as CsvFileRecordId;
}

// ------- CsvSnapshotRecord -------
export type CsvSnapshotRecordId = PrefixedId<IdPrefixes.CSV_SNAPSHOT_RECORD>;

export function isCsvSnapshotRecordId(id: unknown): id is CsvSnapshotRecordId {
  return isId(id, IdPrefixes.CSV_SNAPSHOT_RECORD);
}

export function createCsvSnapshotRecordId(): CsvSnapshotRecordId {
  return createId(IdPrefixes.CSV_SNAPSHOT_RECORD) as CsvSnapshotRecordId;
}

// ------- AuditLogEvent -------
export type AuditLogEventId = PrefixedId<IdPrefixes.AUDIT_LOG_EVENT>;

export function isAuditLogEventId(id: unknown): id is AuditLogEventId {
  return isId(id, IdPrefixes.AUDIT_LOG_EVENT);
}

export function createAuditLogEventId(): AuditLogEventId {
  return createId(IdPrefixes.AUDIT_LOG_EVENT) as AuditLogEventId;
}

// ------- Organization -------
export type OrganizationId = PrefixedId<IdPrefixes.ORGANIZATION>;

export function isOrganizationId(id: unknown): id is OrganizationId {
  return isId(id, IdPrefixes.ORGANIZATION);
}

export function createOrganizationId(): OrganizationId {
  return createId(IdPrefixes.ORGANIZATION) as OrganizationId;
}

// ------- Job -------
export type JobId = PrefixedId<IdPrefixes.JOB>;

export function isJobId(id: unknown): id is JobId {
  return isId(id, IdPrefixes.JOB);
}

export function createJobId(): JobId {
  return createId(IdPrefixes.JOB) as JobId;
}
