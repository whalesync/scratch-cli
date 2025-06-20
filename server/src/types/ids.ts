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
}

type PrefixedId<T extends IdPrefixes> = `${T}${string}`;

export type IdType = keyof typeof IdPrefixes;

export type AnyId = PrefixedId<IdPrefixes>;

export const ID_RANDOM_LENGTH = 21;
const ID_LENGTH = ID_RANDOM_LENGTH + 4; /* prefix with underscore */

export function isId(id: unknown, prefix: IdPrefixes): boolean {
  return typeof id === 'string' && id.length === ID_LENGTH && id.startsWith(prefix);
}

// Normal alphabet without - or _ so it can be selected in text editors more easily.
const alphabet: string = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const nanoid = customAlphabet(alphabet, 10);

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
