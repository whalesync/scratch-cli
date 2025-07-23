import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import { RequestWithUser } from '../auth/types';
import { CsvFileService } from './csv-file.service';
import { CreateCsvFileDto } from './dto/create-csv-file.dto';
import { UpdateCsvFileDto } from './dto/update-csv-file.dto';

@Controller('csv-files')
@UseGuards(ScratchpadAuthGuard)
export class CsvFileController {
  constructor(private readonly csvFileService: CsvFileService) {}

  @Post()
  create(@Body() createCsvFileDto: CreateCsvFileDto, @Req() req: RequestWithUser) {
    return this.csvFileService.create(createCsvFileDto, req.user.id);
  }

  @Get()
  findAll(@Req() req: RequestWithUser) {
    return this.csvFileService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.csvFileService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCsvFileDto: UpdateCsvFileDto, @Req() req: RequestWithUser) {
    return this.csvFileService.update(id, updateCsvFileDto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.csvFileService.remove(id, req.user.id);
  }
}
