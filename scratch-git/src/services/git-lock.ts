const writeLocks = new Map<string, Promise<unknown>>();

export async function withWriteLock<T>(gitBucket: string, ref: string, operation: () => Promise<T>): Promise<T> {
  const lockKey = `${gitBucket}:${ref}`;
  const previousPromise = writeLocks.get(lockKey);
  const ourPromise = (async () => {
    if (previousPromise !== undefined) {
      await previousPromise.catch(() => {});
    }
    return operation();
  })();
  writeLocks.set(lockKey, ourPromise);
  try {
    return await ourPromise;
  } finally {
    if (writeLocks.get(lockKey) === ourPromise) {
      writeLocks.delete(lockKey);
    }
  }
}
