import type { ClerkClient, Organization, User } from '@clerk/backend';
import { Inject, Injectable } from '@nestjs/common';

/*
 * Service for accessing the Clerk SDK.
 */
@Injectable()
export class ClerkService {
  constructor(@Inject('ClerkClient') private readonly client: ClerkClient) {}

  /*
   * Lookup a user by ID
   * @param userId The Clerk ID of the user to lookup
   * @return The associated User object if it could be found
   */
  async getUser(userId: string): Promise<User | undefined> {
    if (userId) {
      return await this.client.users.getUser(userId);
    }
  }

  /*
   * Lookup an Organization by ID
   * @param organizationId The Clerk ID of the organization to lookup
   * @return The associated Organization object if it could be found
   */
  async getOrganization(organizationId: string): Promise<Organization | undefined> {
    if (organizationId) {
      return await this.client.organizations.getOrganization({ organizationId });
    }
  }
}
