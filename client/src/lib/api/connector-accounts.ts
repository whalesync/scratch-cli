import { ConnectorAccount, CreateConnectorAccountDto, UpdateConnectorAccountDto } from '@spinner/shared-types';
import { TestConnectionResponse } from '@/types/server-entities/connector-accounts';
import { TableGroup, TableList } from '../../types/server-entities/table-list';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

export const connectorAccountsApi = {
  list: async (workbookId: string): Promise<ConnectorAccount[]> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<ConnectorAccount[]>(`/workbooks/${workbookId}/connections`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch connections');
    }
  },

  // GET a single connection
  detail: async (workbookId: string, id: string): Promise<ConnectorAccount> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<ConnectorAccount>(`/workbooks/${workbookId}/connections/${id}`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch connection');
    }
  },

  // POST a new connection
  create: async (workbookId: string, dto: CreateConnectorAccountDto): Promise<ConnectorAccount> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<ConnectorAccount>(`/workbooks/${workbookId}/connections`, dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to create connection');
    }
  },

  // PATCH an existing connection
  update: async (workbookId: string, id: string, dto: UpdateConnectorAccountDto): Promise<ConnectorAccount> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.patch<ConnectorAccount>(`/workbooks/${workbookId}/connections/${id}`, dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to update connection');
    }
  },

  // DELETE a connection
  delete: async (workbookId: string, id: string): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.delete(`/workbooks/${workbookId}/connections/${id}`);
    } catch (error) {
      handleAxiosError(error, 'Failed to delete connection');
    }
  },

  // GET all tables from all workbook connections
  listAllTables: async (workbookId: string): Promise<TableGroup[]> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<TableGroup[]>(`/workbooks/${workbookId}/connections/all-tables`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to list all tables');
    }
  },

  // POST to list tables for a connection or service
  listTables: async (workbookId: string, service: string, connectorAccountId: string | null): Promise<TableList> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<TableList>(`/workbooks/${workbookId}/connections/tables`, {
        service,
        connectorAccountId,
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to list tables');
    }
  },

  // POST to test a connection
  test: async (workbookId: string, id: string): Promise<TestConnectionResponse> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<TestConnectionResponse>(`/workbooks/${workbookId}/connections/${id}/test`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to test connection');
    }
  },
};
