import { days, Duration, durationSince, hours, milliseconds, minutes, seconds } from './duration';

describe('Duration', () => {
  describe('factory functions', () => {
    it('should create duration from milliseconds', () => {
      const duration = milliseconds(1500);
      expect(duration.ms()).toBe(1500);
    });

    it('should create duration from seconds', () => {
      const duration = seconds(5);
      expect(duration.ms()).toBe(5000);
      expect(duration.seconds()).toBe(5);
    });

    it('should create duration from minutes', () => {
      const duration = minutes(2);
      expect(duration.ms()).toBe(120000);
      expect(duration.seconds()).toBe(120);
    });

    it('should create duration from hours', () => {
      const duration = hours(1);
      expect(duration.ms()).toBe(3600000);
      expect(duration.hours()).toBe(1);
    });

    it('should create duration from days', () => {
      const duration = days(1);
      expect(duration.ms()).toBe(86400000);
      expect(duration.hours()).toBe(24);
    });

    it('should handle fractional values', () => {
      const duration = hours(1.5);
      expect(duration.hours()).toBe(1.5);
      expect(duration.ms()).toBe(5400000);
    });

    it('should handle zero values', () => {
      expect(milliseconds(0).ms()).toBe(0);
      expect(seconds(0).ms()).toBe(0);
      expect(minutes(0).ms()).toBe(0);
      expect(hours(0).ms()).toBe(0);
      expect(days(0).ms()).toBe(0);
    });

    it('should handle negative values', () => {
      const duration = hours(-2);
      expect(duration.hours()).toBe(-2);
      expect(duration.ms()).toBe(-7200000);
    });
  });

  describe('durationSince', () => {
    it('should calculate duration since a past date', () => {
      const pastDate = new Date(Date.now() - 5000);
      const duration = durationSince(pastDate);
      expect(duration.ms()).toBeGreaterThanOrEqual(5000);
      expect(duration.ms()).toBeLessThan(6000); // Allow some margin
    });

    it('should return negative duration for future dates', () => {
      const futureDate = new Date(Date.now() + 5000);
      const duration = durationSince(futureDate);
      expect(duration.ms()).toBeLessThan(0);
    });
  });

  describe('Duration class methods', () => {
    describe('ms()', () => {
      it('should return milliseconds', () => {
        const duration = new Duration(1234);
        expect(duration.ms()).toBe(1234);
      });
    });

    describe('seconds()', () => {
      it('should convert to seconds', () => {
        const duration = new Duration(5000);
        expect(duration.seconds()).toBe(5);
      });

      it('should handle fractional seconds', () => {
        const duration = new Duration(1500);
        expect(duration.seconds()).toBe(1.5);
      });
    });

    describe('hours()', () => {
      it('should convert to hours', () => {
        const duration = new Duration(7200000);
        expect(duration.hours()).toBe(2);
      });

      it('should handle fractional hours', () => {
        const duration = new Duration(5400000);
        expect(duration.hours()).toBe(1.5);
      });
    });

    describe('before()', () => {
      it('should return a date in the past', () => {
        const baseDate = new Date('2024-01-01T12:00:00Z');
        const duration = hours(2);
        const result = duration.before(baseDate);
        expect(result).toEqual(new Date('2024-01-01T10:00:00Z'));
      });

      it('should handle day boundaries', () => {
        const baseDate = new Date('2024-01-01T01:00:00Z');
        const duration = hours(3);
        const result = duration.before(baseDate);
        expect(result).toEqual(new Date('2023-12-31T22:00:00Z'));
      });
    });

    describe('after()', () => {
      it('should return a date in the future', () => {
        const baseDate = new Date('2024-01-01T12:00:00Z');
        const duration = hours(2);
        const result = duration.after(baseDate);
        expect(result).toEqual(new Date('2024-01-01T14:00:00Z'));
      });

      it('should handle day boundaries', () => {
        const baseDate = new Date('2024-01-01T23:00:00Z');
        const duration = hours(3);
        const result = duration.after(baseDate);
        expect(result).toEqual(new Date('2024-01-02T02:00:00Z'));
      });
    });

    describe('inPast()', () => {
      it('should return a date in the past', () => {
        const duration = hours(1);
        const result = duration.inPast();
        const now = new Date();
        expect(result.getTime()).toBeLessThan(now.getTime());
        expect(result.getTime()).toBeGreaterThan(now.getTime() - 3600000 - 1000); // Within 1s tolerance
      });
    });

    describe('inFuture()', () => {
      it('should return a date in the future', () => {
        const duration = hours(1);
        const result = duration.inFuture();
        const now = new Date();
        expect(result.getTime()).toBeGreaterThan(now.getTime());
        expect(result.getTime()).toBeLessThan(now.getTime() + 3600000 + 1000); // Within 1s tolerance
      });
    });

    describe('toString()', () => {
      it('should format days with d suffix', () => {
        const duration = days(2.5);
        expect(duration.toString()).toBe('2.500d');
      });

      it('should format hours with h suffix', () => {
        const duration = hours(3.25);
        expect(duration.toString()).toBe('3.250h');
      });

      it('should format minutes with m suffix', () => {
        const duration = minutes(45.5);
        expect(duration.toString()).toBe('45.500m');
      });

      it('should format seconds with s suffix', () => {
        const duration = seconds(30.123);
        expect(duration.toString()).toBe('30.123s');
      });

      it('should format milliseconds with ms suffix', () => {
        const duration = milliseconds(500.5);
        expect(duration.toString()).toBe('500.500ms');
      });

      it('should use largest appropriate unit', () => {
        expect(days(1.5).toString()).toBe('1.500d');
        expect(hours(25).toString()).toBe('1.042d'); // 25 hours = ~1.042 days
        expect(minutes(90).toString()).toBe('1.500h');
        expect(seconds(90).toString()).toBe('1.500m');
        expect(milliseconds(1500).toString()).toBe('1.500s');
      });

      it('should format zero duration', () => {
        const duration = milliseconds(0);
        expect(duration.toString()).toBe('0.000ms');
      });

      it('should truncate to 3 decimal places', () => {
        const duration = milliseconds(123.456789);
        expect(duration.toString()).toBe('123.457ms');
      });
    });
  });

  describe('integration tests', () => {
    it('should chain operations correctly', () => {
      const baseDate = new Date('2024-01-01T12:00:00Z');
      const duration = hours(6);
      const futureDate = duration.after(baseDate);
      const backToBase = duration.before(futureDate);
      expect(backToBase).toEqual(baseDate);
    });

    it('should handle complex duration calculations', () => {
      const duration1 = days(1);
      const duration2 = hours(12);
      const combined = new Duration(duration1.ms() + duration2.ms());
      expect(combined.hours()).toBe(36);
      expect(combined.toString()).toBe('1.500d');
    });
  });
});
