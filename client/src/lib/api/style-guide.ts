import { CreateStyleGuideDto, ExternalContent, StyleGuide, UpdateStyleGuideDto } from '@/types/server-entities/style-guide';
import { API_CONFIG } from './config';
import { ScratchpadApiError } from './error';

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
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? 'Failed to fetch style guides', res.status, res.statusText);
    }
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
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? 'Failed to fetch style guide', res.status, res.statusText);
    }
    return res.json();
  },

  // Create a new style guide
  create: async (data: CreateStyleGuideDto): Promise<StyleGuide> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/style-guides`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? 'Failed to create style guide', res.status, res.statusText);
    }
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
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? 'Failed to update style guide', res.status, res.statusText);
    }
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
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? 'Failed to delete style guide', res.status, res.statusText);
    }
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
    if (!res.ok) {
      const errorObj = await res.json();
      throw new ScratchpadApiError(errorObj.message ?? 'Failed to update external resource', res.status, res.statusText);
    }
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
    if (!res.ok) {
      const errorObj = await res.json();
      throw new ScratchpadApiError(errorObj.message ?? 'Failed to download resource', res.status, res.statusText);
    }
    return res.json();
  },
};