import { Injectable } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { StripePaymentService } from 'src/payment/stripe-payment.service';
import { SubscriptionService } from 'src/users/subscription.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class DevToolsService {
  constructor(
    private readonly dbService: DbService,
    private readonly usersService: UsersService,
    private readonly stripePaymentService: StripePaymentService,
    private readonly subscriptionService: SubscriptionService,
  ) {}
}
