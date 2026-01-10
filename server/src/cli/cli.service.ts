import { Injectable } from '@nestjs/common';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';

@Injectable()
export class CliService {
  constructor(private readonly config: ScratchpadConfigService) {}

  // Add your CLI service methods here
}
