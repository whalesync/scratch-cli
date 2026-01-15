import axios, { RawAxiosRequestHeaders } from 'axios';
import {
  AirtableApiPushResponse,
  AirtableBaseSchemaResponseV2,
  AirtableListBasesResponse,
  AirtableRecord,
} from './airtable-types';

const AIRTABLE_API_BASE_URL = 'https://api.airtable.com/v0';

/**
 * Client for making api calls to airtable.
 */
export class AirtableApiClient {
  private readonly authHeaders: RawAxiosRequestHeaders;

  constructor(private readonly apiKey: string) {
    this.authHeaders = {
      Authorization: `Bearer ${this.apiKey}`,
      accept: 'application/json',
    };
  }

  /**
   * https://airtable.com/developers/web/api/list-bases
   */
  async listBases(): Promise<AirtableListBasesResponse> {
    const r = await axios.get<AirtableListBasesResponse>(`${AIRTABLE_API_BASE_URL}/meta/bases`, {
      headers: this.authHeaders,
    });
    return r.data;
  }

  async getBaseSchema(baseId: string): Promise<AirtableBaseSchemaResponseV2> {
    const r = await axios.get<AirtableBaseSchemaResponseV2>(`${AIRTABLE_API_BASE_URL}/meta/bases/${baseId}/tables`, {
      headers: this.authHeaders,
    });
    return r.data;
  }

  async *listRecords(baseId: string, tableId: string): AsyncGenerator<AirtableRecord[], void> {
    let offset: string | undefined;
    do {
      const r = await axios.get<{
        records: AirtableRecord[];
        offset?: string;
      }>(`${AIRTABLE_API_BASE_URL}/${baseId}/${tableId}`, {
        headers: this.authHeaders,
        params: { offset },
      });
      yield r.data.records;
      offset = r.data.offset;
    } while (offset);
  }

  // Fields are keyed by airtable field ids.
  async createRecords(
    baseId: string,
    tableId: string,
    records: { fields: Record<string, unknown> }[],
  ): Promise<AirtableRecord[]> {
    const r = await axios.post<AirtableApiPushResponse>(
      `${AIRTABLE_API_BASE_URL}/${baseId}/${tableId}`,
      { records, typecast: true },
      { headers: { ...this.authHeaders, 'Content-Type': 'application/json' } },
    );
    return r.data.records ?? [];
  }

  async updateRecords(
    baseId: string,
    tableId: string,
    records: { id?: string; fields: Record<string, unknown> }[],
  ): Promise<AirtableRecord[]> {
    const r = await axios.patch<AirtableApiPushResponse>(
      `${AIRTABLE_API_BASE_URL}/${baseId}/${tableId}`,
      { records, typecast: true },
      { headers: { ...this.authHeaders, 'Content-Type': 'application/json' } },
    );
    return r.data.records ?? [];
  }

  async deleteRecords(baseId: string, tableId: string, recordIds: string[]): Promise<void> {
    await axios.delete(`${AIRTABLE_API_BASE_URL}/${baseId}/${tableId}`, {
      headers: this.authHeaders,
      params: { records: recordIds },
    });
  }
}
