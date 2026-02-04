// Actually shared-types usually doesn't depend on @nestjs/mapped-types to keep it clean for frontend.
// Let's check imports in create-sync.dto.ts. It uses class-validator.
// If mapped-types is not available, we can just extend and make optional manually or use PartialType if available in a shared utility.
// Standard pattern in this repo seems to be manual or specific DTOs.
// Let's stick to simple inheritance or duplication if needed.
// Wait, `CreateSyncDto` uses `class-transformer` and `class-validator`.
// Let's check if `UpdateSyncDto` can just extend `CreateSyncDto` but make things optional?
// Usually update DTOs allow partial updates.
// Let's look at `dto/connector-account/update-connector-account.dto.d.ts` if I can find it, or just use what I know works.
// For now, I'll just create it extending CreateSyncDto, since replacing the whole sync config (mappings) is likely what we want for "Edit" anyway.
// The user said "Open the modal and prepopulate... resave". This implies PUT/replace semantics or PATCH with full data.

import { CreateSyncDto } from './create-sync.dto';

export class UpdateSyncDto extends CreateSyncDto {}
