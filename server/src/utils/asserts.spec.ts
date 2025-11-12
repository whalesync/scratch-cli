import { assertUnreachable } from './asserts';

describe('assertUnreachable', () => {
  it('should throw an error with stringified value', () => {
    const value = 'unexpected' as never;
    expect(() => assertUnreachable(value)).toThrow('Code should be unreachable for this value: "unexpected"');
  });

  it('should throw error with object values', () => {
    const value = { foo: 'bar' } as never;
    expect(() => assertUnreachable(value)).toThrow('Code should be unreachable for this value: {"foo":"bar"}');
  });

  it('should throw error with number values', () => {
    const value = 42 as never;
    expect(() => assertUnreachable(value)).toThrow('Code should be unreachable for this value: 42');
  });

  it('should throw error with null values', () => {
    const value = null as never;
    expect(() => assertUnreachable(value)).toThrow('Code should be unreachable for this value: null');
  });

  it('should throw error with undefined values', () => {
    const value = undefined as never;
    expect(() => assertUnreachable(value)).toThrow('Code should be unreachable for this value:'); // undefined becomes empty in JSON
  });

  it('should throw error with array values', () => {
    const value = [1, 2, 3] as never;
    expect(() => assertUnreachable(value)).toThrow('Code should be unreachable for this value: [1,2,3]');
  });

  it('should be used in exhaustive switch statements', () => {
    type Status = 'active' | 'inactive';

    function handleStatus(status: Status): string {
      switch (status) {
        case 'active':
          return 'Active';
        case 'inactive':
          return 'Inactive';
        default:
          return assertUnreachable(status);
      }
    }

    expect(handleStatus('active')).toBe('Active');
    expect(handleStatus('inactive')).toBe('Inactive');

    // This would be caught at compile time if we added a new status
    const invalidStatus = 'pending' as never;
    expect(() => assertUnreachable(invalidStatus)).toThrow();
  });
});
