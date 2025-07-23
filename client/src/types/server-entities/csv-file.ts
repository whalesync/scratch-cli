export interface CsvFile {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  body: string;
  userId: string;
}

export interface CreateCsvFileDto {
  name: string;
  body: string;
}

export interface UpdateCsvFileDto {
  name?: string;
  body?: string;
} 