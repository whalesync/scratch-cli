import { CreateStyleGuideDto, StyleGuide } from '@spinner/shared-types';
import { ExternalContent, UpdateStyleGuideDto } from '@/types/server-entities/style-guide';
import { validateHelper } from '../../utils/validate-helper';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

export const promptAssetApi = {
  // Get all style guides for the current user
  getAll: async (): Promise<StyleGuide[]> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<StyleGuide[]>('/style-guides');
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch resources');
    }
  },

  // Get a single style guide by ID
  getById: async (id: string): Promise<StyleGuide> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<StyleGuide>(`/style-guides/${id}`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch resource');
    }
  },

  // Create a new style guide
  create: async (dto: CreateStyleGuideDto): Promise<StyleGuide> => {
    await validateHelper(dto);

    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<StyleGuide>('/style-guides', dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to create new prompt asset');
    }
  },

  // Update a style guide
  update: async (id: string, data: UpdateStyleGuideDto): Promise<StyleGuide> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.patch<StyleGuide>(`/style-guides/${id}`, data);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to update resource');
    }
  },

  // Delete a style guide
  delete: async (id: string): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.delete(`/style-guides/${id}`);
    } catch (error) {
      handleAxiosError(error, 'Failed to delete resource');
    }
  },

  // Update an external resource
  updateExternalResource: async (id: string): Promise<StyleGuide> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.patch<StyleGuide>(`/style-guides/${id}/update-external-resource`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to update external resource');
    }
  },

  // Download and convert a resource
  downloadResource: async (url: string): Promise<ExternalContent> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<ExternalContent>('/style-guides/download', {
        params: { url },
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to download resource');
    }
  },
};
