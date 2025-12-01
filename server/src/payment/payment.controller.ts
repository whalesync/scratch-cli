import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import type { RequestWithUser } from 'src/auth/types';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { isErr } from 'src/types/results';
import { CreateCheckoutSessionResponse } from './dto/create-checkout-session-response';
import { CreateCustomerPortalUrlResponse } from './dto/create-portal-response';
import { CreatePortalDto } from './dto/create-portal.dto';
import { SubscriptionPlanEntity } from './entities/subscription-plan';
import { getPlans, getPlanTypeFromString } from './plans';
import { StripePaymentService } from './stripe-payment.service';

const STRIPE_PAGE_ERROR_USER_FACING_MESSAGE =
  'There was a problem navigating to the payment page. Please contact support.';

@Controller('payment')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class StripePaymentController {
  constructor(
    private readonly stripePaymentService: StripePaymentService,
    private readonly configService: ScratchpadConfigService,
  ) {}

  /**
   * Called by an authenticated user to get a link to their stripe page portal page.
   * This page is for managing their existing subscriptions.
   * Returns a URL that the user should be redirected to.
   */
  @Post('portal')
  async createCustomerPortalUrl(
    @Req() req: RequestWithUser,
    @Body() dto: CreatePortalDto,
  ): Promise<CreateCustomerPortalUrlResponse> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    const result = await this.stripePaymentService.createCustomerPortalUrl(req.user, dto);
    if (isErr(result)) {
      throw new InternalServerErrorException({
        userFacingMessage: STRIPE_PAGE_ERROR_USER_FACING_MESSAGE,
      });
    }
    return { url: result.v };
  }

  /**
   * Called by an authenticated user to start a checkout session for them with stripe.
   * Returns a URL that the user should be redirected to.
   */
  @Post('checkout/:productType')
  async createCheckoutSession(
    @Req() req: RequestWithUser,
    @Param('productType') productType: string,
  ): Promise<CreateCheckoutSessionResponse> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    const productTypeEnum = getPlanTypeFromString(productType);

    // TODO validate the product type enum
    if (!productTypeEnum) {
      throw new BadRequestException({
        userFacingMessage: `Invalid product type: ${productType}`,
      });
    }

    const result = await this.stripePaymentService.generateCheckoutUrl(req.user, productTypeEnum);
    if (isErr(result)) {
      throw new InternalServerErrorException({
        userFacingMessage: STRIPE_PAGE_ERROR_USER_FACING_MESSAGE,
        debugMessage: `Encountered a problem generating stripe checkout URL: ${result.error}`,
      });
    }
    return { url: result.v };
  }

  /**
   * Called by an authenticated user to get a list of available plans.
   * Returns a list of plans that the user can subscribe to.
   */
  @Get('plans')
  listPlans(@Req() req: RequestWithUser): SubscriptionPlanEntity[] {
    if (!req.user) {
      throw new UnauthorizedException();
    }
    const plans = getPlans(this.configService.getScratchpadEnvironment());
    return plans.filter((plan) => !plan.hidden).map((plan) => new SubscriptionPlanEntity(plan));
  }
}
