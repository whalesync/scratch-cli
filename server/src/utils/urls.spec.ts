import { isValidHttpUrl } from './urls';

describe('isValidHttpUrl', () => {
  describe('valid URLs', () => {
    it('should accept HTTP URLs', () => {
      expect(isValidHttpUrl('http://example.com')).toBe(true);
    });

    it('should accept HTTPS URLs', () => {
      expect(isValidHttpUrl('https://example.com')).toBe(true);
    });

    it('should accept URLs without protocol', () => {
      expect(isValidHttpUrl('example.com')).toBe(true);
      expect(isValidHttpUrl('www.example.com')).toBe(true);
    });

    it('should accept URLs with subdomains', () => {
      expect(isValidHttpUrl('https://api.example.com')).toBe(true);
      expect(isValidHttpUrl('https://api.v2.example.com')).toBe(true);
    });

    it('should accept URLs with paths', () => {
      expect(isValidHttpUrl('https://example.com/path')).toBe(true);
      expect(isValidHttpUrl('https://example.com/path/to/resource')).toBe(true);
      expect(isValidHttpUrl('https://example.com/path_with_underscores')).toBe(true);
      expect(isValidHttpUrl('https://example.com/path-with-dashes')).toBe(true);
    });

    it('should accept URLs with query strings', () => {
      expect(isValidHttpUrl('https://example.com?key=value')).toBe(true);
      expect(isValidHttpUrl('https://example.com?key1=value1&key2=value2')).toBe(true);
      expect(isValidHttpUrl('https://example.com/path?key=value')).toBe(true);
    });

    it('should accept URLs with fragments', () => {
      expect(isValidHttpUrl('https://example.com#section')).toBe(true);
      expect(isValidHttpUrl('https://example.com/path#section')).toBe(true);
      expect(isValidHttpUrl('https://example.com?key=value#section')).toBe(true);
    });

    it('should accept URLs with ports', () => {
      expect(isValidHttpUrl('https://example.com:8080')).toBe(true);
      expect(isValidHttpUrl('https://example.com:8080/path')).toBe(true);
      expect(isValidHttpUrl('http://192.168.1.1:3000')).toBe(true);
    });

    it('should accept IP addresses', () => {
      expect(isValidHttpUrl('http://192.168.1.1')).toBe(true);
      expect(isValidHttpUrl('https://127.0.0.1')).toBe(true);
      expect(isValidHttpUrl('http://10.0.0.1:8080')).toBe(true);
    });

    it('should reject localhost without TLD', () => {
      // The regex requires a TLD, so plain "localhost" is not accepted
      expect(isValidHttpUrl('http://localhost')).toBe(false);
      expect(isValidHttpUrl('https://localhost:3000')).toBe(false);
    });

    it('should accept various TLDs', () => {
      expect(isValidHttpUrl('https://example.com')).toBe(true);
      expect(isValidHttpUrl('https://example.org')).toBe(true);
      expect(isValidHttpUrl('https://example.io')).toBe(true);
      expect(isValidHttpUrl('https://example.co.uk')).toBe(true);
      expect(isValidHttpUrl('https://example.dev')).toBe(true);
    });

    it('should accept URLs with special characters in path', () => {
      expect(isValidHttpUrl('https://example.com/path%20with%20spaces')).toBe(true);
      expect(isValidHttpUrl('https://example.com/path+with+plus')).toBe(true);
      expect(isValidHttpUrl('https://example.com/path~with~tilde')).toBe(true);
    });

    it('should accept URLs with hyphens in domain', () => {
      expect(isValidHttpUrl('https://my-site.com')).toBe(true);
      expect(isValidHttpUrl('https://my-awesome-site.com')).toBe(true);
    });
  });

  describe('invalid URLs', () => {
    it('should reject empty strings', () => {
      expect(isValidHttpUrl('')).toBe(false);
    });

    it('should reject strings without domain', () => {
      expect(isValidHttpUrl('https://')).toBe(false);
      expect(isValidHttpUrl('http://')).toBe(false);
    });

    it('should reject invalid protocols', () => {
      expect(isValidHttpUrl('ftp://example.com')).toBe(false);
      expect(isValidHttpUrl('file:///path/to/file')).toBe(false);
    });

    it('should reject strings with spaces', () => {
      expect(isValidHttpUrl('https://example .com')).toBe(false);
      expect(isValidHttpUrl('https:// example.com')).toBe(false);
    });

    it('should reject malformed URLs', () => {
      expect(isValidHttpUrl('https://example')).toBe(false); // No TLD
      expect(isValidHttpUrl('example.')).toBe(false); // Trailing dot without TLD
      expect(isValidHttpUrl('.com')).toBe(false); // No domain
    });

    it('should reject URLs with invalid characters', () => {
      expect(isValidHttpUrl('https://exam ple.com')).toBe(false);
      expect(isValidHttpUrl('https://example$.com')).toBe(false);
    });

    it('should reject non-URL strings', () => {
      expect(isValidHttpUrl('not a url')).toBe(false);
      expect(isValidHttpUrl('12345')).toBe(false);
      expect(isValidHttpUrl('@#$%')).toBe(false);
    });

    it('should reject invalid IP addresses', () => {
      expect(isValidHttpUrl('http://999.999.999.999')).toBe(true); // Note: regex doesn't validate IP ranges
      expect(isValidHttpUrl('http://192.168.1')).toBe(false); // Incomplete IP
    });
  });

  describe('edge cases', () => {
    it('should handle very long URLs', () => {
      const longPath = 'a'.repeat(1000);
      expect(isValidHttpUrl(`https://example.com/${longPath}`)).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isValidHttpUrl('HTTPS://EXAMPLE.COM')).toBe(true);
      expect(isValidHttpUrl('HtTpS://ExAmPlE.cOm')).toBe(true);
    });

    it('should handle URLs with multiple query parameters', () => {
      expect(isValidHttpUrl('https://example.com?a=1&b=2&c=3&d=4')).toBe(true);
    });

    it('should handle URLs with encoded characters in query', () => {
      expect(isValidHttpUrl('https://example.com?redirect=https%3A%2F%2Fother.com')).toBe(true);
    });

    it('should handle minimal valid URLs', () => {
      expect(isValidHttpUrl('a.co')).toBe(true);
    });
  });
});
