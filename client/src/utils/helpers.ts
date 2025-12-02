import { capitalize } from 'lodash';

/**
 * Return the enum value in string enum `T` named `strVal`, or `defaultValue` if it isn't recognized.
 * Accepts values of `strVal` that are either case name ('FOO') OR case value ('foo').
 */
export function stringToEnum<T extends object, DefaultType>(
  strVal: string,
  type: T,
  defaultValue: DefaultType,
): T[keyof T] | DefaultType {
  for (const [k, v] of Object.entries(type)) {
    if (strVal === k || strVal === v) {
      return type[k as keyof T];
    }
  }
  return defaultValue;
}

export function isNotEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}

export function assertNotEmpty<T>(value: NonNullable<T> | null | undefined, msg?: string): NonNullable<T> {
  if (isNotEmpty(value)) {
    return value;
  }
  throw new Error(`Value unexpectedly empty ${msg ? ': ' + msg : ''}`);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function assertUnreachable(_: never): never {
  throw new Error("Didn't expect to get here");
}

export function compareIgnoringPunctuationAndCase(str1: string, str2: string): boolean {
  const SANTIZING_REGEX = /[-_\s]/g;

  const sanitizedStr1 = str1.replace(SANTIZING_REGEX, '');
  const sanitizedStr2 = str2.replace(SANTIZING_REGEX, '');
  return sanitizedStr1.localeCompare(sanitizedStr2, undefined, { sensitivity: 'accent' }) === 0;
}

export function compareIgnoringCase(str1: string, str2: string): boolean {
  return str1.localeCompare(str2, undefined, { sensitivity: 'accent' }) === 0;
}

export function intRange(start: number, length: number): number[] {
  return Array(length)
    .fill(0)
    .map((_, i) => i + start);
}

export function getLastElement<T>(arr: T[]): T | undefined {
  const len = arr.length;
  if (arr.length > 0) {
    return arr[len - 1];
  }
}

export function isStringArray(o: unknown): o is string[] {
  if (!Array.isArray(o)) {
    return false;
  }
  for (const e of o) {
    if (typeof e !== 'string') {
      return false;
    }
  }
  return true;
}

export function copyWithModifiedMatchingItem<T>(
  arr: T[],
  predicate: (item: T) => boolean,
  /** NOTE: Make sure you copy it if it's an object and you're modifying it! */
  modifier: (item: T) => T,
): T[] {
  const index = arr.findIndex(predicate);
  if (index === -1) {
    return arr;
  }
  const newArr = [...arr];
  newArr[index] = modifier(newArr[index]);
  return newArr;
}

export function copyWithReplacedMatchingItem<T>(arr: T[], predicate: (item: T) => boolean, newItem: T): T[] {
  return copyWithModifiedMatchingItem(arr, predicate, () => newItem);
}

export function isNullOrUndefined(val: unknown): boolean {
  return val === undefined || val === null;
}

/**
 * A basic function to just wait for a certain amount of time. Useful for simulating async operations
 * -- don't use it in production code.
 * @param ms A time in milliseconds
 * @returns A promise that resolves after `ms` milliseconds
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
/** In some cases we need to have a more user friendly message for oauth errors. */
export function getErrorFromOAuth(error: string, connectorType: string): string {
  if (error === 'access_denied') {
    return `${capitalize(connectorType)} authorization was denied. Please try again.`;
  }
  return error;
}

export function timeAgo(input: Date | string): string {
  const date = input instanceof Date ? input : new Date(input);
  const formatter = new Intl.RelativeTimeFormat('en', { style: 'narrow' });
  const ranges = {
    years: 3600 * 24 * 365,
    months: 3600 * 24 * 30,
    weeks: 3600 * 24 * 7,
    days: 3600 * 24,
    hours: 3600,
    minutes: 60,
    seconds: 1,
  };
  const secondsElapsed = (date.getTime() - Date.now()) / 1000;
  for (const key in ranges) {
    if (ranges[key as keyof typeof ranges] < Math.abs(secondsElapsed)) {
      const delta = secondsElapsed / ranges[key as keyof typeof ranges];
      return formatter.format(Math.round(delta), key as Intl.RelativeTimeFormatUnit);
    }
  }
  return 'just now';
}

export function formatDate(date: string | Date | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleString();
}

export function formatBytes(bytes: number, includeUnit: boolean = true): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const decimals = i > 0 ? 1 : 0;
  return (bytes / Math.pow(1024, i)).toFixed(decimals) + (includeUnit ? ' ' + sizes[i] : '');
}

export function formatNumber(number: number): string {
  return number.toLocaleString();
}

export function isValidHttpUrl(str: string): boolean {
  const pattern = new RegExp(
    '^(https?:\\/\\/)?' + // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
      '(\\#[-a-z\\d_]*)?$', // fragment locator
    'i',
  );
  return pattern.test(str);
}

/**
 * Calculate a numeric hash for a string
 * @param str String to hash
 * @returns A positive 32-bit integer hash of the string
 */
export function hashString(str: string): number {
  let hash = 5381; // A common initial value for DJB2
  let i = str.length;

  while (i) {
    hash = (hash * 33) ^ str.charCodeAt(--i);
  }

  return hash >>> 0; // Ensure a positive 32-bit integer
}

/**
 * Calculate a numeric hash for a list of strings for quick comparison. Order of the strings matters.
 * @param strings List of strings to hash
 * @returns A positive 32-bit integer hash of the list of strings
 */
export function hashStringList(strings: string[]): number {
  let combinedHash = 0;

  for (const s of strings) {
    const stringHash = hashString(s);
    combinedHash = (combinedHash * 31) ^ stringHash; // Combine hashes with XOR and multiplication
  }

  return combinedHash >>> 0; // Ensure a positive 32-bit integer
}
