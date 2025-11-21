import { Module } from '@nestjs/common';
import { CredentialEncryptionService } from './credential-encryption.service';

/**
 * Module providing credential encryption/decryption services.
 * This module can be imported by any module that needs to handle encrypted credentials.
 */
@Module({
  providers: [CredentialEncryptionService],
  exports: [CredentialEncryptionService],
})
export class CredentialEncryptionModule {}
