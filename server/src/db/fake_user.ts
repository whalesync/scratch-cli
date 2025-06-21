import { randomUUID } from 'crypto';
import { DbService } from './db.service';

// TODO: We need a user id to own things, but don't have auth set up yet.
// Here's a fake one everyone can share.
export const FAKE_GLOBAL_USER_ID = randomUUID();

export async function ensureFakeUserExists(db: DbService): Promise<void> {
  await db.client.user.upsert({
    where: { id: FAKE_GLOBAL_USER_ID },
    update: {},
    create: { id: FAKE_GLOBAL_USER_ID },
  });
}
