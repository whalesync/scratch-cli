import axios from 'axios';
import { agentDomain, apiDomain, getAuthToken, getProtocol } from './common';

interface Snapshot {
  id: string;
  name: string;
}

describe('Smoke Tests', () => {
  let authToken: string;
  let agentJwt: string;
  let snapshotId: string;

  // Increase test and hook timeout to allow slow external requests to succeed
  jest.setTimeout(60000);

  beforeAll(async () => {
    const authConfig = await getAuthToken();
    authToken = authConfig.authToken;
  });

  it('should authenticate and return current user', async () => {
    const response = await axios.get(`${getProtocol(apiDomain)}://${apiDomain}/users/current`, {
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

  it('should fetch snapshots and get the first snapshot ID', async () => {
    const response = await axios.get(`${getProtocol(apiDomain)}://${apiDomain}/snapshot`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      validateStatus: () => true, // Don't throw on any status
    });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);

    const snapshots = response.data as Snapshot[];
    if (snapshots.length === 0) {
      throw new Error(
        'No snapshots found in the account. Please create at least one snapshot before running smoke tests. ',
      );
    }

    const snapshot = snapshots[0];
    console.log(`Selected snapshot ${snapshot.id} (${snapshot.name}) for further testing`);
    snapshotId = snapshot.id;
    expect(snapshotId).toBeDefined();
  });

  it('should fetch sessions for the snapshot using agent JWT', async () => {
    const response = await axios.get(`${getProtocol(agentDomain)}://${agentDomain}/sessions/snapshot/${snapshotId}`, {
      headers: {
        Authorization: `Bearer ${agentJwt}`,
      },
      validateStatus: () => true, // Don't throw on any status
    });

    expect(response.status).toBe(200);
  });
});
