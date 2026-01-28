/**
 * Types for the Moco API.
 *
 * Moco is a project management and time tracking platform.
 * It has entity types: companies, contacts, and projects.
 *
 * API Documentation: https://github.com/hundertzehn/mocoapp-api-docs
 */

/**
 * Credentials for authenticating with the Moco API.
 */
export interface MocoCredentials {
  /** Moco subdomain (e.g., "yourcompany" for yourcompany.mocoapp.com) */
  domain: string;
  /** API key for authentication */
  apiKey: string;
}

/**
 * Reference to a Moco user (minimal info)
 */
export interface MocoUserRef {
  id: number;
  firstname: string;
  lastname: string;
}

/**
 * Reference to a Moco company (minimal info)
 */
export interface MocoCompanyRef {
  id: number;
  name: string;
}

/**
 * Reference to a Moco contract (minimal info)
 */
export interface MocoContractRef {
  id: number;
  name: string;
}

/**
 * Reference to a Moco deal (minimal info)
 */
export interface MocoDealRef {
  id: number;
  name: string;
}

/**
 * Moco project task
 */
export interface MocoProjectTask {
  id: number;
  name: string;
  billable: boolean;
  active: boolean;
  budget?: number;
  hourly_rate?: number;
}

/**
 * Moco Company (Customer/Supplier)
 */
export interface MocoCompany {
  id: number;
  type: 'customer' | 'supplier' | 'organization';
  name: string;
  website?: string;
  email?: string;
  phone?: string;
  fax?: string;
  address?: string;
  info?: string;
  custom_properties?: Record<string, unknown>;
  labels?: string[];
  identifier?: string;
  intern?: boolean;
  billing_tax?: number;
  currency?: string;
  country_code?: string;
  vat_identifier?: string;
  default_invoice_due_days?: number;
  debit_number?: number;
  credit_number?: number;
  iban?: string;
  footer?: string;
  user?: MocoUserRef;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Moco Contact (Person associated with a company)
 */
export interface MocoContact {
  id: number;
  firstname: string;
  lastname: string;
  title?: string;
  gender?: 'F' | 'M' | 'U';
  job_position?: string;
  mobile_phone?: string;
  work_phone?: string;
  work_email?: string;
  work_fax?: string;
  home_address?: string;
  home_email?: string;
  home_phone?: string;
  birthday?: string;
  info?: string;
  tags?: string[];
  custom_properties?: Record<string, unknown>;
  company?: MocoCompanyRef;
  created_at: string;
  updated_at: string;
}

/**
 * Moco Project
 */
export interface MocoProject {
  id: number;
  identifier?: string;
  name: string;
  active: boolean;
  billable: boolean;
  fixed_price: boolean;
  retainer: boolean;
  start_date?: string;
  finish_date?: string;
  color?: string;
  currency?: string;
  billing_variant?: string;
  billing_address?: string;
  billing_email_to?: string;
  billing_email_cc?: string;
  billing_notes?: string;
  setting_include_time_report?: boolean;
  budget?: number;
  budget_monthly?: number;
  budget_expenses?: number;
  hourly_rate?: number;
  info?: string;
  labels?: string[];
  custom_properties?: Record<string, unknown>;
  tags?: string[];
  leader?: MocoUserRef;
  co_leader?: MocoUserRef;
  customer?: MocoCompanyRef;
  contract?: MocoContractRef;
  deal?: MocoDealRef;
  tasks?: MocoProjectTask[];
  created_at: string;
  updated_at: string;
}

/**
 * Entity type identifiers
 */
export type MocoEntityType = 'companies' | 'contacts' | 'projects';

/**
 * Union type for all Moco entities
 */
export type MocoEntity = MocoCompany | MocoContact | MocoProject;

/**
 * Pagination info from Moco response headers
 */
export interface MocoPagination {
  page: number;
  perPage: number;
  total: number;
}

/**
 * Response with pagination info
 */
export interface MocoPaginatedResponse<T> {
  data: T[];
  pagination: MocoPagination;
}

/**
 * Error response from the Moco API
 */
export interface MocoErrorResponse {
  message?: string;
  error?: string;
  code?: string;
}
