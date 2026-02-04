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
import { AudiencefulTableSpec } from '../custom-spec-registry';
import { AudiencefulApiClient, AudiencefulError } from './audienceful-api-client';
import { AudiencefulField } from './audienceful-types';

/**
 * Connector for the Audienceful email marketing platform.
 *
 * This is a JSON-only connector that implements:
 * - fetchJsonTableSpec() for schema discovery
 * - downloadRecordFiles() for fetching records
 *
 * Note: downloadTableRecords throws an error as this connector only supports JSON files.
 */
export class AudiencefulConnector extends Connector<typeof Service.AUDIENCEFUL> {
  readonly service = Service.AUDIENCEFUL;
  static readonly displayName = 'Audienceful';

  private readonly client: AudiencefulApiClient;

  constructor(apiKey: string) {
    super();
    this.client = new AudiencefulApiClient(apiKey);
  }

  /**
   * Test the connection by validating the API key.
   */
  async testConnection(): Promise<void> {
    await this.client.validateCredentials();
  }

  /**
   * List available tables. Audienceful has a single "People" table.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async listTables(): Promise<TablePreview[]> {
    // Audienceful has a flat structure with only one entity type: people
    return [
      {
        id: {
          wsId: 'people',
          remoteId: ['people'],
        },
        displayName: 'People',
        metadata: {
          description: 'Email subscribers in your Audienceful account',
        },
      },
    ];
  }

  /**
   * Build the columns array for the People table.
   */
  private buildPeopleColumns(customFields: AudiencefulField[]): BaseColumnSpec[] {
    const columns: BaseColumnSpec[] = [
      {
        id: { wsId: 'id', remoteId: ['people', 'id'] },
        name: 'ID',
        slug: 'id',
        pgType: PostgresColumnType.NUMERIC,
        readonly: true,
      },
      {
        id: { wsId: 'uid', remoteId: ['people', 'uid'] },
        name: 'UID',
        slug: 'uid',
        pgType: PostgresColumnType.TEXT,
        readonly: true,
      },
      {
        id: { wsId: 'email', remoteId: ['people', 'email'] },
        name: 'Email',
        slug: 'email',
        pgType: PostgresColumnType.TEXT,
        required: true,
        metadata: { textFormat: 'email' },
      },
      {
        id: { wsId: 'tags', remoteId: ['people', 'tags'] },
        name: 'Tags',
        slug: 'tags',
        pgType: PostgresColumnType.JSONB,
      },
      {
        id: { wsId: 'notes', remoteId: ['people', 'notes'] },
        name: 'Notes',
        slug: 'notes',
        pgType: PostgresColumnType.TEXT,
        metadata: { textFormat: 'html' },
      },
      {
        id: { wsId: 'extra_data', remoteId: ['people', 'extra_data'] },
        name: 'Extra Data',
        slug: 'extra_data',
        pgType: PostgresColumnType.JSONB,
        metadata: {},
      },
      {
        id: { wsId: 'status', remoteId: ['people', 'status'] },
        name: 'Status',
        slug: 'status',
        pgType: PostgresColumnType.TEXT,
        readonly: true,
        metadata: {
          options: [
            { value: 'active', label: 'Active' },
            { value: 'unconfirmed', label: 'Unconfirmed' },
            { value: 'bounced', label: 'Bounced' },
            { value: 'unsubscribed', label: 'Unsubscribed' },
          ],
        },
      },
      {
        id: { wsId: 'source', remoteId: ['people', 'source'] },
        name: 'Source',
        slug: 'source',
        pgType: PostgresColumnType.TEXT,
        readonly: true,
        metadata: {
          options: [
            { value: 'import', label: 'Import' },
            { value: 'manual', label: 'Manual' },
            { value: 'api', label: 'API' },
            { value: 'form', label: 'Form' },
          ],
        },
      },
      {
        id: { wsId: 'created_at', remoteId: ['people', 'created_at'] },
        name: 'Created At',
        slug: 'created_at',
        pgType: PostgresColumnType.TIMESTAMP,
        readonly: true,
        metadata: { dateFormat: 'datetime' },
      },
      {
        id: { wsId: 'updated_at', remoteId: ['people', 'updated_at'] },
        name: 'Updated At',
        slug: 'updated_at',
        pgType: PostgresColumnType.TIMESTAMP,
        readonly: true,
        metadata: { dateFormat: 'datetime' },
      },
      {
        id: { wsId: 'last_activity', remoteId: ['people', 'last_activity'] },
        name: 'Last Activity',
        slug: 'last_activity',
        pgType: PostgresColumnType.TIMESTAMP,
        readonly: true,
        metadata: { dateFormat: 'datetime' },
      },
      {
        id: { wsId: 'unsubscribed', remoteId: ['people', 'unsubscribed'] },
        name: 'Unsubscribed',
        slug: 'unsubscribed',
        pgType: PostgresColumnType.TIMESTAMP,
        readonly: true,
        metadata: { dateFormat: 'datetime' },
      },
      {
        id: { wsId: 'country', remoteId: ['people', 'country'] },
        name: 'Country',
        slug: 'country',
        pgType: PostgresColumnType.TEXT,
        readonly: true,
      },
      {
        id: { wsId: 'double_opt_in', remoteId: ['people', 'double_opt_in'] },
        name: 'Double Opt-In',
        slug: 'double_opt_in',
        pgType: PostgresColumnType.TEXT,
        metadata: {
          options: [
            { value: 'not_required', label: 'Not Required' },
            { value: 'required', label: 'Required' },
            { value: 'complete', label: 'Complete' },
          ],
        },
      },
      {
        id: { wsId: 'bounced', remoteId: ['people', 'bounced'] },
        name: 'Bounced',
        slug: 'bounced',
        pgType: PostgresColumnType.BOOLEAN,
        readonly: true,
        metadata: {},
      },
      {
        id: { wsId: 'open_rate', remoteId: ['people', 'open_rate'] },
        name: 'Open Rate',
        slug: 'open_rate',
        pgType: PostgresColumnType.NUMERIC,
        readonly: true,
      },
      {
        id: { wsId: 'click_rate', remoteId: ['people', 'click_rate'] },
        name: 'Click Rate',
        slug: 'click_rate',
        pgType: PostgresColumnType.NUMERIC,
        readonly: true,
      },
    ];

    // Add custom fields (skip built-in fields like email, tags which are already defined)
    const builtInFields = [
      'id',
      'uid',
      'email',
      'tags',
      'notes',
      'extra_data',
      'status',
      'source',
      'created_at',
      'updated_at',
      'last_activity',
      'unsubscribed',
      'country',
      'double_opt_in',
      'bounced',
      'open_rate',
      'click_rate',
    ];
    for (const field of customFields) {
      if (builtInFields.includes(field.data_name)) continue;

      columns.push({
        id: { wsId: field.data_name, remoteId: ['people', field.data_name] },
        name: field.name,
        slug: field.data_name,
        pgType: this.fieldTypeToPgType(field),
      });
    }

    return columns;
  }

  /**
   * Convert an Audienceful field type to a PostgresColumnType.
   */
  private fieldTypeToPgType(field: AudiencefulField): PostgresColumnType {
    switch (field.type) {
      case 'string':
        return PostgresColumnType.TEXT;
      case 'number':
        return PostgresColumnType.NUMERIC;
      case 'date':
        return PostgresColumnType.TIMESTAMP;
      case 'boolean':
        return PostgresColumnType.BOOLEAN;
      case 'tag':
        return PostgresColumnType.JSONB;
      default:
        return PostgresColumnType.TEXT;
    }
  }

  /**
   * Fetch the JSON Table Spec for the People table.
   * Builds a TypeBox schema from the API fields.
   */
  async fetchJsonTableSpec(id: EntityId): Promise<BaseJsonTableSpec> {
    // Validate that we're requesting the people table
    if (id.wsId !== 'people' || !id.remoteId.includes('people')) {
      throw new AudiencefulError(`Table '${id.wsId}' not found. Audienceful only supports the 'People' table.`, 404);
    }

    // Fetch custom fields from the API
    let customFields: AudiencefulField[] = [];
    try {
      customFields = await this.client.listFields();
    } catch (error) {
      // If listFields fails, continue with empty custom fields
      // The standard fields will still be available
      console.warn('Failed to fetch Audienceful custom fields:', error);
    }

    // Build the schema
    const schema = this.buildPeopleSchema(customFields);

    return {
      id,
      slug: id.wsId,
      name: 'People',
      schema,
      idColumnRemoteId: 'uid',
      titleColumnRemoteId: ['email'],
      mainContentColumnRemoteId: ['notes'],
    };
  }

  /**
   * Build the TypeBox schema for a person record.
   */
  private buildPeopleSchema(customFields: AudiencefulField[]): TSchema {
    // Standard fields
    const properties: Record<string, TSchema> = {
      id: Type.Integer({ description: 'Numeric database ID for the person' }),
      uid: Type.String({ description: 'Unique identifier for the person' }),
      email: Type.String({ description: 'Email address', format: 'email' }),
      tags: Type.Array(
        Type.Object(
          {
            id: Type.Optional(Type.Integer({ description: 'Tag ID (auto-generated, not required for create/update)' })),
            name: Type.String({ description: 'Tag name (required)' }),
            color: Type.Optional(Type.String({ description: 'Tag color (defaults to pink if not specified)' })),
          },
          { additionalProperties: false },
        ),
        { description: 'Tags applied to this person. Only name is required when adding new tags.' },
      ),
      notes: Type.Optional(
        Type.Union([Type.String(), Type.Null()], {
          description: 'Notes about this person. Accepts HTML or plain text.',
        }),
      ),
      extra_data: Type.Record(Type.String(), Type.Unknown(), {
        description: 'Additional custom field data stored for this person (e.g., first_name, last_name)',
      }),
      status: Type.Union(
        [Type.Literal('active'), Type.Literal('unconfirmed'), Type.Literal('bounced'), Type.Literal('unsubscribed')],
        { description: 'Subscription status' },
      ),
      source: Type.Optional(
        Type.Union([Type.String(), Type.Null()], {
          description: 'How the person was added (import, manual, api, form, etc.)',
        }),
      ),
      created_at: Type.String({
        description: 'When the person was created',
        format: 'date-time',
      }),
      updated_at: Type.String({
        description: 'When the person was last updated',
        format: 'date-time',
      }),
      last_activity: Type.String({
        description: 'When the person was last active',
        format: 'date-time',
      }),
      unsubscribed: Type.Optional(
        Type.Union([Type.String({ format: 'date-time' }), Type.Null()], {
          description: 'When the person unsubscribed, or null if still subscribed',
        }),
      ),
      country: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Country of the person' })),
      double_opt_in: Type.Union([Type.Literal('not_required'), Type.Literal('required'), Type.Literal('complete')], {
        description: 'Email confirmation status',
      }),
      bounced: Type.Boolean({ description: 'Whether the email address has bounced' }),
      open_rate: Type.Optional(
        Type.Union([Type.Number(), Type.Null()], { description: 'Email open rate for this person' }),
      ),
      click_rate: Type.Optional(
        Type.Union([Type.Number(), Type.Null()], { description: 'Email click rate for this person' }),
      ),
    };

    // Add custom fields (skip built-in fields)
    const builtInFields = [
      'id',
      'uid',
      'email',
      'tags',
      'notes',
      'extra_data',
      'status',
      'source',
      'created_at',
      'updated_at',
      'last_activity',
      'unsubscribed',
      'country',
      'double_opt_in',
      'bounced',
      'open_rate',
      'click_rate',
    ];
    for (const field of customFields) {
      if (builtInFields.includes(field.data_name)) continue;
      properties[field.data_name] = Type.Optional(this.fieldTypeToSchema(field));
    }

    return Type.Object(properties, {
      $id: 'audienceful/people',
      title: 'People',
    });
  }

  /**
   * Convert an Audienceful field type to a TypeBox schema.
   */
  private fieldTypeToSchema(field: AudiencefulField): TSchema {
    const description = field.name;

    switch (field.type) {
      case 'string':
        return Type.Union([Type.String(), Type.Null()], { description });
      case 'number':
        return Type.Union([Type.Number(), Type.Null()], { description });
      case 'date':
        return Type.Union([Type.String({ format: 'date-time' }), Type.Null()], { description });
      case 'boolean':
        return Type.Union([Type.Boolean(), Type.Null()], { description });
      case 'tag':
        // Tags are stored as an array of objects - only name is required for create/update
        return Type.Array(
          Type.Object({
            id: Type.Optional(Type.Integer()),
            name: Type.String(),
            color: Type.Optional(Type.String()),
          }),
          { description },
        );
      default:
        return Type.Unknown({ description });
    }
  }

  /**
   * Download records using the column-based method.
   * @throws Error - This connector only supports JSON schema methods for downloading.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async downloadTableRecords(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _tableSpec: AudiencefulTableSpec,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _columnSettingsMap: SnapshotColumnSettingsMap,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _callback: (params: { records: ConnectorRecord[]; connectorProgress?: JsonSafeObject }) => Promise<void>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _progress: JsonSafeObject,
  ): Promise<void> {
    throw new Error('Audienceful connector does not support downloadTableRecords. Use downloadRecordFiles instead.');
  }

  /**
   * Download all people as JSON files.
   */
  async downloadRecordFiles(
    _tableSpec: BaseJsonTableSpec,
    callback: (params: { files: ConnectorFile[]; connectorProgress?: JsonSafeObject }) => Promise<void>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _progress: JsonSafeObject,
  ): Promise<void> {
    for await (const people of this.client.listPeople()) {
      await callback({ files: people as unknown as ConnectorFile[] });
    }
  }

  public downloadRecordDeep = undefined;

  /**
   * Get the batch size for CRUD operations.
   * Audienceful supports batch operations.
   */
  getBatchSize(): number {
    return 10;
  }

  /**
   * Create new people records.
   */
  /**
   * Create people in Audienceful from raw JSON files.
   * Files should contain Audienceful person data.
   * Returns the created people.
   */
  async createRecords(
    _tableSpec: BaseJsonTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    files: ConnectorFile[],
  ): Promise<ConnectorFile[]> {
    const results: ConnectorFile[] = [];

    for (const file of files) {
      const createData = this.transformToCreateRequest(file);
      const created = await this.client.createPerson(createData);
      results.push(created as unknown as ConnectorFile);
    }

    return results;
  }

  /**
   * Update people in Audienceful from raw JSON files.
   * Files should contain the person data to update (including email).
   */
  async updateRecords(
    _tableSpec: BaseJsonTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    files: ConnectorFile[],
  ): Promise<void> {
    for (const file of files) {
      const updateData = this.transformToUpdateRequest(file);
      await this.client.updatePerson(updateData);
    }
  }

  /**
   * Delete people from Audienceful.
   * Files should contain at least an 'email' field or 'uid' to identify the person.
   */
  async deleteRecords(_tableSpec: BaseJsonTableSpec, files: ConnectorFile[]): Promise<void> {
    for (const file of files) {
      // If email is provided, use it directly
      if (file.email) {
        await this.client.deletePerson({ email: file.email as string });
        continue;
      }

      // Otherwise fetch the person by uid to get the email
      const uid = (file.uid || file.id) as string;
      const person = await this.client.getPerson(uid);
      if (!person) {
        // Person already deleted, skip
        continue;
      }
      await this.client.deletePerson({ email: person.email });
    }
  }

  /**
   * Transform fields to Audienceful create request format.
   */
  private transformToCreateRequest(fields: Record<string, unknown>): {
    email: string;
    tags?: string;
    notes?: string;
    extra_data?: Record<string, unknown>;
    [key: string]: unknown;
  } {
    const { email, tags, notes, extra_data, ...customFields } = fields;

    const request: {
      email: string;
      tags?: string;
      notes?: string;
      extra_data?: Record<string, unknown>;
      [key: string]: unknown;
    } = {
      email: email as string,
    };

    // Transform tags array to comma-separated string (API expects tag names)
    if (tags && Array.isArray(tags)) {
      const tagNames = (tags as { name: string; color?: string }[]).map((t) => t.name);
      request.tags = tagNames.join(',');
    }

    if (notes !== undefined && notes !== null) {
      request.notes = notes as string;
    }

    if (extra_data && typeof extra_data === 'object') {
      request.extra_data = extra_data as Record<string, unknown>;
    }

    // Add custom fields
    for (const [key, value] of Object.entries(customFields)) {
      // Skip internal fields
      if (key === 'uid' || key === 'status' || key === 'created_at' || key === 'updated_at') {
        continue;
      }
      request[key] = value;
    }

    return request;
  }

  /**
   * Transform fields to Audienceful update request format.
   */
  private transformToUpdateRequest(fields: Record<string, unknown>): {
    email: string;
    tags?: string;
    notes?: string;
    extra_data?: Record<string, unknown>;
    [key: string]: unknown;
  } {
    // Update uses the same format as create
    return this.transformToCreateRequest(fields);
  }

  /**
   * Extract error details from an error.
   */
  extractConnectorErrorDetails(error: unknown): ConnectorErrorDetails {
    if (error instanceof AudiencefulError) {
      return {
        userFriendlyMessage: error.message,
        description: error.message,
        additionalContext: {
          status: error.statusCode,
          responseData: error.responseData,
        },
      };
    }

    if (isAxiosError(error)) {
      const commonError = extractCommonDetailsFromAxiosError(this, error);
      if (commonError) return commonError;

      return {
        userFriendlyMessage: extractErrorMessageFromAxiosError(this.service, error, ['message', 'errors']),
        description: error.message,
        additionalContext: {
          status: error.response?.status,
        },
      };
    }

    return {
      userFriendlyMessage: 'An error occurred while connecting to Audienceful',
      description: error instanceof Error ? error.message : String(error),
    };
  }
}
