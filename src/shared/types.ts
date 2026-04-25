// ─── Shared Types (used by both client and server) ───

export type AgentName = string;
export type DebateMode = 'fast' | 'deep';
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'auto';

export interface Agent {
  name: AgentName;
  color: 'blue' | 'green' | 'amber';
}

export interface Message {
  id: string;
  agent: AgentName;
  color: 'blue' | 'green' | 'amber' | 'purple';
  role?: 'user' | 'assistant';
  summary: string;
  content: string;
  code_snippet?: string;
  code_output?: string;
  round: number;
  createdAt: string;
}

export interface Verdict {
  decision: string;
  assumptions: Array<{ text: string; status: 'VALIDATED' | 'UNVALIDATED' }>;
  steelman: string;
  caseAgainst: string;
  missing: string;
  recommendation: {
    action: 'PROCEED' | 'PIVOT' | 'STOP';
    condition: string;
  };
  nextActions: Array<{
    action: string;
    who: string;
    when: string;
    success: string;
  }>;
  confidence: {
    score: number;
    basis: string;
  };
  rawOutput?: string;
  /** @deprecated Keep for compatibility with old UI if needed, but we'll use the fields above */
  agreed_statement?: string;
}


export interface Debate {
  id: string;
  idea: string;
  rounds: number;
  mode: DebateMode;
  messages: Message[];
  verdict: Verdict | null;
  status: 'idle' | 'running' | 'done' | 'error';
  createdAt: string;
}

// ─── SSE Event Types ───
export type SSEEvent =
  | { type: 'init'; debateId: string }
  | { type: 'typing'; agent: AgentName }
  | { type: 'message'; message: Message }
  | { type: 'verdict'; verdict: Verdict }
  | { type: 'error'; error: string }
  | { type: 'continuation_message'; message: Message }
  | { type: 'done' };

// ─── API Request/Response ───
export interface StartDebateRequest {
  idea: string;
  rounds: number;
  mode: DebateMode;
}

export type ContinuationIntensity = 'low' | 'medium' | 'high';

export interface ContinueDebateRequest {
  debateId: string;
  followUp: string;
  intensity: ContinuationIntensity;
}

export interface GraphReasoningRequest {
  idea: string;
  maxIterations?: number;
}

export interface AIResponse {
  content: string;
  reasoning?: string;
}

// ─── Auth (client-side only with localStorage) ───
export interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface Session {
  userId: string;
  name: string;
  email: string;
}
