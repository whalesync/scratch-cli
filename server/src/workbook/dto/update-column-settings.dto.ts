import { IsObject } from 'class-validator';
import type { SnapshotColumnSettingsMap } from '../types';

export class UpdateColumnSettingsDto {
  /** Only keys present in the map will be updated, other keys will be left unchanged. */
  @IsObject()
  columnSettings: SnapshotColumnSettingsMap;
}
