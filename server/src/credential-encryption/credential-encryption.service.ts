import { Injectable } from '@nestjs/common';
import { DecryptedCredentials } from '../remote-service/connector-account/types/encrypted-credentials.interface';
import { EncryptedData, getEncryptionService } from '../utils/encryption';

/**
 * Service responsible for encrypting and decrypting connector account credentials.
 * Provides a centralized way to handle credential encryption across the application.
 */
@Injectable()
export class CredentialEncryptionService {
  /**
   * Encrypts credentials using the application's encryption service.
   * @param credentials - The plaintext credentials to encrypt
   * @returns The encrypted credentials data
   */
  async encryptCredentials(credentials: DecryptedCredentials): Promise<EncryptedData> {
    const encryptionService = getEncryptionService();
    return await encryptionService.encryptObject(credentials);
  }

  /**
   * Decrypts stored credentials from the database format back to plain objects.
   * Returns an empty object if no credentials are provided.
   * @param encryptedCredentials - The encrypted credentials data
   * @returns The decrypted credentials
   */
  async decryptCredentials(encryptedCredentials: EncryptedData): Promise<DecryptedCredentials> {
    if (!encryptedCredentials || Object.keys(encryptedCredentials).length === 0) {
      return {};
    }

    return getEncryptionService().decryptObject<DecryptedCredentials>(encryptedCredentials);
  }
}
