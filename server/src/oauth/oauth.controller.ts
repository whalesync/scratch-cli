import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import { RequestWithUser } from '../auth/types';
import { OAuthCallbackRequest, OAuthInitiateResponse, OAuthService } from './oauth.service';

@Controller('oauth')
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  @UseGuards(ScratchpadAuthGuard)
  @Post(':service/initiate')
  async initiateOAuth(@Param('service') service: string, @Req() req: RequestWithUser): Promise<OAuthInitiateResponse> {
    return this.oauthService.initiateOAuth(service, req.user.id);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':service/callback')
  async handleOAuthCallback(
    @Param('service') service: string,
    @Req() req: RequestWithUser,
    @Body() callbackData: OAuthCallbackRequest,
  ): Promise<{ connectorAccountId: string }> {
    return this.oauthService.handleOAuthCallback(service, req.user.id, callbackData);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post('refresh')
  async refreshOAuthTokens(@Body() body: { connectorAccountId: string }): Promise<{ success: boolean }> {
    await this.oauthService.refreshOAuthTokens(body.connectorAccountId);
    return { success: true };
  }
}
