import { AgentCredential, CreateAgentCredentialDto, UpdateAgentCredentialDto } from '@spinner/shared-types';
import { validate } from 'class-validator';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

export const agentCredentialsApi = {
  list: async (includeUsage: boolean = false): Promise<AgentCredential[]> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<AgentCredential[]>('/user/credentials', {
        params: includeUsage ? { includeUsage: 'true' } : {},
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch agent credentials');
    }
  },
  create: async (dto: CreateAgentCredentialDto): Promise<AgentCredential> => {
    try {
      // Validate the DTO.
      const validationErrors = await validate(dto);
      if (validationErrors.length > 0) {
        const errorMessages = validationErrors
          .map((err) => `${err.property}: ${Object.values(err.constraints || {}).join(', ')}`)
          .join('; ');
        throw new Error(`Validation failed: ${errorMessages}`);
      }

      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<AgentCredential>('/user/credentials/new', dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to create agent credential');
    }
  },
  update: async (id: string, dto: UpdateAgentCredentialDto): Promise<AgentCredential> => {
    try {
      // Validate the DTO.
      const validationErrors = await validate(dto);
      if (validationErrors.length > 0) {
        const errorMessages = validationErrors
          .map((err) => `${err.property}: ${Object.values(err.constraints || {}).join(', ')}`)
          .join('; ');
        throw new Error(`Validation failed: ${errorMessages}`);
      }

      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<AgentCredential>(`/user/credentials/${id}`, dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to update agent credential');
    }
  },
  delete: async (id: string): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.delete(`/user/credentials/${id}`);
    } catch (error) {
      handleAxiosError(error, 'Failed to delete agent credential');
    }
  },
  setDefaultKey: async (id: string): Promise<AgentCredential> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<AgentCredential>(`/user/credentials/${id}/set-default`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to set default agent credential');
    }
  },
};
