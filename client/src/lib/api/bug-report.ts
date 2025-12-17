import type { CreateBugReportDto } from '@spinner/shared-types';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

export const bugReportApi = {
  report: async (dto: CreateBugReportDto): Promise<{ issueId: string | undefined; link: string | undefined }> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<{ issueId: string | undefined; link: string | undefined }>('/bugs/report', dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to report bug');
    }
  },
};
