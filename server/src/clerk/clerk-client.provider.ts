import { createClerkClient } from '@clerk/backend';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';

export const ClerkClientProvider = {
  provide: 'ClerkClient',
  useFactory: (configService: ScratchpadConfigService) => {
    return createClerkClient({
      publishableKey: configService.getClerkPublishableKey(),
      secretKey: configService.getClerkSecretKey(),
    });
  },
  inject: [ScratchpadConfigService],
};
