import { UserCluster } from 'src/db/cluster-types';
import { WSLogger } from 'src/logger';

/**
 * Defines the user that is performing and action and the organization they are acting on behalf of
 */
export interface Actor {
  userId: string;
  organizationId: string;
}

export function userToActor(user: UserCluster.User): Actor {
  if (!user.organizationId) {
    // TODO (DEV-8628): can be removed once migration to organizations is complete -- just here to warn about potential issues during switchover
    WSLogger.error({
      source: 'users.userToActor',
      message: 'User does not have an organization id',
      userId: user.id,
    });
  }

  return {
    userId: user.id,
    organizationId: user.organizationId ?? '<empty org id>',
  };
}

export interface UserSettings {
  [key: string]: string | number | boolean;
}
