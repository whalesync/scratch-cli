import { CreateCsvFileDto, CsvFile, UpdateCsvFileDto } from '@/types/server-entities/csv-file';
import { API_CONFIG } from './config';
import { ScratchpadApiError } from './error';

export const csvFileApi = {
  // Get all CSV files for the current user
  getAll: async (): Promise<CsvFile[]> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/csv-files`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? 'Failed to fetch CSV files', res.status, res.statusText);
    }
    return res.json();
  },

  // Get a single CSV file by ID
  getById: async (id: string): Promise<CsvFile> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/csv-files/${id}`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? 'Failed to fetch CSV file', res.status, res.statusText);
    }
    return res.json();
  },

  // Create a new CSV file
  create: async (data: CreateCsvFileDto): Promise<CsvFile> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/csv-files`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? 'Failed to create CSV file', res.status, res.statusText);
    }
    return res.json();
  },

  // Update a CSV file
  update: async (id: string, data: UpdateCsvFileDto): Promise<CsvFile> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/csv-files/${id}`, {
      method: 'PATCH',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? 'Failed to update CSV file', res.status, res.statusText);
    }
    return res.json();
  },

  // Delete a CSV file
  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/csv-files/${id}`, {
      method: 'DELETE',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? 'Failed to delete CSV file', res.status, res.statusText);
    }
  },
}; 