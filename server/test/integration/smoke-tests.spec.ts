import axios from 'axios';
import { getAgentUrl, getAgentWebSocketUrl, getApiUrl, getAuthToken } from './common';
import { waitForWebSocketMessage } from './websocket';

interface Workbook {
  id: string;
  name: string;
  snapshotTables: Table[];
}

interface Table {
  id: string;
  tableSpec: {
    name: string;
    id: {
      wsId: string;
      remoteId: string[];
    };
  };
}

interface Session {
  id: string;
  name: string;
}

interface TableRecord {
  id: {
    wsId: string;
    remoteId: string[];
  };
  fields: Record<string, string>;
  __edited_fields: Record<string, string>;
  __suggested_values: Record<string, string>;
}

interface RecordsResponse {
  count: number;
  records: TableRecord[];
}

describe('Smoke Tests', () => {
  let authToken: string;
  let agentJwt: string;
  let workbookId: string;
  let table: Table | undefined;
  let sessionId: string | undefined;
  let recordsBeforeAccept: RecordsResponse | undefined;

  // Increase test and hook timeout to allow slow external requests to succeed
  jest.setTimeout(60000);

  beforeAll(async () => {
    const authConfig = await getAuthToken();
    authToken = authConfig.authToken;
  });

  it('should authenticate and return current user', async () => {
    const response = await axios.get(`${getApiUrl()}/users/current`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      validateStatus: () => true, // Don't throw on any status
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('id');
    expect(response.data).toHaveProperty('agentJwt');

    // Store agentJwt for the next test
    agentJwt = (response.data as { agentJwt: string }).agentJwt;
  });

  it('should fetch workbooks and get the first workbook ID', async () => {
    const response = await axios.get(`${getApiUrl()}/workbook`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      validateStatus: () => true, // Don't throw on any status
    });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);

    const workbooks = response.data as Workbook[];
    if (workbooks.length === 0) {
      throw new Error(
        'No workbooks found in the account. Please create at least one workbook before running smoke tests. ',
      );
    }

    const workbook = workbooks[0];
    console.log(`Selected workbook ${workbook.id} (${workbook.name}) for further testing`);
    workbookId = workbook.id;
    expect(workbookId).toBeDefined();

    // Select the first table from the snapshot
    if (!workbook.snapshotTables || workbook.snapshotTables.length === 0) {
      throw new Error(
        `No tables found in workbook ${workbook.id} (${workbook.name}). Please create at least one table before running smoke tests.`,
      );
    }

    table = workbook.snapshotTables[0];
    console.log(`Selected table ${table.id} (${table.tableSpec.name}) for further testing`);
    expect(table.id).toBeDefined();
  });

  it('should fetch table records', async () => {
    const tableId = table?.id;
    expect(tableId).toBeDefined();

    const url = `${getApiUrl()}/workbook/${workbookId}/tables/${tableId}/records?take=1000`;
    console.log(`GET ${url}`);

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      validateStatus: () => true, // Don't throw on any status
    });

    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();

    // Save records response for comparison
    recordsBeforeAccept = response.data as RecordsResponse;
  });

  it('should create a new session for the workbook using agent JWT', async () => {
    const response = await axios.post(
      `${getAgentUrl()}/sessions?workbook_id=${workbookId}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${agentJwt}`,
        },
        validateStatus: () => true, // Don't throw on any status
      },
    );

    expect(response.status).toBe(200);

    const data = response.data as { session: Session };

    // Ensure we got a session with an ID
    expect(data.session).toBeDefined();
    expect(data.session.id).toBeDefined();
    expect(data.session.name).toBeDefined();

    sessionId = data.session.id;
    expect(sessionId.length).toBeGreaterThan(0);
    console.log(`Created session ${sessionId} (${data.session.name})`);
  });

  it('should establish websocket connection and exchange messages', async () => {
    const url = new URL(`${getAgentWebSocketUrl()}/ws/${sessionId}`);
    url.searchParams.set('auth', agentJwt);

    console.log(`Connecting to WebSocket: ${url.toString()}`);

    const ws = new WebSocket(url.toString());
    try {
      await waitForWebSocketMessage(ws, 'connection_confirmed', 5000);

      ws.send(
        JSON.stringify({
          type: 'message',
          data: {
            message: 'Reverse the words in the first string column',
            agent_jwt: agentJwt,
          },
        }),
      );

      await waitForWebSocketMessage(ws, 'message_response', 60000);
    } finally {
      ws.close();
    }
  });

  it('should accept all suggestions for the table', async () => {
    const tableId = table?.id;
    expect(tableId).toBeDefined();

    const url = `${getApiUrl()}/workbook/${workbookId}/tables/${tableId}/accept-all-suggestions`;
    console.log(`POST ${url}`);
    const response = await axios.post(
      url,
      {},
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        validateStatus: () => true, // Don't throw on any status
      },
    );

    expect([200, 201]).toContain(response.status);

    const data = response.data as { recordsUpdated: number; totalChangesAccepted: number };

    // Assert both values are nonzero
    expect(data.recordsUpdated).toBeGreaterThan(0);
    expect(data.totalChangesAccepted).toBeGreaterThan(0);

    // Assert both values are the same
    expect(data.recordsUpdated).toBe(data.totalChangesAccepted);
  });

  it('should fetch table records after accepting suggestions and confirm that changes were made', async () => {
    // NOTE: This ID will change soon
    const tableId = table?.id;
    expect(tableId).toBeDefined();
    expect(recordsBeforeAccept).toBeDefined();

    const url = `${getApiUrl()}/workbook/${workbookId}/tables/${tableId}/records?take=1000`;
    console.log(`GET ${url}`);

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      validateStatus: () => true, // Don't throw on any status
    });

    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();

    const recordsAfterAccept = response.data as RecordsResponse;

    // Confirm that the records have changed by comparing only the fields
    const fieldsBefore = recordsBeforeAccept!.records.map((r) => r.fields);
    const fieldsAfter = recordsAfterAccept.records.map((r) => r.fields);
    expect(fieldsAfter).not.toEqual(fieldsBefore);
  });
});
