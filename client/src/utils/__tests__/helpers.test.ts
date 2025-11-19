import {
  compareIgnoringCase,
  compareIgnoringPunctuationAndCase,
  formatBytes,
  getLastElement,
  hashString,
  hashStringList,
  intRange,
  isNotEmpty,
  isNullOrUndefined,
  isStringArray,
  isValidHttpUrl,
} from '../helpers';

describe('helpers', () => {
  describe('isNotEmpty', () => {
    it('should return true for non-empty values', () => {
      expect(isNotEmpty('test')).toBe(true);
      expect(isNotEmpty(42)).toBe(true);
      expect(isNotEmpty([])).toBe(true);
      expect(isNotEmpty({})).toBe(true);
    });

    it('should return false for null or undefined', () => {
      expect(isNotEmpty(null)).toBe(false);
      expect(isNotEmpty(undefined)).toBe(false);
    });
  });

  describe('compareIgnoringPunctuationAndCase', () => {
    it('should return true for strings that match ignoring punctuation and case', () => {
      expect(compareIgnoringPunctuationAndCase('Hello-World', 'hello world')).toBe(true);
      expect(compareIgnoringPunctuationAndCase('test_case', 'TestCase')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(compareIgnoringPunctuationAndCase('hello', 'world')).toBe(false);
    });
  });

  describe('compareIgnoringCase', () => {
    it('should return true for strings that match ignoring case', () => {
      expect(compareIgnoringCase('Hello', 'hello')).toBe(true);
      expect(compareIgnoringCase('TEST', 'test')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(compareIgnoringCase('hello', 'world')).toBe(false);
    });
  });

  describe('intRange', () => {
    it('should generate range of integers', () => {
      expect(intRange(0, 5)).toEqual([0, 1, 2, 3, 4]);
      expect(intRange(5, 3)).toEqual([5, 6, 7]);
    });

    it('should handle zero length', () => {
      expect(intRange(0, 0)).toEqual([]);
    });
  });

  describe('getLastElement', () => {
    it('should return last element of array', () => {
      expect(getLastElement([1, 2, 3])).toBe(3);
      expect(getLastElement(['a', 'b', 'c'])).toBe('c');
    });

    it('should return undefined for empty array', () => {
      expect(getLastElement([])).toBeUndefined();
    });
  });

  describe('isStringArray', () => {
    it('should return true for string arrays', () => {
      expect(isStringArray(['a', 'b', 'c'])).toBe(true);
      expect(isStringArray([])).toBe(true);
    });

    it('should return false for non-string arrays', () => {
      expect(isStringArray([1, 2, 3])).toBe(false);
      expect(isStringArray(['a', 1, 'b'])).toBe(false);
      expect(isStringArray('not an array')).toBe(false);
    });
  });

  describe('isNullOrUndefined', () => {
    it('should return true for null or undefined', () => {
      expect(isNullOrUndefined(null)).toBe(true);
      expect(isNullOrUndefined(undefined)).toBe(true);
    });

    it('should return false for other values', () => {
      expect(isNullOrUndefined(0)).toBe(false);
      expect(isNullOrUndefined('')).toBe(false);
      expect(isNullOrUndefined(false)).toBe(false);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(12)).toBe('12 Bytes');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1048576)).toBe('1.0 MB');
      expect(formatBytes(1073741824)).toBe('1.0 GB');
    });

    it('should format without unit when includeUnit is false', () => {
      expect(formatBytes(1024, false)).toBe('1.0');
    });
  });

  describe('isValidHttpUrl', () => {
    it('should return true for valid HTTP URLs', () => {
      expect(isValidHttpUrl('http://example.com')).toBe(true);
      expect(isValidHttpUrl('https://example.com')).toBe(true);
      expect(isValidHttpUrl('https://example.com/path')).toBe(true);
      expect(isValidHttpUrl('https://example.com/path?query=value')).toBe(true);
    });

    it('should return true for URLs without protocol', () => {
      expect(isValidHttpUrl('example.com')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidHttpUrl('not a url')).toBe(false);
      expect(isValidHttpUrl('')).toBe(false);
    });
  });

  describe('hashString', () => {
    it('should generate consistent hash for same string', () => {
      const hash1 = hashString('test');
      const hash2 = hashString('test');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different strings', () => {
      const hash1 = hashString('test1');
      const hash2 = hashString('test2');
      expect(hash1).not.toBe(hash2);
    });

    it('should return a positive 32-bit integer', () => {
      const hash = hashString('test');
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(4294967295); // 2^32 - 1
    });
  });

  describe('hashStringList', () => {
    it('should generate consistent hash for same list', () => {
      const hash1 = hashStringList(['a', 'b', 'c']);
      const hash2 = hashStringList(['a', 'b', 'c']);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different order', () => {
      const hash1 = hashStringList(['a', 'b', 'c']);
      const hash2 = hashStringList(['c', 'b', 'a']);
      expect(hash1).not.toBe(hash2);
    });

    it('should return a positive 32-bit integer', () => {
      const hash = hashStringList(['test1', 'test2']);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(4294967295); // 2^32 - 1
    });
  });
});
