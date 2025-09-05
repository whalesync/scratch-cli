/** A return value to capture an operation that either succeeds (and returns a value) or fails and returns an error. */
export type Result<T> = OkResult<T> | ErrResult;
/**
 * Micro wrapper, but supepr common. Helps to avoid ugly auto-formatting like:
 * const  x = (): Promise<
    Result<
      {
        primid: string;
        secid: string;
      }[]
    >
 */
export type AsyncResult<T> = Promise<Result<T>>;
export type AsyncVoidResult = AsyncResult<void>;
export type AsyncUnknownResult = AsyncResult<unknown>;

export interface OkResult<T> {
  readonly r: 'ok';
  readonly v: T;
}

/** Build an OkResult<T> */
export function ok<T>(v: T): OkResult<T>;

/** Zero-argument for Result<void> */
export function ok(): OkResult<void>;

export function ok<T>(v?: T): OkResult<T> | OkResult<void> {
  return { r: 'ok', v: v as T };
}

export function isOk<T>(result: Result<T>): result is OkResult<T> {
  return result.r === 'ok';
}

export function assertOk<T>(result: Result<T>): result is OkResult<T> {
  return result.r === 'ok';
}

export function isAllOk<T>(results: Result<T>[]): results is OkResult<T>[] {
  return results.every(isOk);
}

export interface ErrResult {
  readonly r: 'error';
  readonly code: ErrorCode;
  /** short message or description of the error*/
  readonly error: string;
  /** the underlying exception that triggered this ErrResult */
  readonly cause?: Error;
  /** optional context for the error with values to aid in debugging */
  readonly context?: unknown;
  /** the stack where this error was instantiated */
  readonly stack: string;
  /** If set, whatever led to this error may succeed if retried. BullQ jobs will be rescheduled. */
  readonly isRetriable?: true;
}

type ErrResultOptionalArgs = {
  cause?: Error;
  context?: unknown;
  isRetriable?: true;
};

export function errResult(code: ErrorCode, message: string, args: ErrResultOptionalArgs = {}): ErrResult {
  return {
    r: 'error',
    error: message,
    code,
    cause: args.cause ?? new Error(),
    context: args.context,
    isRetriable: args.isRetriable,
    stack: makeStack(),
  };
}

export function isErr<T>(result: Result<T>): result is ErrResult {
  return result.r === 'error';
}

export enum ErrorCode {
  GeneralError = 'general_error',
  NotFoundError = 'not_found_error',
  NotYetImplementedError = 'not_yet_implemented_error',
  PreconditionsCheckError = 'preconditions_check_error',
  UnauthorizedError = 'unauthorized_error',
  IOError = 'io_error',
  DbError = 'db_error',
  BadRequestError = 'bad_request_error',
  ConflictError = 'conflict_error',
  ForbiddenError = 'forbidden_error',
  UnexpectedError = 'unexpected_error',
  TimeoutError = 'timeout_error',
  BackendError = 'backend_error',
  MalformedDataError = 'malformed_data_error',
  IAppError = 'iapp_error',
  RedisError = 'redis_error',
  DataConversionError = 'data_conversion_error',
  ApiQuotaExceededError = 'api_quota_exceeded_error',
  StripeLibraryError = 'stripe_library_error',
}

export function isResult<T>(o: unknown): o is Result<T> {
  if (!o) {
    return false;
  }
  const asResult = o as Result<unknown>;
  return asResult.r === 'ok' || asResult.r === 'error';
}

/**
 * Coalesces the errors or successes of an array of results.
 * All results are required to succeeed, in which case a OkResult<T[]> is returned.
 * If any of the results is an error, a ErrResult is returned with all of the error messages concatenated.
 */
export function coalesceResultArray<T>(results: Result<T>[]): Result<T[]> {
  if (isAllOk(results)) {
    return ok(results.map((r) => r.v));
  }
  const errors = results.filter(isErr);
  if (errors.length === 1) {
    return errors[0];
  }
  // Make up a new error message that includes all the errors.
  const isRetriable = errors.some((e) => e.isRetriable);
  return errResult(ErrorCode.GeneralError, `[${errors.map((r) => r.error).join(', ')}]`, {
    isRetriable: isRetriable ? true : undefined,
  });
}

export function partitionResultArray<T>(results: Result<T>[]): [T[], ErrResult[]] {
  return [results.filter(isOk).map((r) => r.v), results.filter(isErr)];
}

export function getValueOrThrow<T>(result: Result<T>): T {
  if (result.r === 'error') {
    throw new Error(result.error, { cause: result.cause });
  }
  return result.v;
}

/** Translates `T | null` to `Result<T>| notFoundError` */
export function nullableToResult<T>(v: T | null | undefined, resourceName: string): Result<NonNullable<T>> {
  if (v === null || v === undefined) {
    return notFoundError(resourceName);
  }
  return ok(v);
}

/** Translates a `Result<T | null>` to `Result<T>| notFoundError` */
export function nullableResultToResult<T>(
  v: Result<T | null | undefined>,
  resourceName: string,
): Result<NonNullable<T>> {
  if (v.r === 'error') {
    return v;
  }
  return nullableToResult(v.v, resourceName);
}

function makeStack(): string {
  return new Error().stack ?? '<stack not available>';
}

// Standard errors.

export function generalError(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.GeneralError, msg, args);
}

export function notFoundError(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.NotFoundError, msg, args);
}

export function notYetImplementedError(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.NotYetImplementedError, msg, args);
}

export function preconditionsCheckError(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.PreconditionsCheckError, msg, args);
}

export function unauthorizedError(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.UnauthorizedError, msg, args);
}

export function ioError(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.IOError, msg, args);
}

export function dbError(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.DbError, msg, args);
}

export function badRequestError(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.BadRequestError, msg, args);
}

export function conflictError(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.ConflictError, msg, args);
}

export function forbiddenError(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.ForbiddenError, msg, args);
}

export function unexpectedError(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.UnexpectedError, msg, args);
}

export function timeoutError(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.TimeoutError, msg, args);
}

export function backendError(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.BackendError, msg, args);
}

export function malformedDataError(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.MalformedDataError, msg, args);
}

export function iAppError(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.IAppError, msg, args);
}

export function redisError(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.RedisError, msg, args);
}

export function dataConversionErrror(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.DataConversionError, msg, args);
}

export function apiQuotaExceededError(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.ApiQuotaExceededError, msg, args);
}

export function stripeLibraryError(msg: string, args?: ErrResultOptionalArgs): ErrResult {
  return errResult(ErrorCode.StripeLibraryError, msg, args);
}
