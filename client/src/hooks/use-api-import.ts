import useSWR from 'swr';
import { generatePollRecords, executePollRecords, generateDeleteRecord, executeDeleteRecord, generateCreateRecord, executeCreateRecord, generateUpdateRecord, executeUpdateRecord } from '../lib/api/api-import';
import { API_IMPORT_KEYS } from '../lib/api/keys';

export const useGeneratePollRecords = (prompt: string | null) => {
  return useSWR(
    prompt ? API_IMPORT_KEYS.generatePollRecords(prompt) : null,
    () => generatePollRecords(prompt!),
    {
      revalidateOnFocus: false,
    }
  );
};

export const useExecutePollRecords = (functionString: string | null, apiKey: string | null) => {
  return useSWR(
    functionString && apiKey ? API_IMPORT_KEYS.executePollRecords(functionString, apiKey) : null,
    () => executePollRecords(functionString!, apiKey!),
    {
      revalidateOnFocus: false,
    }
  );
};

export const useGenerateDeleteRecord = (prompt: string | null) => {
  return useSWR(
    prompt ? API_IMPORT_KEYS.generateDeleteRecord(prompt) : null,
    () => generateDeleteRecord(prompt!),
    {
      revalidateOnFocus: false,
    }
  );
};

export const useExecuteDeleteRecord = (functionString: string | null, recordId: string | null, apiKey: string | null) => {
  return useSWR(
    functionString && recordId && apiKey ? API_IMPORT_KEYS.executeDeleteRecord(functionString, recordId, apiKey) : null,
    () => executeDeleteRecord(functionString!, recordId!, apiKey!),
    {
      revalidateOnFocus: false,
    }
  );
};

export const useGenerateCreateRecord = (prompt: string | null) => {
  return useSWR(
    prompt ? API_IMPORT_KEYS.generateCreateRecord(prompt) : null,
    () => generateCreateRecord(prompt!),
    {
      revalidateOnFocus: false,
    }
  );
};

export const useExecuteCreateRecord = (functionString: string | null, recordData: Record<string, unknown> | null, apiKey: string | null) => {
  return useSWR(
    functionString && recordData && apiKey ? API_IMPORT_KEYS.executeCreateRecord(functionString, recordData, apiKey) : null,
    () => executeCreateRecord(functionString!, recordData!, apiKey!),
    {
      revalidateOnFocus: false,
    }
  );
};

export const useGenerateUpdateRecord = (prompt: string | null) => {
  return useSWR(
    prompt ? API_IMPORT_KEYS.generateUpdateRecord(prompt) : null,
    () => generateUpdateRecord(prompt!),
    {
      revalidateOnFocus: false,
    }
  );
};

export const useExecuteUpdateRecord = (functionString: string | null, recordId: string | null, recordData: Record<string, unknown> | null, apiKey: string | null) => {
  return useSWR(
    functionString && recordId && recordData && apiKey ? API_IMPORT_KEYS.executeUpdateRecord(functionString, recordId, recordData, apiKey) : null,
    () => executeUpdateRecord(functionString!, recordId!, recordData!, apiKey!),
    {
      revalidateOnFocus: false,
    }
  );
}; 