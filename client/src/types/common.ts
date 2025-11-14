export interface RecordCell {
  recordWsId: string;
  columnWsId: string;
}

export interface ModelOption {
  value: string;
  label: string;
  provider: string;
  description: string;
  contextLength?: number;
  id: string;
  canonicalSlug: string;
  created: number;
  pricing?: {
    prompt: string;
    completion: string;
    request: string;
    image: string;
    web_search: string;
    internal_reasoning: string;
  };
  isPopular?: boolean;
}

export type PersistedModelOption = Pick<ModelOption, 'value' | 'contextLength'>;

export const DEFAULT_AGENT_MODEL_ID = 'openai/gpt-4o-mini';
export const DEFAULT_AGENT_MODEL_CONTEXT_LENGTH = 200000;

export const DEFAULT_AGENT_MODEL: PersistedModelOption = {
  value: DEFAULT_AGENT_MODEL_ID,
  contextLength: DEFAULT_AGENT_MODEL_CONTEXT_LENGTH,
};
