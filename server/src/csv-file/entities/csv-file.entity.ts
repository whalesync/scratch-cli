/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { CsvFileCluster } from 'src/db/cluster-types';

export class CsvFile {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  body: string;
  userId: string;

  constructor(csvFile: CsvFileCluster.CsvFile) {
    this.id = csvFile.id;
    this.createdAt = csvFile.createdAt;
    this.updatedAt = csvFile.updatedAt;
    this.name = csvFile.name;
    this.body = csvFile.body;
    this.userId = csvFile.userId;
  }
}
