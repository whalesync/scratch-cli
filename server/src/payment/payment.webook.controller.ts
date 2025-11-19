import {
  BadRequestException,
  ClassSerializerInterceptor,
  Controller,
  InternalServerErrorException,
  Post,
  Req,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { isString } from 'lodash';
import { ErrorCode, isErr } from 'src/types/results';
import { StripePaymentService } from './stripe-payment.service';

@Controller('payment')
@UseInterceptors(ClassSerializerInterceptor)
export class StripePaymentWebhookController {
  constructor(private readonly stripePaymentService: StripePaymentService) {}

  /**
   * Handler for the webhook events Stripe triggers for us.
   *
   * There is no auth attached to the request, but it does include a signature header to validate origin.
   *
   * NOTE! Stripe webhooks requires access to the unparsed body to check its signature, so this method needs to be
   * parsed with `RawBodyMiddleware` in `AppModule`.
   */
  @Post('webhook')
  async handleWebhook(@Req() req: Request): Promise<{ result: string }> {
    // Require a signature on the data.

    const signature = req.headers['stripe-signature'] as string;
    if (!isString(signature)) {
      throw new BadRequestException({
        userFacingMessage: '"stripe-signature" header does not contain a string',
      });
    }

    if (!req.body) {
      throw new BadRequestException({
        userFacingMessage: 'request body is empty',
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const result = await this.stripePaymentService.handleWebhookCallback(req.body.toString(), signature);
    if (isErr(result)) {
      if (result.code === ErrorCode.UnauthorizedError || result.code === ErrorCode.StripeLibraryError) {
        throw new UnauthorizedException({
          userFacingMessage: 'stripe signature verification failed',
        });
      }

      if (result.code === ErrorCode.BadRequestError) {
        throw new BadRequestException({
          userFacingMessage: `stripe payload has problems: ${result.error}`,
        });
      }
      throw new InternalServerErrorException({
        userFacingMessage: `internal issue processing webhook: ${result.error}`,
      });
    }

    // What we return doesn't matter as long as the status is 200.
    return { result: 'ok' };
  }
}
