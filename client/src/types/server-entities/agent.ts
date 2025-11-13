/**
 * Data types for interfacing with the Agent API
 */

export interface ChatSessionSummary {
  id: string;
  name: string;
  last_activity: string; // ISO datetime string
  created_at: string; // ISO datetime string
}

export interface SessionListResponse {
  sessions: ChatSessionSummary[];
}

export type DataScope = 'table' | 'record' | 'column';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  message: string;
  timestamp: string;
  payload?: object;
  variant: 'admin' | 'message' | 'progress' | 'error' | 'usage';
}

export interface ChatSession {
  id: string;
  name: string;
  chat_history: ChatMessage[];
  summary_history: Array<{
    requestSummary: string;
    responseSummary: string;
  }>;
  created_at: string;
  last_activity: string;
  snapshot_id?: string;
}

/**
 * Describes a tool or set of tools that the AI agent can use in session
 */
export interface Capability {
  code: string;
  enabledByDefault: boolean;
  displayName: string;
  description: string;
}

export interface CreateSessionResponse {
  session: ChatSessionSummary;
  available_capabilities: Capability[];
}

export type SendMessageResponse = {
  type: 'message_success';
  response_message: string;
  response_summary: string;
  request_summary: string;
};

export type DeleteSessionResponse = {
  success: boolean;
};

export type AgentErrorResponse = {
  type: 'agent_error';
  detail: string;
};

export type CancelAgentRunResponse = {
  message: string;
};

export type CapabilityGroup = 'data' | 'views' | 'table' | 'other';

export const AGENT_CAPABILITIES: Capability[] = [
  {
    code: 'data:create',
    displayName: 'Create new records',
    enabledByDefault: true,
    description: 'Create new records for a table in the active snapshot using data provided by the LLM.',
  },
  {
    code: 'data:update',
    displayName: 'Update existing records',
    enabledByDefault: true,
    description: 'Update existing records in a table in the active snapshot (creates suggestions, not direct changes).',
  },
  {
    code: 'data:delete',
    displayName: 'Delete records',
    enabledByDefault: true,
    description: 'Delete records from a table in the active snapshot by their IDs.',
  },
  {
    code: 'data:field-tools',
    displayName: 'Edit fields',
    enabledByDefault: true,
    description: 'Tools to edit specific fields',
  },
  {
    code: 'data:fetch-tools',
    displayName: 'Load additional records',
    enabledByDefault: true,
    description: 'Tools for loading additional records from different tables and views into the context.',
  },
  {
    code: 'views:filtering',
    enabledByDefault: true,
    displayName: 'Manage filters',
    description: 'Set or clear SQL-based filters on tables to show/hide specific records.',
  },
  {
    code: 'table:add-column',
    displayName: 'Add columns',
    enabledByDefault: false,
    description: 'Add scratch columns to the active table.',
  },
  {
    code: 'table:remove-column',
    displayName: 'Remove columns',
    enabledByDefault: false,
    description: 'Remove scratch columns from the active table.',
  },
  {
    code: 'other:url-content-load',
    displayName: 'Load content from URL',
    enabledByDefault: false,
    description: 'Allows the LLM to load content from a URL and use it in the conversation.',
  },
  {
    code: 'other:upload-content',
    displayName: 'Upload content',
    enabledByDefault: false,
    description: 'Allows the LLM to upload content to the active snapshot.',
  },
];

export function capabilityGroupDisplayName(group: CapabilityGroup): string {
  return group.charAt(0).toUpperCase() + group.slice(1);
}

export function capabilitiesForGroup(group: CapabilityGroup, availableCapabilities?: Capability[]): Capability[] {
  return (availableCapabilities ?? AGENT_CAPABILITIES).filter((capability) => capability.code.startsWith(group));
}

export function capabilitiesByGroup(availableCapabilities?: Capability[]): Record<CapabilityGroup, Capability[]> {
  return (availableCapabilities ?? AGENT_CAPABILITIES).reduce(
    (acc, capability) => {
      const group = capability.code.split(':')[0] as CapabilityGroup;
      acc[group] = acc[group] || [];
      acc[group].push(capability);
      return acc;
    },
    {} as Record<CapabilityGroup, Capability[]>,
  );
}
