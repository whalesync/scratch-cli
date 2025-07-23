import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import { RequestWithUser } from '../auth/types';
import { CreateCustomConnectorDto } from './dto/create-custom-connector.dto';
import { UpdateCustomConnectorDto } from './dto/update-custom-connector.dto';
import { CustomConnectorEntity } from './entities/custom-connector.entity';
import { CustomConnectorService } from './generic-table.service';

@Controller('custom-connectors')
@UseGuards(ScratchpadAuthGuard)
export class CustomConnectorController {
  constructor(private readonly customConnectorService: CustomConnectorService) {}

  @Post()
  async create(
    @Req() req: RequestWithUser,
    @Body() createDto: CreateCustomConnectorDto,
  ): Promise<CustomConnectorEntity> {
    if (!req.user) {
      throw new Error('User not found');
    }
    return this.customConnectorService.create(req.user.id, createDto);
  }

  @Put(':id')
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() updateDto: UpdateCustomConnectorDto,
  ): Promise<CustomConnectorEntity> {
    if (!req.user) {
      throw new Error('User not found');
    }
    return this.customConnectorService.update(req.user.id, id, updateDto);
  }

  @Get()
  async findAll(@Req() req: RequestWithUser): Promise<CustomConnectorEntity[]> {
    if (!req.user) {
      throw new Error('User not found');
    }
    return this.customConnectorService.findAllByUserId(req.user.id);
  }

  @Get(':id')
  async findOne(@Req() req: RequestWithUser, @Param('id') id: string): Promise<CustomConnectorEntity> {
    if (!req.user) {
      throw new Error('User not found');
    }
    return this.customConnectorService.findOne(req.user.id, id);
  }

  @Delete(':id')
  async remove(@Req() req: RequestWithUser, @Param('id') id: string): Promise<void> {
    if (!req.user) {
      throw new Error('User not found');
    }
    return this.customConnectorService.remove(req.user.id, id);
  }
}
