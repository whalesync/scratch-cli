import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import { RequestWithUser } from 'src/auth/types';
import { AgentCredentialsService } from './agent-credentials.service';
import { CreateAgentCredentialDto, UpdateAgentCredentialDto } from './dto/create-agent-credential.dto';
import { AiAgentCredential } from './entities/credentials.entity';

@Controller('user/credentials')
export class AgentCredentialsController {
  constructor(private readonly service: AgentCredentialsService) {}

  @UseGuards(ScratchpadAuthGuard)
  @Get()
  async findAll(@Req() req: RequestWithUser): Promise<AiAgentCredential[]> {
    return (await this.service.findByUserId(req.user.id)).map((s) => new AiAgentCredential(s));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get('active/:service')
  async findActive(@Param('service') service: string, @Req() req: RequestWithUser): Promise<AiAgentCredential> {
    const result = await this.service.findActiveServiceCredentials(req.user.id, service);

    if (!result) {
      throw new NotFoundException();
    }

    // TODO - lock this endpoint down so only internal API keys can access it with the full api key in the response
    // only the Pydantic agent should be able to access this endpoint with the full api key in the response
    return new AiAgentCredential(result, true);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser): Promise<AiAgentCredential | null> {
    const credential = await this.service.findOne(id);

    if (!credential) {
      return null;
    }

    if (credential.userId !== req.user.id) {
      throw new ForbiddenException();
    }
    return new AiAgentCredential(credential);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post('new')
  async create(
    @Body() createAgentCredentialDto: CreateAgentCredentialDto,
    @Req() req: RequestWithUser,
  ): Promise<AiAgentCredential> {
    return new AiAgentCredential(await this.service.create({ ...createAgentCredentialDto, userId: req.user.id }));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAgentCredentialDto: UpdateAgentCredentialDto,
    @Req() req: RequestWithUser,
  ): Promise<AiAgentCredential> {
    const credential = await this.service.findOne(id);

    if (!credential) {
      throw new NotFoundException();
    }

    if (credential.userId !== req.user.id) {
      throw new ForbiddenException();
    }

    if (credential.source === 'SYSTEM' && updateAgentCredentialDto.description) {
      // users cannot update the details of the system generated credentials, only the enabled flag
      throw new ForbiddenException();
    }

    const updatedCredential = await this.service.update(id, req.user.id, updateAgentCredentialDto);

    if (!updatedCredential) {
      throw new NotFoundException();
    }

    return new AiAgentCredential(updatedCredential);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string, @Req() req: RequestWithUser): Promise<void> {
    const credential = await this.service.findOne(id);

    if (!credential) {
      throw new NotFoundException();
    }

    if (credential.userId !== req.user.id || credential.source === 'SYSTEM') {
      throw new ForbiddenException();
    }

    await this.service.delete(id, req.user.id);
  }
}
