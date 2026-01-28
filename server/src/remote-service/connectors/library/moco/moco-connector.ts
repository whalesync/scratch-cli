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
  ConnectorRecord,
  EntityId,
  PostgresColumnType,
  TablePreview,
} from '../../types';
import { MocoTableSpec } from '../custom-spec-registry';
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
 * - downloadRecordFiles() for fetching records
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
   * Fetch the column-based table spec for a Moco entity type.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async fetchTableSpec(id: EntityId): Promise<MocoTableSpec> {
    const entityType = id.wsId as MocoEntityType;
    const columns = this.buildColumns(entityType);

    return {
      id,
      slug: id.wsId,
      name: ENTITY_DISPLAY_NAMES[entityType],
      columns,
      titleColumnRemoteId: this.getTitleColumnRemoteId(entityType),
      mainContentColumnRemoteId: this.getMainContentColumnRemoteId(entityType),
    };
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
    return Type.Object(
      {
        id: Type.Number({ description: 'Unique identifier' }),
        type: Type.Union([Type.Literal('customer'), Type.Literal('supplier'), Type.Literal('organization')], {
          description: 'Company type',
        }),
        name: Type.String({ description: 'Company name' }),
        website: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Website URL' })),
        email: Type.Optional(
          Type.Union([Type.String({ format: 'email' }), Type.Null()], { description: 'Email address' }),
        ),
        phone: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Phone number' })),
        fax: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Fax number' })),
        address: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Address' })),
        info: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Additional info' })),
        identifier: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Custom identifier' })),
        intern: Type.Optional(Type.Union([Type.Boolean(), Type.Null()], { description: 'Internal company flag' })),
        currency: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Currency code' })),
        country_code: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Country code' })),
        labels: Type.Optional(Type.Array(Type.String(), { description: 'Labels' })),
        tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags' })),
        user: Type.Optional(
          Type.Object(
            { id: Type.Number(), firstname: Type.String(), lastname: Type.String() },
            { description: 'Assigned user' },
          ),
        ),
        created_at: Type.String({ description: 'Created timestamp', format: 'date-time' }),
        updated_at: Type.String({ description: 'Updated timestamp', format: 'date-time' }),
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
        id: Type.Number({ description: 'Unique identifier' }),
        firstname: Type.String({ description: 'First name' }),
        lastname: Type.String({ description: 'Last name' }),
        title: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Title' })),
        gender: Type.Optional(
          Type.Union([Type.Literal('F'), Type.Literal('M'), Type.Literal('U'), Type.Null()], { description: 'Gender' }),
        ),
        job_position: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Job position' })),
        mobile_phone: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Mobile phone' })),
        work_phone: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Work phone' })),
        work_email: Type.Optional(
          Type.Union([Type.String({ format: 'email' }), Type.Null()], { description: 'Work email' }),
        ),
        work_fax: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Work fax' })),
        home_address: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Home address' })),
        home_email: Type.Optional(
          Type.Union([Type.String({ format: 'email' }), Type.Null()], { description: 'Home email' }),
        ),
        home_phone: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Home phone' })),
        birthday: Type.Optional(
          Type.Union([Type.String({ format: 'date' }), Type.Null()], { description: 'Birthday' }),
        ),
        info: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Additional info' })),
        tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags' })),
        company: Type.Optional(
          Type.Object({ id: Type.Number(), name: Type.String() }, { description: 'Associated company' }),
        ),
        created_at: Type.String({ description: 'Created timestamp', format: 'date-time' }),
        updated_at: Type.String({ description: 'Updated timestamp', format: 'date-time' }),
      },
      { $id: 'moco/contacts', title: 'Contacts' },
    );
  }

  /**
   * Build the TypeBox schema for a Project.
   */
  private buildProjectSchema(): TSchema {
    return Type.Object(
      {
        id: Type.Number({ description: 'Unique identifier' }),
        identifier: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Project identifier' })),
        name: Type.String({ description: 'Project name' }),
        active: Type.Boolean({ description: 'Active status' }),
        billable: Type.Boolean({ description: 'Billable flag' }),
        fixed_price: Type.Boolean({ description: 'Fixed price flag' }),
        retainer: Type.Boolean({ description: 'Retainer flag' }),
        start_date: Type.Optional(
          Type.Union([Type.String({ format: 'date' }), Type.Null()], { description: 'Start date' }),
        ),
        finish_date: Type.Optional(
          Type.Union([Type.String({ format: 'date' }), Type.Null()], { description: 'Finish date' }),
        ),
        color: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Color' })),
        currency: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Currency' })),
        budget: Type.Optional(Type.Union([Type.Number(), Type.Null()], { description: 'Budget' })),
        budget_monthly: Type.Optional(Type.Union([Type.Number(), Type.Null()], { description: 'Monthly budget' })),
        hourly_rate: Type.Optional(Type.Union([Type.Number(), Type.Null()], { description: 'Hourly rate' })),
        info: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Additional info' })),
        labels: Type.Optional(Type.Array(Type.String(), { description: 'Labels' })),
        tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags' })),
        leader: Type.Optional(
          Type.Object(
            { id: Type.Number(), firstname: Type.String(), lastname: Type.String() },
            { description: 'Project leader' },
          ),
        ),
        customer: Type.Optional(
          Type.Object({ id: Type.Number(), name: Type.String() }, { description: 'Customer company' }),
        ),
        created_at: Type.String({ description: 'Created timestamp', format: 'date-time' }),
        updated_at: Type.String({ description: 'Updated timestamp', format: 'date-time' }),
      },
      { $id: 'moco/projects', title: 'Projects' },
    );
  }

  /**
   * Download records using the column-based method.
   * @throws Error - This connector only supports JSON schema methods for downloading.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async downloadTableRecords(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _tableSpec: MocoTableSpec,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _columnSettingsMap: SnapshotColumnSettingsMap,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _callback: (params: { records: ConnectorRecord[]; connectorProgress?: JsonSafeObject }) => Promise<void>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _progress: JsonSafeObject,
  ): Promise<void> {
    throw new Error('Moco connector does not support downloadTableRecords. Use downloadRecordFiles instead.');
  }

  /**
   * Download all entities as JSON files.
   */
  async downloadRecordFiles(
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

  public downloadRecordDeep = undefined;

  /**
   * Get the batch size for CRUD operations.
   */
  getBatchSize(): number {
    return 10;
  }

  /**
   * Create new records.
   */
  async createRecords(
    tableSpec: MocoTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    records: { wsId: string; fields: Record<string, unknown> }[],
  ): Promise<{ wsId: string; remoteId: string }[]> {
    const entityType = tableSpec.id.wsId as MocoEntityType;
    const results: { wsId: string; remoteId: string }[] = [];

    for (const record of records) {
      const createData = this.transformToCreateRequest(entityType, record.fields);
      const created = await this.client.createEntity(entityType, createData);
      results.push({ wsId: record.wsId, remoteId: String(created.id) });
    }

    return results;
  }

  /**
   * Update existing records.
   */
  async updateRecords(
    tableSpec: MocoTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    records: { id: { wsId: string; remoteId: string }; partialFields: Record<string, unknown> }[],
  ): Promise<void> {
    const entityType = tableSpec.id.wsId as MocoEntityType;

    for (const record of records) {
      const updateData = this.transformToUpdateRequest(entityType, record.partialFields);
      await this.client.updateEntity(entityType, parseInt(record.id.remoteId, 10), updateData);
    }
  }

  /**
   * Delete records.
   */
  async deleteRecords(tableSpec: MocoTableSpec, recordIds: { wsId: string; remoteId: string }[]): Promise<void> {
    const entityType = tableSpec.id.wsId as MocoEntityType;

    for (const record of recordIds) {
      try {
        await this.client.deleteEntity(entityType, parseInt(record.remoteId, 10));
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
