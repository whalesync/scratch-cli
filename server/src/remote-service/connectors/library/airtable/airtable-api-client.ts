import axios, { RawAxiosRequestHeaders } from 'axios';
import { AirtableBaseSchemaResponseV2, AirtableListBasesResponse, AirtableRecord } from './airtable-types';

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
        params: { offset, returnFieldsByFieldId: true },
      });
      yield r.data.records;
      offset = r.data.offset;
    } while (offset);
  }
}
