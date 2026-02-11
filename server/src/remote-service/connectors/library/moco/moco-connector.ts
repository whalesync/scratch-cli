import { Type, type TSchema } from '@sinclair/typebox';
import { Service } from '@spinner/shared-types';
import { isAxiosError } from 'axios';
import { JsonSafeObject } from 'src/utils/objects';
import type { SnapshotColumnSettingsMap } from 'src/workbook/types';
import { Connector } from '../../connector';
import { extractCommonDetailsFromAxiosError, extractErrorMessageFromAxiosError } from '../../error';
import {
  BaseColumnSpec,
  BaseJsonTableSpec,
  ConnectorErrorDetails,
  ConnectorFile,
  EntityId,
  PostgresColumnType,
  TablePreview,
} from '../../types';
import { MocoApiClient, MocoError } from './moco-api-client';
import { MocoCredentials, MocoEntityType } from './moco-types';

/**
 * Display names for Moco entity types
 */
const ENTITY_DISPLAY_NAMES: Record<MocoEntityType, string> = {
  companies: 'Companies',
  contacts: 'Contacts',
  projects: 'Projects',
};

/**
 * Entity types supported by Moco
 */
const ENTITY_TYPES: MocoEntityType[] = ['companies', 'contacts', 'projects'];

/**
 * Connector for the Moco project management platform.
 *
 * Moco has three main entity types:
 * - Companies (customers/suppliers)
 * - Contacts (people associated with companies)
 * - Projects
 *
 * This is a JSON-only connector that implements:
 * - fetchJsonTableSpec() for schema discovery
 * - pullRecordFiles() for fetching records
 */
export class MocoConnector extends Connector<typeof Service.MOCO> {
  readonly service = Service.MOCO;
  static readonly displayName = 'Moco CRM';

  private readonly client: MocoApiClient;

  constructor(credentials: MocoCredentials) {
    super();
    this.client = new MocoApiClient(credentials);
  }

  /**
   * Test the connection by validating the credentials.
   */
  async testConnection(): Promise<void> {
    await this.client.validateCredentials();
  }

  /**
   * List available tables. Moco has companies, contacts, and projects.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async listTables(): Promise<TablePreview[]> {
    return ENTITY_TYPES.map((entityType) => ({
      id: {
        wsId: entityType,
        remoteId: [entityType],
      },
      displayName: ENTITY_DISPLAY_NAMES[entityType],
      metadata: {
        description: `${ENTITY_DISPLAY_NAMES[entityType]} in your Moco account`,
        entityType,
      },
    }));
  }

  /**
   * Get the title column remote ID for an entity type.
   */
  private getTitleColumnRemoteId(entityType: MocoEntityType): string[] {
    switch (entityType) {
      case 'companies':
        return [entityType, 'name'];
      case 'contacts':
        return [entityType, 'lastname'];
      case 'projects':
        return [entityType, 'name'];
    }
  }

  /**
   * Get the main content column remote ID for an entity type.
   */
  private getMainContentColumnRemoteId(entityType: MocoEntityType): string[] {
    switch (entityType) {
      case 'companies':
        return [entityType, 'info'];
      case 'contacts':
        return [entityType, 'info'];
      case 'projects':
        return [entityType, 'info'];
    }
  }

  /**
   * Build the columns array for an entity type.
   */
  private buildColumns(entityType: MocoEntityType): BaseColumnSpec[] {
    switch (entityType) {
      case 'companies':
        return this.buildCompanyColumns();
      case 'contacts':
        return this.buildContactColumns();
      case 'projects':
        return this.buildProjectColumns();
    }
  }

  /**
   * Build columns for Companies.
   */
  private buildCompanyColumns(): BaseColumnSpec[] {
    return [
      {
        id: { wsId: 'id', remoteId: ['companies', 'id'] },
        name: 'ID',
        slug: 'id',
        pgType: PostgresColumnType.NUMERIC,
        readonly: true,
      },
      {
        id: { wsId: 'type', remoteId: ['companies', 'type'] },
        name: 'Type',
        slug: 'type',
        pgType: PostgresColumnType.TEXT,
        metadata: {
          options: [
            { value: 'customer', label: 'Customer' },
            { value: 'supplier', label: 'Supplier' },
            { value: 'organization', label: 'Organization' },
          ],
        },
      },
      {
        id: { wsId: 'name', remoteId: ['companies', 'name'] },
        name: 'Name',
        slug: 'name',
        pgType: PostgresColumnType.TEXT,
        required: true,
      },
      {
        id: { wsId: 'website', remoteId: ['companies', 'website'] },
        name: 'Website',
        slug: 'website',
        pgType: PostgresColumnType.TEXT,
        metadata: { textFormat: 'url' },
      },
      {
        id: { wsId: 'email', remoteId: ['companies', 'email'] },
        name: 'Email',
        slug: 'email',
        pgType: PostgresColumnType.TEXT,
        metadata: { textFormat: 'email' },
      },
      {
        id: { wsId: 'phone', remoteId: ['companies', 'phone'] },
        name: 'Phone',
        slug: 'phone',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'fax', remoteId: ['companies', 'fax'] },
        name: 'Fax',
        slug: 'fax',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'address', remoteId: ['companies', 'address'] },
        name: 'Address',
        slug: 'address',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'info', remoteId: ['companies', 'info'] },
        name: 'Info',
        slug: 'info',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'identifier', remoteId: ['companies', 'identifier'] },
        name: 'Identifier',
        slug: 'identifier',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'intern', remoteId: ['companies', 'intern'] },
        name: 'Internal',
        slug: 'intern',
        pgType: PostgresColumnType.BOOLEAN,
      },
      {
        id: { wsId: 'currency', remoteId: ['companies', 'currency'] },
        name: 'Currency',
        slug: 'currency',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'country_code', remoteId: ['companies', 'country_code'] },
        name: 'Country Code',
        slug: 'country_code',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'labels', remoteId: ['companies', 'labels'] },
        name: 'Labels',
        slug: 'labels',
        pgType: PostgresColumnType.JSONB,
      },
      {
        id: { wsId: 'tags', remoteId: ['companies', 'tags'] },
        name: 'Tags',
        slug: 'tags',
        pgType: PostgresColumnType.JSONB,
      },
      {
        id: { wsId: 'created_at', remoteId: ['companies', 'created_at'] },
        name: 'Created At',
        slug: 'created_at',
        pgType: PostgresColumnType.TIMESTAMP,
        readonly: true,
        metadata: { dateFormat: 'datetime' },
      },
      {
        id: { wsId: 'updated_at', remoteId: ['companies', 'updated_at'] },
        name: 'Updated At',
        slug: 'updated_at',
        pgType: PostgresColumnType.TIMESTAMP,
        readonly: true,
        metadata: { dateFormat: 'datetime' },
      },
    ];
  }

  /**
   * Build columns for Contacts.
   */
  private buildContactColumns(): BaseColumnSpec[] {
    return [
      {
        id: { wsId: 'id', remoteId: ['contacts', 'id'] },
        name: 'ID',
        slug: 'id',
        pgType: PostgresColumnType.NUMERIC,
        readonly: true,
      },
      {
        id: { wsId: 'firstname', remoteId: ['contacts', 'firstname'] },
        name: 'First Name',
        slug: 'firstname',
        pgType: PostgresColumnType.TEXT,
        required: true,
      },
      {
        id: { wsId: 'lastname', remoteId: ['contacts', 'lastname'] },
        name: 'Last Name',
        slug: 'lastname',
        pgType: PostgresColumnType.TEXT,
        required: true,
      },
      {
        id: { wsId: 'title', remoteId: ['contacts', 'title'] },
        name: 'Title',
        slug: 'title',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'gender', remoteId: ['contacts', 'gender'] },
        name: 'Gender',
        slug: 'gender',
        pgType: PostgresColumnType.TEXT,
        metadata: {
          options: [
            { value: 'F', label: 'Female' },
            { value: 'M', label: 'Male' },
            { value: 'U', label: 'Unknown' },
          ],
        },
      },
      {
        id: { wsId: 'job_position', remoteId: ['contacts', 'job_position'] },
        name: 'Job Position',
        slug: 'job_position',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'mobile_phone', remoteId: ['contacts', 'mobile_phone'] },
        name: 'Mobile Phone',
        slug: 'mobile_phone',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'work_phone', remoteId: ['contacts', 'work_phone'] },
        name: 'Work Phone',
        slug: 'work_phone',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'work_email', remoteId: ['contacts', 'work_email'] },
        name: 'Work Email',
        slug: 'work_email',
        pgType: PostgresColumnType.TEXT,
        metadata: { textFormat: 'email' },
      },
      {
        id: { wsId: 'work_fax', remoteId: ['contacts', 'work_fax'] },
        name: 'Work Fax',
        slug: 'work_fax',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'home_address', remoteId: ['contacts', 'home_address'] },
        name: 'Home Address',
        slug: 'home_address',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'home_email', remoteId: ['contacts', 'home_email'] },
        name: 'Home Email',
        slug: 'home_email',
        pgType: PostgresColumnType.TEXT,
        metadata: { textFormat: 'email' },
      },
      {
        id: { wsId: 'home_phone', remoteId: ['contacts', 'home_phone'] },
        name: 'Home Phone',
        slug: 'home_phone',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'birthday', remoteId: ['contacts', 'birthday'] },
        name: 'Birthday',
        slug: 'birthday',
        pgType: PostgresColumnType.TIMESTAMP,
        metadata: { dateFormat: 'date' },
      },
      {
        id: { wsId: 'info', remoteId: ['contacts', 'info'] },
        name: 'Info',
        slug: 'info',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'tags', remoteId: ['contacts', 'tags'] },
        name: 'Tags',
        slug: 'tags',
        pgType: PostgresColumnType.JSONB,
      },
      {
        id: { wsId: 'company', remoteId: ['contacts', 'company'] },
        name: 'Company',
        slug: 'company',
        pgType: PostgresColumnType.JSONB,
      },
      {
        id: { wsId: 'created_at', remoteId: ['contacts', 'created_at'] },
        name: 'Created At',
        slug: 'created_at',
        pgType: PostgresColumnType.TIMESTAMP,
        readonly: true,
        metadata: { dateFormat: 'datetime' },
      },
      {
        id: { wsId: 'updated_at', remoteId: ['contacts', 'updated_at'] },
        name: 'Updated At',
        slug: 'updated_at',
        pgType: PostgresColumnType.TIMESTAMP,
        readonly: true,
        metadata: { dateFormat: 'datetime' },
      },
    ];
  }

  /**
   * Build columns for Projects.
   */
  private buildProjectColumns(): BaseColumnSpec[] {
    return [
      {
        id: { wsId: 'id', remoteId: ['projects', 'id'] },
        name: 'ID',
        slug: 'id',
        pgType: PostgresColumnType.NUMERIC,
        readonly: true,
      },
      {
        id: { wsId: 'identifier', remoteId: ['projects', 'identifier'] },
        name: 'Identifier',
        slug: 'identifier',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'name', remoteId: ['projects', 'name'] },
        name: 'Name',
        slug: 'name',
        pgType: PostgresColumnType.TEXT,
        required: true,
      },
      {
        id: { wsId: 'active', remoteId: ['projects', 'active'] },
        name: 'Active',
        slug: 'active',
        pgType: PostgresColumnType.BOOLEAN,
      },
      {
        id: { wsId: 'billable', remoteId: ['projects', 'billable'] },
        name: 'Billable',
        slug: 'billable',
        pgType: PostgresColumnType.BOOLEAN,
      },
      {
        id: { wsId: 'fixed_price', remoteId: ['projects', 'fixed_price'] },
        name: 'Fixed Price',
        slug: 'fixed_price',
        pgType: PostgresColumnType.BOOLEAN,
      },
      {
        id: { wsId: 'retainer', remoteId: ['projects', 'retainer'] },
        name: 'Retainer',
        slug: 'retainer',
        pgType: PostgresColumnType.BOOLEAN,
      },
      {
        id: { wsId: 'start_date', remoteId: ['projects', 'start_date'] },
        name: 'Start Date',
        slug: 'start_date',
        pgType: PostgresColumnType.TIMESTAMP,
        metadata: { dateFormat: 'date' },
      },
      {
        id: { wsId: 'finish_date', remoteId: ['projects', 'finish_date'] },
        name: 'Finish Date',
        slug: 'finish_date',
        pgType: PostgresColumnType.TIMESTAMP,
        metadata: { dateFormat: 'date' },
      },
      {
        id: { wsId: 'color', remoteId: ['projects', 'color'] },
        name: 'Color',
        slug: 'color',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'currency', remoteId: ['projects', 'currency'] },
        name: 'Currency',
        slug: 'currency',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'budget', remoteId: ['projects', 'budget'] },
        name: 'Budget',
        slug: 'budget',
        pgType: PostgresColumnType.NUMERIC,
      },
      {
        id: { wsId: 'budget_monthly', remoteId: ['projects', 'budget_monthly'] },
        name: 'Monthly Budget',
        slug: 'budget_monthly',
        pgType: PostgresColumnType.NUMERIC,
      },
      {
        id: { wsId: 'hourly_rate', remoteId: ['projects', 'hourly_rate'] },
        name: 'Hourly Rate',
        slug: 'hourly_rate',
        pgType: PostgresColumnType.NUMERIC,
      },
      {
        id: { wsId: 'info', remoteId: ['projects', 'info'] },
        name: 'Info',
        slug: 'info',
        pgType: PostgresColumnType.TEXT,
      },
      {
        id: { wsId: 'labels', remoteId: ['projects', 'labels'] },
        name: 'Labels',
        slug: 'labels',
        pgType: PostgresColumnType.JSONB,
      },
      {
        id: { wsId: 'tags', remoteId: ['projects', 'tags'] },
        name: 'Tags',
        slug: 'tags',
        pgType: PostgresColumnType.JSONB,
      },
      {
        id: { wsId: 'leader', remoteId: ['projects', 'leader'] },
        name: 'Leader',
        slug: 'leader',
        pgType: PostgresColumnType.JSONB,
      },
      {
        id: { wsId: 'customer', remoteId: ['projects', 'customer'] },
        name: 'Customer',
        slug: 'customer',
        pgType: PostgresColumnType.JSONB,
      },
      {
        id: { wsId: 'created_at', remoteId: ['projects', 'created_at'] },
        name: 'Created At',
        slug: 'created_at',
        pgType: PostgresColumnType.TIMESTAMP,
        readonly: true,
        metadata: { dateFormat: 'datetime' },
      },
      {
        id: { wsId: 'updated_at', remoteId: ['projects', 'updated_at'] },
        name: 'Updated At',
        slug: 'updated_at',
        pgType: PostgresColumnType.TIMESTAMP,
        readonly: true,
        metadata: { dateFormat: 'datetime' },
      },
    ];
  }

  /**
   * Fetch the JSON Table Spec for a Moco entity type.
   * Builds a TypeBox schema based on the entity type.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async fetchJsonTableSpec(id: EntityId): Promise<BaseJsonTableSpec> {
    const entityType = id.wsId as MocoEntityType;

    if (!ENTITY_TYPES.includes(entityType)) {
      throw new MocoError(`Entity type '${entityType}' not found. Moco supports: ${ENTITY_TYPES.join(', ')}`, 404);
    }

    const schema = this.buildSchema(entityType);

    return {
      id,
      slug: id.wsId,
      name: ENTITY_DISPLAY_NAMES[entityType],
      schema,
      idColumnRemoteId: 'id',
      titleColumnRemoteId: this.getTitleColumnRemoteId(entityType).slice(1),
      mainContentColumnRemoteId: this.getMainContentColumnRemoteId(entityType).slice(1),
    };
  }

  /**
   * Build the TypeBox schema for an entity type.
   */
  private buildSchema(entityType: MocoEntityType): TSchema {
    switch (entityType) {
      case 'companies':
        return this.buildCompanySchema();
      case 'contacts':
        return this.buildContactSchema();
      case 'projects':
        return this.buildProjectSchema();
    }
  }

  /**
   * Build the TypeBox schema for a Company.
   */
  private buildCompanySchema(): TSchema {
    // VAT configuration object schema (shared between billing_vat and customer_vat)
    const vatConfigSchema = Type.Object({
      id: Type.Optional(Type.Number()),
      tax: Type.Optional(Type.Number()),
      description: Type.Optional(Type.String()),
      reverse_charge: Type.Optional(Type.Boolean()),
      intra_eu: Type.Optional(Type.Boolean()),
      print_gross_total: Type.Optional(Type.Boolean()),
      notice_tax_exemption: Type.Optional(Type.String()),
      notice_tax_exemption_en: Type.Optional(Type.String()),
      notice_tax_exemption_alt: Type.Optional(Type.String()),
      active: Type.Optional(Type.Boolean()),
      code: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      credit_account: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    });

    // Abbreviated project schema for the projects array
    const projectRefSchema = Type.Object({
      id: Type.Number(),
      identifier: Type.Optional(Type.String()),
      name: Type.String(),
      active: Type.Boolean(),
      billable: Type.Boolean(),
    });

    return Type.Object(
      {
        id: Type.Number({ description: 'Unique identifier (read-only)' }),
        type: Type.Union([Type.Literal('customer'), Type.Literal('supplier'), Type.Literal('organization')], {
          description: 'Company type (required)',
        }),
        name: Type.String({ description: 'Company name (required)' }),
        website: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Website URL' })),
        email: Type.Optional(
          Type.Union([Type.String({ format: 'email' }), Type.Null()], { description: 'Email address' }),
        ),
        billing_email_cc: Type.Optional(
          Type.Union([Type.String({ format: 'email' }), Type.Null()], { description: 'CC email for invoices' }),
        ),
        phone: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Phone number' })),
        fax: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Fax number' })),
        address: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Address (multiline)' })),
        info: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Additional info' })),
        identifier: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Company code/number' })),
        intern: Type.Optional(Type.Union([Type.Boolean(), Type.Null()], { description: 'Internal company flag' })),
        currency: Type.Optional(
          Type.Union([Type.String(), Type.Null()], { description: 'Currency code (e.g., EUR, USD)' }),
        ),
        country_code: Type.Optional(
          Type.Union([Type.String(), Type.Null()], { description: 'ISO Alpha-2 country code (e.g., US, DE)' }),
        ),
        vat_identifier: Type.Optional(
          Type.Union([Type.String(), Type.Null()], { description: 'EU VAT identification number' }),
        ),
        alternative_correspondence_language: Type.Optional(
          Type.Boolean({ description: 'Use alternative language for documents' }),
        ),
        english_correspondence_language: Type.Optional(Type.Boolean({ description: 'Use English for correspondence' })),
        labels: Type.Optional(Type.Array(Type.String(), { description: 'Labels' })),
        tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags' })),
        user: Type.Optional(
          Type.Object(
            { id: Type.Number(), firstname: Type.String(), lastname: Type.String() },
            { description: 'Assigned user (read-only, use user_id for create/update)' },
          ),
        ),
        footer: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'HTML footer for invoices' })),
        custom_properties: Type.Optional(
          Type.Record(Type.String(), Type.Unknown(), { description: 'Custom properties (key-value pairs)' }),
        ),
        // Billing/customer-specific fields
        billing_tax: Type.Optional(Type.Number({ description: 'Billing tax percentage' })),
        billing_vat: Type.Optional(
          Type.Union([vatConfigSchema, Type.Null()], { description: 'Billing VAT configuration' }),
        ),
        customer_vat: Type.Optional(
          Type.Union([vatConfigSchema, Type.Null()], { description: 'Customer VAT configuration' }),
        ),
        custom_rates: Type.Optional(Type.Boolean({ description: 'Use custom rate pricing' })),
        include_time_report: Type.Optional(Type.Boolean({ description: 'Include time report in invoices' })),
        billing_notes: Type.Optional(
          Type.Union([Type.String(), Type.Null()], { description: 'Special billing instructions' }),
        ),
        default_discount: Type.Optional(Type.Number({ description: 'Default discount percentage' })),
        default_cash_discount: Type.Optional(Type.Number({ description: 'Early payment discount percentage' })),
        default_cash_discount_days: Type.Optional(Type.Number({ description: 'Days for cash discount' })),
        default_invoice_due_days: Type.Optional(Type.Number({ description: 'Invoice payment terms (days)' })),
        // Related entities (read-only)
        projects: Type.Optional(Type.Array(projectRefSchema, { description: 'Associated projects (read-only)' })),
        created_at: Type.String({ description: 'Created timestamp (read-only)', format: 'date-time' }),
        updated_at: Type.String({ description: 'Updated timestamp (read-only)', format: 'date-time' }),
      },
      { $id: 'moco/companies', title: 'Companies' },
    );
  }

  /**
   * Build the TypeBox schema for a Contact.
   */
  private buildContactSchema(): TSchema {
    return Type.Object(
      {
        id: Type.Number({ description: 'Unique identifier (read-only)' }),
        gender: Type.Union([Type.Literal('F'), Type.Literal('M'), Type.Literal('U')], {
          description: 'Gender (required): F=Female, M=Male, U=Unknown',
        }),
        firstname: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'First name' })),
        lastname: Type.String({ description: 'Last name (required)' }),
        title: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Title (e.g., Dr. med.)' })),
        job_position: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Job position/role' })),
        mobile_phone: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Mobile phone number' })),
        work_phone: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Work phone number' })),
        work_email: Type.Optional(
          Type.Union([Type.String({ format: 'email' }), Type.Null()], { description: 'Work email address' }),
        ),
        work_fax: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Work fax number' })),
        work_address: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Work address' })),
        home_address: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Home address' })),
        home_email: Type.Optional(
          Type.Union([Type.String({ format: 'email' }), Type.Null()], { description: 'Home email address' }),
        ),
        home_phone: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Home phone number' })),
        birthday: Type.Optional(
          Type.Union([Type.String({ format: 'date' }), Type.Null()], { description: 'Birthday (YYYY-MM-DD)' }),
        ),
        salutation: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Salutation' })),
        info: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Additional information' })),
        avatar_url: Type.Optional(
          Type.Union([Type.String(), Type.Null()], { description: 'Profile image URL (read-only)' }),
        ),
        tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags/labels' })),
        custom_properties: Type.Optional(
          Type.Record(Type.String(), Type.Unknown(), { description: 'Custom properties (key-value pairs)' }),
        ),
        company: Type.Optional(
          Type.Object(
            {
              id: Type.Number(),
              type: Type.Optional(Type.String()),
              name: Type.String(),
            },
            { description: 'Associated company (read-only, use company_id for create/update)' },
          ),
        ),
        user: Type.Optional(
          Type.Object(
            { id: Type.Number(), firstname: Type.String(), lastname: Type.String() },
            { description: 'Assigned user (read-only, use user_id for create/update)' },
          ),
        ),
        created_at: Type.String({ description: 'Created timestamp (read-only)', format: 'date-time' }),
        updated_at: Type.String({ description: 'Updated timestamp (read-only)', format: 'date-time' }),
      },
      { $id: 'moco/contacts', title: 'Contacts' },
    );
  }

  /**
   * Build the TypeBox schema for a Project.
   */
  private buildProjectSchema(): TSchema {
    // User reference schema (for leader, co_leader)
    const userRefSchema = Type.Object({
      id: Type.Number(),
      firstname: Type.String(),
      lastname: Type.String(),
    });

    // Contact reference schema
    const contactRefSchema = Type.Object({
      id: Type.Number(),
      firstname: Type.Optional(Type.String()),
      lastname: Type.Optional(Type.String()),
    });

    // Task schema
    const taskSchema = Type.Object({
      id: Type.Number(),
      name: Type.String(),
      billable: Type.Boolean(),
      active: Type.Boolean(),
      budget: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
      hourly_rate: Type.Optional(Type.Number()),
      description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    });

    // Contract schema
    const contractSchema = Type.Object({
      id: Type.Number(),
      user_id: Type.Number(),
      firstname: Type.String(),
      lastname: Type.String(),
      billable: Type.Boolean(),
      active: Type.Boolean(),
      budget: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
      hourly_rate: Type.Optional(Type.Number()),
    });

    return Type.Object(
      {
        id: Type.Number({ description: 'Unique identifier (read-only)' }),
        identifier: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Project identifier/code' })),
        name: Type.String({ description: 'Project name (required)' }),
        active: Type.Boolean({ description: 'Active status' }),
        billable: Type.Boolean({ description: 'Billable flag' }),
        fixed_price: Type.Boolean({ description: 'Fixed price project (required)' }),
        retainer: Type.Boolean({ description: 'Retainer project (required)' }),
        start_date: Type.Optional(
          Type.Union([Type.String({ format: 'date' }), Type.Null()], {
            description: 'Start date YYYY-MM-DD (required for create)',
          }),
        ),
        finish_date: Type.Optional(
          Type.Union([Type.String({ format: 'date' }), Type.Null()], {
            description: 'Finish date YYYY-MM-DD (required for create)',
          }),
        ),
        color: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Color (hex code)' })),
        currency: Type.Optional(
          Type.Union([Type.String(), Type.Null()], { description: 'Currency code (required for create)' }),
        ),
        budget: Type.Optional(Type.Union([Type.Number(), Type.Null()], { description: 'Total budget' })),
        budget_monthly: Type.Optional(
          Type.Union([Type.Number(), Type.Null()], { description: 'Monthly budget (required for retainer)' }),
        ),
        budget_expenses: Type.Optional(Type.Union([Type.Number(), Type.Null()], { description: 'Expenses budget' })),
        hourly_rate: Type.Optional(Type.Union([Type.Number(), Type.Null()], { description: 'Default hourly rate' })),
        info: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Additional information' })),
        labels: Type.Optional(Type.Array(Type.String(), { description: 'Labels' })),
        tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags' })),
        custom_properties: Type.Optional(
          Type.Record(Type.String(), Type.Unknown(), { description: 'Custom properties (key-value pairs)' }),
        ),
        // Billing configuration
        billing_variant: Type.Optional(
          Type.Union([Type.Literal('project'), Type.Literal('task'), Type.Literal('user')], {
            description: 'Billing variant',
          }),
        ),
        billing_address: Type.Optional(
          Type.Union([Type.String(), Type.Null()], { description: 'Billing address (multiline with \\n)' }),
        ),
        billing_email_to: Type.Optional(
          Type.Union([Type.String({ format: 'email' }), Type.Null()], { description: 'Billing email recipient' }),
        ),
        billing_email_cc: Type.Optional(
          Type.Union([Type.String({ format: 'email' }), Type.Null()], { description: 'Billing email CC' }),
        ),
        billing_notes: Type.Optional(
          Type.Union([Type.String(), Type.Null()], { description: 'Billing notes/instructions' }),
        ),
        setting_include_time_report: Type.Optional(Type.Boolean({ description: 'Include time report in invoices' })),
        // Retainer-specific fields
        retainer_billing_date: Type.Optional(Type.Number({ description: 'Retainer billing day of month (1-31)' })),
        retainer_billing_title: Type.Optional(
          Type.Union([Type.String(), Type.Null()], { description: 'Retainer billing title' }),
        ),
        retainer_billing_description: Type.Optional(
          Type.Union([Type.String(), Type.Null()], { description: 'Retainer billing description' }),
        ),
        // Related entities (read-only in responses, use *_id for create/update)
        leader: Type.Optional(
          Type.Union([userRefSchema, Type.Null()], {
            description: 'Project leader (read-only, use leader_id for create/update)',
          }),
        ),
        co_leader: Type.Optional(
          Type.Union([userRefSchema, Type.Null()], {
            description: 'Co-leader (read-only, use co_leader_id for create/update)',
          }),
        ),
        customer: Type.Optional(
          Type.Object(
            { id: Type.Number(), name: Type.String() },
            {
              description: 'Customer company (read-only, use customer_id for create/update)',
            },
          ),
        ),
        deal: Type.Optional(
          Type.Union([Type.Object({ id: Type.Number(), name: Type.String() }), Type.Null()], {
            description: 'Associated deal (read-only, use deal_id for create/update)',
          }),
        ),
        project_group: Type.Optional(
          Type.Union([Type.Object({ id: Type.Number(), name: Type.String() }), Type.Null()], {
            description: 'Project group (read-only, use project_group_id for create/update)',
          }),
        ),
        contact: Type.Optional(
          Type.Union([contactRefSchema, Type.Null()], {
            description: 'Primary contact (read-only, use contact_id for create/update)',
          }),
        ),
        secondary_contact: Type.Optional(
          Type.Union([contactRefSchema, Type.Null()], {
            description: 'Secondary contact (read-only, use secondary_contact_id for create/update)',
          }),
        ),
        billing_contact: Type.Optional(
          Type.Union([contactRefSchema, Type.Null()], {
            description: 'Billing contact (read-only, use billing_contact_id for create/update)',
          }),
        ),
        // Nested arrays (read-only)
        tasks: Type.Optional(Type.Array(taskSchema, { description: 'Project tasks (read-only)' })),
        contracts: Type.Optional(Type.Array(contractSchema, { description: 'User contracts (read-only)' })),
        // Other read-only fields
        customer_report_url: Type.Optional(
          Type.Union([Type.String(), Type.Null()], { description: 'Customer report URL (read-only)' }),
        ),
        archived_on: Type.Optional(
          Type.Union([Type.String({ format: 'date' }), Type.Null()], { description: 'Archive date (read-only)' }),
        ),
        created_at: Type.String({ description: 'Created timestamp (read-only)', format: 'date-time' }),
        updated_at: Type.String({ description: 'Updated timestamp (read-only)', format: 'date-time' }),
      },
      { $id: 'moco/projects', title: 'Projects' },
    );
  }

  /**
   * Download all entities as JSON files.
   */
  async pullRecordFiles(
    tableSpec: BaseJsonTableSpec,
    callback: (params: { files: ConnectorFile[]; connectorProgress?: JsonSafeObject }) => Promise<void>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _progress: JsonSafeObject,
  ): Promise<void> {
    const entityType = tableSpec.id.wsId as MocoEntityType;

    for await (const entities of this.client.listEntities(entityType)) {
      await callback({ files: entities as unknown as ConnectorFile[] });
    }
  }

  public pullRecordDeep = undefined;

  /**
   * Get the batch size for CRUD operations.
   */
  getBatchSize(): number {
    return 10;
  }

  /**
   * Create new records.
   */
  /**
   * Create entities in Moco from raw JSON files.
   * Files should contain Moco entity data.
   * Returns the created entities.
   */
  async createRecords(
    tableSpec: BaseJsonTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    files: ConnectorFile[],
  ): Promise<ConnectorFile[]> {
    const entityType = tableSpec.id.wsId as MocoEntityType;
    const results: ConnectorFile[] = [];

    for (const file of files) {
      const createData = this.transformToCreateRequest(entityType, file);
      const created = await this.client.createEntity(entityType, createData);
      results.push(created as unknown as ConnectorFile);
    }

    return results;
  }

  /**
   * Update entities in Moco from raw JSON files.
   * Files should have an 'id' field and the data to update.
   */
  async updateRecords(
    tableSpec: BaseJsonTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    files: ConnectorFile[],
  ): Promise<void> {
    const entityType = tableSpec.id.wsId as MocoEntityType;

    for (const file of files) {
      const entityId = parseInt(String(file.id), 10);
      const updateData = this.transformToUpdateRequest(entityType, file);
      await this.client.updateEntity(entityType, entityId, updateData);
    }
  }

  /**
   * Delete entities from Moco.
   * Files should have an 'id' field with the entity ID to delete.
   */
  async deleteRecords(tableSpec: BaseJsonTableSpec, files: ConnectorFile[]): Promise<void> {
    const entityType = tableSpec.id.wsId as MocoEntityType;

    for (const file of files) {
      try {
        const entityId = parseInt(String(file.id), 10);
        await this.client.deleteEntity(entityType, entityId);
      } catch (error) {
        // Ignore 404 errors - the record may already be deleted
        if (isAxiosError(error) && error.response?.status === 404) {
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Allowed fields for each entity type.
   * These are the fields Moco API accepts for create/update operations.
   */
  private static readonly ALLOWED_FIELDS: Record<MocoEntityType, string[]> = {
    companies: [
      'type',
      'name',
      'website',
      'email',
      'phone',
      'fax',
      'address',
      'info',
      'custom_properties',
      'labels',
      'identifier',
      'intern',
      'billing_tax',
      'currency',
      'country_code',
      'vat_identifier',
      'default_invoice_due_days',
      'debit_number',
      'credit_number',
      'iban',
      'footer',
      'tags',
    ],
    contacts: [
      'firstname',
      'lastname',
      'title',
      'gender',
      'job_position',
      'mobile_phone',
      'work_phone',
      'work_email',
      'work_fax',
      'work_address',
      'home_email',
      'home_address',
      'home_phone',
      'birthday',
      'info',
      'tags',
      'company_id',
      'custom_properties',
    ],
    projects: [
      'name',
      'identifier',
      'active',
      'billable',
      'fixed_price',
      'retainer',
      'start_date',
      'finish_date',
      'color',
      'currency',
      'budget',
      'budget_monthly',
      'hourly_rate',
      'info',
      'labels',
      'tags',
      'leader_id',
      'co_leader_id',
      'customer_id',
      'deal_id',
      'billing_address',
      'billing_email_to',
      'billing_email_cc',
      'billing_notes',
      'billing_variant',
      'budget_expenses',
      'custom_properties',
    ],
  };

  /**
   * Transform fields to Moco create request format.
   * Filters out read-only and relation fields that Moco doesn't accept.
   */
  private transformToCreateRequest(
    entityType: MocoEntityType,
    fields: Record<string, unknown>,
  ): Record<string, unknown> {
    const allowedFields = MocoConnector.ALLOWED_FIELDS[entityType];

    const result: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in fields && fields[field] !== undefined) {
        result[field] = fields[field];
      }
    }

    // Handle company relation - convert company object to company_id
    if (entityType === 'contacts' && 'company' in fields && fields.company && typeof fields.company === 'object') {
      const company = fields.company as { id?: number };
      if (company.id) {
        result['company_id'] = company.id;
      }
    }

    return result;
  }

  /**
   * Transform fields to Moco update request format.
   */
  private transformToUpdateRequest(
    entityType: MocoEntityType,
    fields: Record<string, unknown>,
  ): Record<string, unknown> {
    return this.transformToCreateRequest(entityType, fields);
  }

  /**
   * Extract error details from an error.
   */
  extractConnectorErrorDetails(error: unknown): ConnectorErrorDetails {
    if (error instanceof MocoError) {
      return {
        userFriendlyMessage: error.message,
        description: error.message,
        additionalContext: {
          status: error.statusCode,
          code: error.code,
          responseData: error.responseData,
        },
      };
    }

    if (isAxiosError(error)) {
      const commonError = extractCommonDetailsFromAxiosError(this, error);
      if (commonError) return commonError;

      return {
        userFriendlyMessage: extractErrorMessageFromAxiosError(this.service, error, ['message', 'error']),
        description: error.message,
        additionalContext: {
          status: error.response?.status,
        },
      };
    }

    return {
      userFriendlyMessage: 'An error occurred while connecting to Moco',
      description: error instanceof Error ? error.message : String(error),
    };
  }
}
