import { EditSessionStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export class UpdateEditSessionDto {
  @IsIn(['COMMITTING', 'CANCELLED'])
  status: EditSessionStatus;
}
