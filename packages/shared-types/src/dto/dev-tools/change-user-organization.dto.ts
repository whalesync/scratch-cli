import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChangeUserOrganizationDto {
  @IsString()
  @IsNotEmpty()
  userId?: string;

  @IsString()
  @IsNotEmpty()
  newOrganizationId?: string;

  /**
   * If true, mark the user's old organization as deleted when no other users are associated with it.
   */
  @IsOptional()
  @IsBoolean()
  deleteOldOrganization?: boolean;
}

export type ValidatedChangeUserOrganizationDto = Required<Pick<ChangeUserOrganizationDto, 'userId' | 'newOrganizationId'>> &
  Pick<ChangeUserOrganizationDto, 'deleteOldOrganization'>;
