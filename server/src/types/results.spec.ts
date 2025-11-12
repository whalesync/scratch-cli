import {
  ErrorCode,
  apiQuotaExceededError,
  assertOk,
  backendError,
  badRequestError,
  coalesceResultArray,
  conflictError,
  dataConversionErrror,
  dbError,
  errResult,
  forbiddenError,
  generalError,
  getValueOrThrow,
  iAppError,
  ioError,
  isAllOk,
  isErr,
  isOk,
  isResult,
  malformedDataError,
  notFoundError,
  notYetImplementedError,
  nullableResultToResult,
  nullableToResult,
  ok,
  partitionResultArray,
  preconditionsCheckError,
  redisError,
  stripeLibraryError,
  timeoutError,
  unauthorizedError,
  unexpectedError,
} from './results';

describe('results', () => {
  describe('ok', () => {
    it('should create an ok result with a value', () => {
      const result = ok(42);
      expect(result).toEqual({ r: 'ok', v: 42 });
    });

    it('should create an ok result with a string value', () => {
      const result = ok('success');
      expect(result).toEqual({ r: 'ok', v: 'success' });
    });

    it('should create an ok result with an object value', () => {
      const value = { id: 1, name: 'test' };
      const result = ok(value);
      expect(result).toEqual({ r: 'ok', v: value });
    });

    it('should create an ok result with void when called with no arguments', () => {
      const result = ok();
      expect(result).toEqual({ r: 'ok', v: undefined });
    });

    it('should create an ok result with null', () => {
      const result = ok(null);
      expect(result).toEqual({ r: 'ok', v: null });
    });
  });

  describe('isOk', () => {
    it('should return true for ok results', () => {
      const result = ok(42);
      expect(isOk(result)).toBe(true);
    });

    it('should return false for error results', () => {
      const result = generalError('test error');
      expect(isOk(result)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const result = ok(42);
      if (isOk(result)) {
        // TypeScript should know result.v is a number here
        expect(result.v).toBe(42);
      }
    });
  });

  describe('assertOk', () => {
    it('should return true for ok results', () => {
      const result = ok(42);
      expect(assertOk(result)).toBe(true);
    });

    it('should return false for error results', () => {
      const result = generalError('test error');
      expect(assertOk(result)).toBe(false);
    });
  });

  describe('isAllOk', () => {
    it('should return true when all results are ok', () => {
      const results = [ok(1), ok(2), ok(3)];
      expect(isAllOk(results)).toBe(true);
    });

    it('should return false when any result is an error', () => {
      const results = [ok(1), generalError('error'), ok(3)];
      expect(isAllOk(results)).toBe(false);
    });

    it('should return true for empty array', () => {
      const results = [] as ReturnType<typeof ok<number>>[];
      expect(isAllOk(results)).toBe(true);
    });
  });

  describe('errResult', () => {
    it('should create an error result with code and message', () => {
      const result = errResult(ErrorCode.GeneralError, 'test error');
      expect(result.r).toBe('error');
      expect(result.code).toBe(ErrorCode.GeneralError);
      expect(result.error).toBe('test error');
      expect(result.stack).toBeDefined();
    });

    it('should include cause when provided', () => {
      const cause = new Error('underlying error');
      const result = errResult(ErrorCode.GeneralError, 'test error', { cause });
      expect(result.cause).toBe(cause);
    });

    it('should include context when provided', () => {
      const context = { userId: '123', action: 'delete' };
      const result = errResult(ErrorCode.GeneralError, 'test error', { context });
      expect(result.context).toEqual(context);
    });

    it('should mark as retriable when specified', () => {
      const result = errResult(ErrorCode.GeneralError, 'test error', { isRetriable: true });
      expect(result.isRetriable).toBe(true);
    });

    it('should create a new Error as cause when not provided', () => {
      const result = errResult(ErrorCode.GeneralError, 'test error');
      expect(result.cause).toBeInstanceOf(Error);
    });
  });

  describe('isErr', () => {
    it('should return true for error results', () => {
      const result = generalError('test error');
      expect(isErr(result)).toBe(true);
    });

    it('should return false for ok results', () => {
      const result = ok(42);
      expect(isErr(result)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const result = generalError('test error');
      if (isErr(result)) {
        // TypeScript should know result has error properties
        expect(result.error).toBe('test error');
      }
    });
  });

  describe('isResult', () => {
    it('should return true for ok results', () => {
      const result = ok(42);
      expect(isResult(result)).toBe(true);
    });

    it('should return true for error results', () => {
      const result = generalError('test error');
      expect(isResult(result)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isResult(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isResult(undefined)).toBe(false);
    });

    it('should return false for objects without r property', () => {
      expect(isResult({ value: 42 })).toBe(false);
    });

    it('should return false for objects with invalid r property', () => {
      expect(isResult({ r: 'invalid' })).toBe(false);
    });
  });

  describe('coalesceResultArray', () => {
    it('should return ok with all values when all results are ok', () => {
      const results = [ok(1), ok(2), ok(3)];
      const coalesced = coalesceResultArray(results);
      expect(isOk(coalesced)).toBe(true);
      if (isOk(coalesced)) {
        expect(coalesced.v).toEqual([1, 2, 3]);
      }
    });

    it('should return single error when one result is an error', () => {
      const error = generalError('test error');
      const results = [ok(1), error, ok(3)];
      const coalesced = coalesceResultArray(results);
      expect(coalesced).toBe(error);
    });

    it('should concatenate multiple error messages', () => {
      const results = [ok(1), generalError('error 1'), generalError('error 2')];
      const coalesced = coalesceResultArray(results);
      expect(isErr(coalesced)).toBe(true);
      if (isErr(coalesced)) {
        expect(coalesced.error).toBe('[error 1, error 2]');
      }
    });

    it('should mark as retriable if any error is retriable', () => {
      const results = [
        ok(1),
        generalError('error 1'),
        errResult(ErrorCode.GeneralError, 'error 2', { isRetriable: true }),
      ];
      const coalesced = coalesceResultArray(results);
      expect(isErr(coalesced)).toBe(true);
      if (isErr(coalesced)) {
        expect(coalesced.isRetriable).toBe(true);
      }
    });

    it('should not mark as retriable if no errors are retriable', () => {
      const results = [ok(1), generalError('error 1'), generalError('error 2')];
      const coalesced = coalesceResultArray(results);
      expect(isErr(coalesced)).toBe(true);
      if (isErr(coalesced)) {
        expect(coalesced.isRetriable).toBeUndefined();
      }
    });

    it('should handle empty array', () => {
      const results = [] as ReturnType<typeof ok<number>>[];
      const coalesced = coalesceResultArray(results);
      expect(isOk(coalesced)).toBe(true);
      if (isOk(coalesced)) {
        expect(coalesced.v).toEqual([]);
      }
    });
  });

  describe('partitionResultArray', () => {
    it('should separate ok and error results', () => {
      const results = [ok(1), generalError('error 1'), ok(3), generalError('error 2')];
      const [successes, errors] = partitionResultArray(results);
      expect(successes).toEqual([1, 3]);
      expect(errors).toHaveLength(2);
      expect(errors[0].error).toBe('error 1');
      expect(errors[1].error).toBe('error 2');
    });

    it('should return all successes when no errors', () => {
      const results = [ok(1), ok(2), ok(3)];
      const [successes, errors] = partitionResultArray(results);
      expect(successes).toEqual([1, 2, 3]);
      expect(errors).toEqual([]);
    });

    it('should return all errors when no successes', () => {
      const results = [generalError('error 1'), generalError('error 2')];
      const [successes, errors] = partitionResultArray(results);
      expect(successes).toEqual([]);
      expect(errors).toHaveLength(2);
    });

    it('should handle empty array', () => {
      const results = [] as ReturnType<typeof ok<number>>[];
      const [successes, errors] = partitionResultArray(results);
      expect(successes).toEqual([]);
      expect(errors).toEqual([]);
    });
  });

  describe('getValueOrThrow', () => {
    it('should return value for ok results', () => {
      const result = ok(42);
      expect(getValueOrThrow(result)).toBe(42);
    });

    it('should throw for error results', () => {
      const result = generalError('test error');
      expect(() => getValueOrThrow(result)).toThrow('test error');
    });

    it('should include cause in thrown error', () => {
      const cause = new Error('underlying');
      const result = errResult(ErrorCode.GeneralError, 'test error', { cause });
      try {
        getValueOrThrow(result);
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).cause).toBe(cause);
      }
    });
  });

  describe('nullableToResult', () => {
    it('should convert non-null value to ok result', () => {
      const result = nullableToResult(42, 'number');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.v).toBe(42);
      }
    });

    it('should convert null to not found error', () => {
      const result = nullableToResult(null, 'user');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.code).toBe(ErrorCode.NotFoundError);
        expect(result.error).toBe('user');
      }
    });

    it('should convert undefined to not found error', () => {
      const result = nullableToResult(undefined, 'user');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.code).toBe(ErrorCode.NotFoundError);
        expect(result.error).toBe('user');
      }
    });

    it('should handle object values', () => {
      const value = { id: 1, name: 'test' };
      const result = nullableToResult(value, 'object');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.v).toEqual(value);
      }
    });
  });

  describe('nullableResultToResult', () => {
    it('should convert ok result with non-null value to ok result', () => {
      const input = ok(42);
      const result = nullableResultToResult(input, 'number');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.v).toBe(42);
      }
    });

    it('should convert ok result with null to not found error', () => {
      const input = ok(null);
      const result = nullableResultToResult(input, 'user');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.code).toBe(ErrorCode.NotFoundError);
        expect(result.error).toBe('user');
      }
    });

    it('should convert ok result with undefined to not found error', () => {
      const input = ok(undefined);
      const result = nullableResultToResult(input, 'user');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.code).toBe(ErrorCode.NotFoundError);
        expect(result.error).toBe('user');
      }
    });

    it('should pass through error results', () => {
      const error = generalError('test error');
      const result = nullableResultToResult(error, 'user');
      expect(result).toBe(error);
    });
  });

  describe('error helper functions', () => {
    it('should create generalError', () => {
      const result = generalError('test');
      expect(result.code).toBe(ErrorCode.GeneralError);
      expect(result.error).toBe('test');
    });

    it('should create notFoundError', () => {
      const result = notFoundError('user not found');
      expect(result.code).toBe(ErrorCode.NotFoundError);
      expect(result.error).toBe('user not found');
    });

    it('should create notYetImplementedError', () => {
      const result = notYetImplementedError('feature pending');
      expect(result.code).toBe(ErrorCode.NotYetImplementedError);
      expect(result.error).toBe('feature pending');
    });

    it('should create preconditionsCheckError', () => {
      const result = preconditionsCheckError('precondition failed');
      expect(result.code).toBe(ErrorCode.PreconditionsCheckError);
      expect(result.error).toBe('precondition failed');
    });

    it('should create unauthorizedError', () => {
      const result = unauthorizedError('not authorized');
      expect(result.code).toBe(ErrorCode.UnauthorizedError);
      expect(result.error).toBe('not authorized');
    });

    it('should create ioError', () => {
      const result = ioError('file read failed');
      expect(result.code).toBe(ErrorCode.IOError);
      expect(result.error).toBe('file read failed');
    });

    it('should create dbError', () => {
      const result = dbError('database connection failed');
      expect(result.code).toBe(ErrorCode.DbError);
      expect(result.error).toBe('database connection failed');
    });

    it('should create badRequestError', () => {
      const result = badRequestError('invalid input');
      expect(result.code).toBe(ErrorCode.BadRequestError);
      expect(result.error).toBe('invalid input');
    });

    it('should create conflictError', () => {
      const result = conflictError('resource already exists');
      expect(result.code).toBe(ErrorCode.ConflictError);
      expect(result.error).toBe('resource already exists');
    });

    it('should create forbiddenError', () => {
      const result = forbiddenError('access denied');
      expect(result.code).toBe(ErrorCode.ForbiddenError);
      expect(result.error).toBe('access denied');
    });

    it('should create unexpectedError', () => {
      const result = unexpectedError('unexpected condition');
      expect(result.code).toBe(ErrorCode.UnexpectedError);
      expect(result.error).toBe('unexpected condition');
    });

    it('should create timeoutError', () => {
      const result = timeoutError('request timeout');
      expect(result.code).toBe(ErrorCode.TimeoutError);
      expect(result.error).toBe('request timeout');
    });

    it('should create backendError', () => {
      const result = backendError('backend service failed');
      expect(result.code).toBe(ErrorCode.BackendError);
      expect(result.error).toBe('backend service failed');
    });

    it('should create malformedDataError', () => {
      const result = malformedDataError('invalid JSON');
      expect(result.code).toBe(ErrorCode.MalformedDataError);
      expect(result.error).toBe('invalid JSON');
    });

    it('should create iAppError', () => {
      const result = iAppError('iApp error');
      expect(result.code).toBe(ErrorCode.IAppError);
      expect(result.error).toBe('iApp error');
    });

    it('should create redisError', () => {
      const result = redisError('redis connection failed');
      expect(result.code).toBe(ErrorCode.RedisError);
      expect(result.error).toBe('redis connection failed');
    });

    it('should create dataConversionErrror', () => {
      const result = dataConversionErrror('conversion failed');
      expect(result.code).toBe(ErrorCode.DataConversionError);
      expect(result.error).toBe('conversion failed');
    });

    it('should create apiQuotaExceededError', () => {
      const result = apiQuotaExceededError('quota exceeded');
      expect(result.code).toBe(ErrorCode.ApiQuotaExceededError);
      expect(result.error).toBe('quota exceeded');
    });

    it('should create stripeLibraryError', () => {
      const result = stripeLibraryError('stripe error');
      expect(result.code).toBe(ErrorCode.StripeLibraryError);
      expect(result.error).toBe('stripe error');
    });

    it('should accept optional args in error helpers', () => {
      const cause = new Error('underlying');
      const context = { userId: '123' };
      const result = generalError('test', { cause, context, isRetriable: true });
      expect(result.cause).toBe(cause);
      expect(result.context).toEqual(context);
      expect(result.isRetriable).toBe(true);
    });
  });
});
