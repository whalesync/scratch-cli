/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { createCsvFileId } from 'src/types/ids';
import { DbService } from '../db/db.service';
import { CreateCsvFileDto } from './dto/create-csv-file.dto';
import { UpdateCsvFileDto } from './dto/update-csv-file.dto';
import { CsvFile } from './entities/csv-file.entity';

@Injectable()
export class CsvFileService {
  constructor(private readonly db: DbService) {}

  async create(createCsvFileDto: CreateCsvFileDto, userId: string): Promise<CsvFile> {
    const csvFile = await this.db.client.csvFile.create({
      data: {
        id: createCsvFileId(),
        ...createCsvFileDto,
        userId,
      },
    });

    return new CsvFile(csvFile);
  }

  async findAll(userId: string): Promise<CsvFile[]> {
    const csvFiles = await this.db.client.csvFile.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return csvFiles.map((csvFile) => new CsvFile(csvFile));
  }

  async findOne(id: string, userId: string): Promise<CsvFile | null> {
    const csvFile = await this.db.client.csvFile.findFirst({
      where: { id, userId },
    });

    return csvFile ? new CsvFile(csvFile) : null;
  }

  async update(id: string, updateCsvFileDto: UpdateCsvFileDto, userId: string): Promise<CsvFile | null> {
    const csvFile = await this.db.client.csvFile.updateMany({
      where: { id, userId },
      data: updateCsvFileDto,
    });

    if (csvFile.count === 0) {
      return null;
    }

    const updatedCsvFile = await this.db.client.csvFile.findUnique({
      where: { id },
    });

    return updatedCsvFile ? new CsvFile(updatedCsvFile) : null;
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const result = await this.db.client.csvFile.deleteMany({
      where: { id, userId },
    });

    return result.count > 0;
  }
}
