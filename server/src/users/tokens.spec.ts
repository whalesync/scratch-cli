import { generateApiToken, generateTokenExpirationDate, generateWebsocketTokenExpirationDate } from './tokens';

describe('User Token Utilities', () => {
  describe('generateApiToken', () => {
    it('should generate a 32 character token', () => {
      const token = generateApiToken();
      expect(token).toHaveLength(32);
    });

    it('should generate unique tokens', () => {
      const token1 = generateApiToken();
      const token2 = generateApiToken();
      expect(token1).not.toBe(token2);
    });

    it('should generate tokens with valid characters', () => {
      const token = generateApiToken();
      // nanoid uses URL-safe characters: A-Za-z0-9_-
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate multiple unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateApiToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe('generateTokenExpirationDate', () => {
    it('should generate a date 6 months in the future', () => {
      const now = Date.now();
      const expirationDate = generateTokenExpirationDate();
      const sixMonthsInMs = 1000 * 60 * 60 * 24 * 180; // 6 months

      // Allow for small time differences during test execution (within 1 second)
      const expectedExpiration = now + sixMonthsInMs;
      const actualExpiration = expirationDate.getTime();
      expect(Math.abs(actualExpiration - expectedExpiration)).toBeLessThan(1000);
    });

    it('should return a Date object', () => {
      const expirationDate = generateTokenExpirationDate();
      expect(expirationDate).toBeInstanceOf(Date);
    });

    it('should generate dates in the future', () => {
      const now = new Date();
      const expirationDate = generateTokenExpirationDate();
      expect(expirationDate.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should generate consistent expiration periods', () => {
      const exp1 = generateTokenExpirationDate();
      // Wait a tiny bit to ensure time passes
      const exp2 = generateTokenExpirationDate();
      // Both should be approximately 6 months from their respective creation times
      // The difference between them should be very small (milliseconds)
      expect(Math.abs(exp2.getTime() - exp1.getTime())).toBeLessThan(100);
    });
  });

  describe('generateWebsocketTokenExpirationDate', () => {
    it('should generate a date 1 day in the future', () => {
      const now = Date.now();
      const expirationDate = generateWebsocketTokenExpirationDate();
      const oneDayInMs = 1000 * 60 * 60 * 24; // 1 day

      // Allow for small time differences during test execution (within 1 second)
      const expectedExpiration = now + oneDayInMs;
      const actualExpiration = expirationDate.getTime();
      expect(Math.abs(actualExpiration - expectedExpiration)).toBeLessThan(1000);
    });

    it('should return a Date object', () => {
      const expirationDate = generateWebsocketTokenExpirationDate();
      expect(expirationDate).toBeInstanceOf(Date);
    });

    it('should generate dates in the future', () => {
      const now = new Date();
      const expirationDate = generateWebsocketTokenExpirationDate();
      expect(expirationDate.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should have shorter expiration than API tokens', () => {
      const wsExpiration = generateWebsocketTokenExpirationDate();
      const apiExpiration = generateTokenExpirationDate();
      expect(wsExpiration.getTime()).toBeLessThan(apiExpiration.getTime());
    });

    it('should generate consistent expiration periods', () => {
      const exp1 = generateWebsocketTokenExpirationDate();
      const exp2 = generateWebsocketTokenExpirationDate();
      // Both should be approximately 1 day from their respective creation times
      // The difference between them should be very small (milliseconds)
      expect(Math.abs(exp2.getTime() - exp1.getTime())).toBeLessThan(100);
    });
  });
});
