import { SnapshotStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export class UpdateSnapshotDto {
  @IsIn(['COMMITTING', 'CANCELLED'])
  status: SnapshotStatus;
}
