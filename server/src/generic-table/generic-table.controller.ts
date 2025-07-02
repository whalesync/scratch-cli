import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import { RequestWithUser } from '../auth/types';
import { CreateGenericTableDto } from './dto/create-generic-table.dto';
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
}
