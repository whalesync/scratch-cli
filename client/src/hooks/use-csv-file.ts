import useSWR from 'swr';
import { csvFileApi } from '@/lib/api/csv-file';
import { CsvFile, CreateCsvFileDto } from '@/types/server-entities/csv-file';

export function useCsvFiles() {
  const { data, error, isLoading, mutate } = useSWR<CsvFile[]>(
    'csv-files',
    () => csvFileApi.getAll(),
    {
      revalidateOnFocus: false,
    }
  );

  const createCsvFile = async (
    dto: CreateCsvFileDto
  ): Promise<CsvFile> => {
    const newCsvFile = await csvFileApi.create(dto);
    mutate();
    return newCsvFile;
  };

  const updateCsvFile = async (
    csvFileId: string,
    dto: CreateCsvFileDto
  ): Promise<CsvFile> => {
    const updatedCsvFile = await csvFileApi.update(csvFileId, dto);
    mutate();
    return updatedCsvFile;
  };

  const deleteCsvFile = async (csvFileId: string): Promise<void> => {
    await csvFileApi.delete(csvFileId);
    mutate();
  };

  return {
    csvFiles: data || [],
    isLoading,
    error,
    createCsvFile,
    updateCsvFile,
    deleteCsvFile,
  };
}

export function useCsvFile(id: string) {
  const { data, error, isLoading, mutate } = useSWR<CsvFile>(
    id ? `csv-file-${id}` : null,
    () => csvFileApi.getById(id),
    {
      revalidateOnFocus: false,
    }
  );

  return {
    csvFile: data,
    isLoading,
    error,
    mutate,
  };
} 