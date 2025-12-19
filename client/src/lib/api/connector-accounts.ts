import { ConnectorAccount, CreateConnectorAccountDto, UpdateConnectorAccountDto } from '@spinner/shared-types';
import { TestConnectionResponse } from '@/types/server-entities/connector-accounts';
import { TableGroup, TableList } from '../../types/server-entities/table-list';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

// TODO: These all need auth for the current user from middleware. Temoparily faking it on the server.
export const connectorAccountsApi = {
  list: async (): Promise<ConnectorAccount[]> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<ConnectorAccount[]>('/connector-accounts');
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch connections');
    }
  },

  // GET a single connection
  detail: async (id: string): Promise<ConnectorAccount> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<ConnectorAccount>(`/connector-accounts/${id}`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch connection');
    }
  },

  // POST a new connection
  create: async (dto: CreateConnectorAccountDto): Promise<ConnectorAccount> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<ConnectorAccount>('/connector-accounts', dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to create connection');
    }
  },

  // PATCH an existing connection
  update: async (id: string, dto: UpdateConnectorAccountDto): Promise<ConnectorAccount> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.patch<ConnectorAccount>(`/connector-accounts/${id}`, dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to update connection');
    }
  },

  // DELETE a connection
  delete: async (id: string): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.delete(`/connector-accounts/${id}`);
    } catch (error) {
      handleAxiosError(error, 'Failed to delete connection');
    }
  },

  // GET all tables from all user connections
  listAllTables: async (): Promise<TableGroup[]> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<TableGroup[]>('/connector-accounts/all-tables');
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to list all tables');
    }
  },

  // POST to list tables for a connection or service
  listTables: async (service: string, connectorAccountId: string | null): Promise<TableList> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<TableList>('/connector-accounts/tables', { service, connectorAccountId });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to list tables');
    }
  },

  // POST to test a connection
  test: async (id: string): Promise<TestConnectionResponse> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<TestConnectionResponse>(`/connector-accounts/${id}/test`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to test connection');
    }
  },
};
