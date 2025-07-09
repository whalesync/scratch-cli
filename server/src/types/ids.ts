import _ from 'lodash';
import { customAlphabet } from 'nanoid';

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
  SNAPSHOT = 'sna_',
  SNAPSHOT_RECORD = 'sre_',
  GENERIC_TABLE = 'gct_',
  SNAPSHOT_TABLE_VIEW = 'stv_',
  STYLE_GUIDE = 'sgd_',
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

// ------- Snapshot -------
export type SnapshotId = PrefixedId<IdPrefixes.SNAPSHOT>;

export function isSnapshotId(id: unknown): id is SnapshotId {
  return isId(id, IdPrefixes.SNAPSHOT);
}

export function createSnapshotId(): SnapshotId {
  return createId(IdPrefixes.SNAPSHOT) as SnapshotId;
}

// ------- SnapshotRecord -------
export type SnapshotRecordId = PrefixedId<IdPrefixes.SNAPSHOT_RECORD>;

export function isSnapshotRecordId(id: unknown): id is SnapshotRecordId {
  return isId(id, IdPrefixes.SNAPSHOT_RECORD);
}

export function createSnapshotRecordId(): SnapshotRecordId {
  return createId(IdPrefixes.SNAPSHOT_RECORD) as SnapshotRecordId;
}

// ------- GenericTable -------
export type GenericTableId = PrefixedId<IdPrefixes.GENERIC_TABLE>;

export function isGenericTableId(id: unknown): id is GenericTableId {
  return isId(id, IdPrefixes.GENERIC_TABLE);
}

export function createGenericTableId(): GenericTableId {
  return createId(IdPrefixes.GENERIC_TABLE) as GenericTableId;
}

// ------- SnapshotTableViews -------
export type SnapshotTableViewId = PrefixedId<IdPrefixes.SNAPSHOT_TABLE_VIEW>;

export function isSnapshotTableViewId(id: unknown): id is SnapshotTableViewId {
  return isId(id, IdPrefixes.SNAPSHOT_TABLE_VIEW);
}

export function createSnapshotTableViewId(): SnapshotTableViewId {
  return createId(IdPrefixes.SNAPSHOT_TABLE_VIEW) as SnapshotTableViewId;
}

// ------- StyleGuide -------
export type StyleGuideId = PrefixedId<IdPrefixes.STYLE_GUIDE>;

export function isStyleGuideId(id: unknown): id is StyleGuideId {
  return isId(id, IdPrefixes.STYLE_GUIDE);
}

export function createStyleGuideId(): StyleGuideId {
  return createId(IdPrefixes.STYLE_GUIDE) as StyleGuideId;
}
