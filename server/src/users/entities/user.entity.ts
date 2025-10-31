import { Subscription, TokenType, UserRole } from '@prisma/client';
import { UserCluster } from 'src/db/cluster-types';
import { UserFlagValues } from 'src/experiments/experiments.service';
import { getLastestExpiringSubscription } from 'src/payment/helpers';
import { getPlan, getPlanTypeFromString, ScratchpadPlanType } from 'src/payment/plans';
import { Organization } from './organization.entity';

export interface SubscriptionInfo {
  status: 'valid' | 'expired' | 'payment_failed';
  planDisplayName: string;
  planType: ScratchpadPlanType;
  daysRemaining: number;
  isTrial: boolean;
  canManageSubscription: boolean; // if the current user can manage the subscription
  ownerId: string; // the id of the user who created the subscription
}

export class User {
  createdAt: Date;
  updatedAt: Date;
  clerkId: string | null;
  stripeCustomerId: string | null;
  isAdmin: boolean;
  id: string;
  name?: string;
  email?: string;

  // The token for the client to use for websockets when connecting to the Scratch API
  websocketToken?: string;

  // The JWT for the AI agent to use when talking to the Scratch API
  agentJwt?: string;

  subscription?: SubscriptionInfo;

  experimentalFlags?: UserFlagValues;

  organization?: Organization;

  constructor(user: UserCluster.User, agentJwt?: string, experiments?: UserFlagValues) {
    this.id = user.id;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
    this.clerkId = user.clerkId;
    this.isAdmin = user.role === UserRole.ADMIN;
    this.name = user.name || undefined;
    this.email = user.email || undefined;
    this.stripeCustomerId = user.stripeCustomerId || null;

    if (user.apiTokens) {
      this.websocketToken = findValidToken(user, TokenType.WEBSOCKET);
    }

    this.agentJwt = agentJwt;
    this.experimentalFlags = experiments;
    this.subscription = toSubscriptionInfo(user.id, user.organization?.subscriptions ?? []);
    this.organization = user.organization ? new Organization(user.organization) : undefined;
  }
}

export function findValidToken(user: UserCluster.User, type: TokenType): string | undefined {
  return user.apiTokens.find((token) => token.expiresAt > new Date() && token.type === type)?.token;
}

function toSubscriptionInfo(userId: string, subscriptions: Subscription[]): SubscriptionInfo | undefined {
  const latestSubscription = getLastestExpiringSubscription(subscriptions);
  if (!latestSubscription) {
    return undefined;
  }

  const planType = getPlanTypeFromString(latestSubscription.productType);

  if (!planType) {
    return undefined;
  }

  const plan = getPlan(planType);

  /* How much longer the subscription is valid in days. A negative number respresents how long since the 
  subscription expired */
  const daysRemaining = Math.ceil(
    (latestSubscription.expiration.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
  );
  let status: SubscriptionInfo['status'] = 'valid';
  if (latestSubscription.expiration < new Date()) {
    status = 'expired';
  }
  if (latestSubscription.lastInvoicePaid === false) {
    status = 'payment_failed';
  }

  return {
    status,
    planDisplayName: plan?.displayName ?? 'Untitled Plan',
    planType: planType,
    daysRemaining,
    isTrial: latestSubscription.stripeStatus === 'trialing',
    canManageSubscription: latestSubscription.userId === userId,
    ownerId: latestSubscription.userId,
  };
}
