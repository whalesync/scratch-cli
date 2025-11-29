import { ExternalContent, StyleGuide, UpdateStyleGuideDto } from '@/types/server-entities/style-guide';
import { CreateStyleGuideDto } from '@spinner/shared-types';
import { validate } from 'class-validator';
import { API_CONFIG } from './config';
import { checkForApiError } from './error';

export const styleGuideApi = {
  // Get all style guides for the current user
  getAll: async (): Promise<StyleGuide[]> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/style-guides`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    await checkForApiError(res, 'Failed to fetch resources');
    return res.json();
  },

  // Get a single style guide by ID
  getById: async (id: string): Promise<StyleGuide> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/style-guides/${id}`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    await checkForApiError(res, 'Failed to fetch resource');
    return res.json();
  },

  // Create a new style guide
  create: async (dto: CreateStyleGuideDto): Promise<StyleGuide> => {
    // Validate the DTO.
    const validationErrors = await validate(dto);
    if (validationErrors.length > 0) {
      const errorMessages = validationErrors
        .map((err) => `${err.property}: ${Object.values(err.constraints || {}).join(', ')}`)
        .join('; ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }

    const res = await fetch(`${API_CONFIG.getApiUrl()}/style-guides`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
    await checkForApiError(res, 'Failed to create new prompt asset');
    return res.json();
  },

  // Update a style guide
  update: async (id: string, data: UpdateStyleGuideDto): Promise<StyleGuide> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/style-guides/${id}`, {
      method: 'PATCH',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    await checkForApiError(res, 'Failed to update resource');
    return res.json();
  },

  // Delete a style guide
  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/style-guides/${id}`, {
      method: 'DELETE',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    await checkForApiError(res, 'Failed to delete resource');
  },

  // Update an external resource
  updateExternalResource: async (id: string): Promise<StyleGuide> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/style-guides/${id}/update-external-resource`, {
      method: 'PATCH',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    await checkForApiError(res, 'Failed to update external resource');
    return res.json();
  },

  // Download and convert a resource
  downloadResource: async (url: string): Promise<ExternalContent> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/style-guides/download?url=${encodeURIComponent(url)}`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    await checkForApiError(res, 'Failed to download resource');
    return res.json();
  },
};
