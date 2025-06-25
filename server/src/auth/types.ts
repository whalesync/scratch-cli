// NOTE (chris): this is a short workaround to add the user to the request object

import { UserCluster } from 'src/db/cluster-types';

// I know there is likely a better Typescript way to do this globally for the server but I didn't have time to figure it out yet
export interface RequestWithUser extends Request {
  user: UserCluster.User;
}
