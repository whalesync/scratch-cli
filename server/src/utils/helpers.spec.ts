import { stringToEnum } from './helpers';

enum TestEnum {
  FOO = 'foo',
  BAR = 'bar',
  BAZ_CASE = 'baz-case',
}

describe('Utility Helpers', () => {
  describe('stringToEnum', () => {
    it('should return enum value when matching case name', () => {
      const result = stringToEnum('FOO', TestEnum, null);

      expect(result).toBe(TestEnum.FOO);
      expect(result).toBe('foo');
    });

    it('should return enum value when matching case value', () => {
      const result = stringToEnum('foo', TestEnum, null);

      expect(result).toBe(TestEnum.FOO);
      expect(result).toBe('foo');
    });

    it('should return default value when no match found', () => {
      const result = stringToEnum('invalid', TestEnum, 'default');

      expect(result).toBe('default');
    });

    it('should return null as default value when no match found', () => {
      const result = stringToEnum('invalid', TestEnum, null);

      expect(result).toBeNull();
    });

    it('should handle enum cases with underscores', () => {
      const result1 = stringToEnum('BAZ_CASE', TestEnum, null);
      const result2 = stringToEnum('baz-case', TestEnum, null);

      expect(result1).toBe(TestEnum.BAZ_CASE);
      expect(result1).toBe('baz-case');
      expect(result2).toBe(TestEnum.BAZ_CASE);
    });

    it('should work with BAR enum case', () => {
      const result1 = stringToEnum('BAR', TestEnum, null);
      const result2 = stringToEnum('bar', TestEnum, null);

      expect(result1).toBe(TestEnum.BAR);
      expect(result2).toBe(TestEnum.BAR);
    });

    it('should return default for empty string', () => {
      const result = stringToEnum('', TestEnum, 'default');

      expect(result).toBe('default');
    });

    it('should be case-sensitive', () => {
      const result1 = stringToEnum('Foo', TestEnum, 'default');
      const result2 = stringToEnum('FOo', TestEnum, 'default');

      expect(result1).toBe('default');
      expect(result2).toBe('default');
    });

    it('should handle different default value types', () => {
      const resultString = stringToEnum('invalid', TestEnum, 'defaultString');
      const resultNumber = stringToEnum('invalid', TestEnum, 42);
      const resultBoolean = stringToEnum('invalid', TestEnum, false);
      const resultObject = stringToEnum('invalid', TestEnum, { default: true });

      expect(resultString).toBe('defaultString');
      expect(resultNumber).toBe(42);
      expect(resultBoolean).toBe(false);
      expect(resultObject).toEqual({ default: true });
    });

    it('should prioritize exact key match over value match', () => {
      // In case of enum where key matches another enum's value
      enum EdgeCaseEnum {
        foo = 'bar',
        bar = 'baz',
      }

      const result = stringToEnum('foo', EdgeCaseEnum, null);

      // Should match the key 'foo' which has value 'bar'
      expect(result).toBe(EdgeCaseEnum.foo);
      expect(result).toBe('bar');
    });

    it('should handle undefined default value', () => {
      const result = stringToEnum('invalid', TestEnum, undefined);

      expect(result).toBeUndefined();
    });

    it('should match first occurrence when searching', () => {
      const result1 = stringToEnum('FOO', TestEnum, null);
      const result2 = stringToEnum('BAR', TestEnum, null);
      const result3 = stringToEnum('BAZ_CASE', TestEnum, null);

      expect(result1).toBe('foo');
      expect(result2).toBe('bar');
      expect(result3).toBe('baz-case');
    });
  });
});
