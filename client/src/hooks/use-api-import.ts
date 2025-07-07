import useSWR from 'swr';
import { generatePollRecords, generateDeleteRecord, GeneratePollRecordsRequest, GenerateDeleteRecordRequest } from '../lib/api/api-import';
import { SWR_KEYS } from '../lib/api/keys';

export const useGeneratePollRecords = () => {
  const { data, error, isLoading, mutate } = useSWR(
    SWR_KEYS.apiImport.generatePollRecords(),
    null,
    { revalidateOnFocus: false }
  );

  const trigger = async (request: GeneratePollRecordsRequest) => {
    try {
      const result = await generatePollRecords(request);
      await mutate(result);
      return result;
    } catch (error) {
      throw error;
    }
  };

  return {
    data,
    error,
    isLoading,
    trigger,
  };
};

export const useGenerateDeleteRecord = () => {
  const { data, error, isLoading, mutate } = useSWR(
    SWR_KEYS.apiImport.generateDeleteRecord(),
    null,
    { revalidateOnFocus: false }
  );

  const trigger = async (request: GenerateDeleteRecordRequest) => {
    try {
      const result = await generateDeleteRecord(request);
      await mutate(result);
      return result;
    } catch (error) {
      throw error;
    }
  };

  return {
    data,
    error,
    isLoading,
    trigger,
  };
}; 