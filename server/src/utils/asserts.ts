export function assertUnreachable(x: never): never {
  throw new Error(`Code should be unreachable for this value: ${JSON.stringify(x)}`);
}
