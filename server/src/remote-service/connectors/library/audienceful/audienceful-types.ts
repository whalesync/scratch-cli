/**
 * Types for the Audienceful API.
 *
 * Audienceful is an email marketing platform with a simple flat structure
 * (only "people" entity).
 *
 * API Documentation: https://www.audienceful.com/docs/api
 */

/**
 * Credentials for authenticating with the Audienceful API.
 */
export interface AudiencefulCredentials {
  apiKey: string;
}

/**
 * A tag that can be applied to a person in Audienceful.
 */
export interface AudiencefulTag {
  name: string;
  color: string;
}

/**
 * Status values for an Audienceful person.
 */
export type AudiencefulPersonStatus = 'active' | 'unconfirmed' | 'bounced' | 'unsubscribed';

/**
 * A person (subscriber) in Audienceful.
 */
export interface AudiencefulPerson {
  uid: string;
  email: string;
  tags: AudiencefulTag[];
  notes?: string | null;
  extra_data: Record<string, unknown>;
  status: AudiencefulPersonStatus;
  created_at: string; // ISO 8601 date string
  last_activity: string; // ISO 8601 date string
  [key: string]: unknown; // Custom fields
}

/**
 * Schema definition for a custom field in Audienceful.
 * Based on the API response from /api/people/fields/
 */
export interface AudiencefulField {
  id: string;
  name: string;
  data_name: string;
  type: 'string' | 'tag' | 'number' | 'date' | 'boolean';
  editable: boolean;
  required: boolean;
}

/**
 * Paginated response from Audienceful API.
 * Uses cursor-based pagination with next/previous URLs.
 */
export interface AudiencefulPaginatedResponse<T> {
  next: string | null;
  previous: string | null;
  count: number;
  total: number;
  results: T[];
}

/**
 * Request body for creating a person in Audienceful.
 */
export interface AudiencefulCreatePersonRequest {
  email: string;
  tags?: string; // Comma-separated tag names
  notes?: string;
  extra_data?: Record<string, unknown>;
  [key: string]: unknown; // Custom fields
}

/**
 * Request body for updating a person in Audienceful.
 */
export interface AudiencefulUpdatePersonRequest {
  email: string; // Required to identify the person
  tags?: string; // Comma-separated tag names
  notes?: string;
  extra_data?: Record<string, unknown>;
  [key: string]: unknown; // Custom fields
}

/**
 * Request body for deleting a person in Audienceful.
 */
export interface AudiencefulDeletePersonRequest {
  email: string;
}

/**
 * Response from the fields API endpoint.
 * The endpoint returns an array of fields directly.
 */
export type AudiencefulFieldsResponse = AudiencefulField[];

/**
 * Error response from the Audienceful API.
 */
export interface AudiencefulErrorResponse {
  message?: string;
  errors?: Record<string, string[]>;
}
