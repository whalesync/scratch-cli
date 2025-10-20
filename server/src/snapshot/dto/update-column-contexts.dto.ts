import { IsObject } from 'class-validator';
import { SnapshotColumnSettings } from '../types';

export class UpdateColumnContextsDto {
  @IsObject()
  columnContexts: Record<string, SnapshotColumnSettings>;
}
