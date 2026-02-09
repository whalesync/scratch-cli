import { createClerkClient } from '@clerk/backend';
import { ScratchConfigService } from 'src/config/scratch-config.service';

export const ClerkClientProvider = {
  provide: 'ClerkClient',
  useFactory: (configService: ScratchConfigService) => {
    return createClerkClient({
      publishableKey: configService.getClerkPublishableKey(),
      secretKey: configService.getClerkSecretKey(),
    });
  },
  inject: [ScratchConfigService],
};
