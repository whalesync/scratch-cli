import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import { RequestWithUser } from '../auth/types';
import { CreateGenericTableDto } from './dto/create-generic-table.dto';
import { UpdateGenericTableDto } from './dto/update-generic-table.dto';
import { GenericTableEntity } from './entities/generic-table.entity';
import { GenericTableService } from './generic-table.service';

@Controller('generic-tables')
@UseGuards(ScratchpadAuthGuard)
export class GenericTableController {
  constructor(private readonly genericTableService: GenericTableService) {}

  @Post()
  async create(@Req() req: RequestWithUser, @Body() createDto: CreateGenericTableDto): Promise<GenericTableEntity> {
    if (!req.user) {
      throw new Error('User not found');
    }
    return this.genericTableService.create(req.user.id, createDto);
  }

  @Put(':id')
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() updateDto: UpdateGenericTableDto,
  ): Promise<GenericTableEntity> {
    if (!req.user) {
      throw new Error('User not found');
    }
    return this.genericTableService.update(req.user.id, id, updateDto);
  }

  @Get()
  async findAll(@Req() req: RequestWithUser): Promise<GenericTableEntity[]> {
    if (!req.user) {
      throw new Error('User not found');
    }
    return this.genericTableService.findAllByUserId(req.user.id);
  }

  @Get(':id')
  async findOne(@Req() req: RequestWithUser, @Param('id') id: string): Promise<GenericTableEntity> {
    if (!req.user) {
      throw new Error('User not found');
    }
    return this.genericTableService.findOne(req.user.id, id);
  }

  @Delete(':id')
  async remove(@Req() req: RequestWithUser, @Param('id') id: string): Promise<void> {
    if (!req.user) {
      throw new Error('User not found');
    }
    return this.genericTableService.remove(req.user.id, id);
  }
}
