export function assertUnreachable(x: never): never {
  throw new Error(`Code should be unreachable for this value: ${JSON.stringify(x)}`);
}

export function assertIsDefined<T>(value: T | undefined | null, message?: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message ?? 'Value is undefined or null');
  }
}
