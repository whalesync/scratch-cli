import { ClassSerializerInterceptor, Controller, UseInterceptors } from '@nestjs/common';
import { FilesService } from './files.service';

/**
 * Public endpoints for files that don't require authentication.
 * Security relies on workbook IDs being unguessable.
 */
@Controller('workbook/public')
@UseInterceptors(ClassSerializerInterceptor)
export class FilesPublicController {
  constructor(private readonly filesService: FilesService) {}
}
