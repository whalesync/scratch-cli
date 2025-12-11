import { IsNotEmpty, IsObject } from 'class-validator';

export class UpdateSettingsDto {
  /**
   * Only keys present in the map will be updated, other keys will be left unchanged.
   * null values will remove the key from the settings object
   */
  @IsObject()
  @IsNotEmpty()
  updates?: Record<string, string | number | boolean | null>; // null values will remove the key from the settings object
}

export type ValidatedUpdateSettingsDto = Required<UpdateSettingsDto>;
