// ─── Graph State — Shared state flowing through the reasoning graph ───

export interface ToolResult {
  tool: string;
  query: string;
  result: string;
  timestamp: string;
}

export interface IterationRecord {
  iteration: number;
  reasoning: string;
  summary?: string;
  action: 'continue' | 'tool_call' | 'final_answer';
  toolName?: string;
  toolArgs?: any;
  toolResult?: string;
  timestamp: string;
  id?: string;
}

import { MemoryContext } from '../../services/memory.service';

export interface GraphState {
  /** The original idea/topic to reason about */
  idea: string;

  /** LLM message history (kept trimmed for token efficiency) */
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; name?: string; id?: string }>;

  /** Accumulated tool call results */
  toolResults: ToolResult[];

  /** Full trace of each reasoning iteration */
  iterations: IterationRecord[];

  /** Current iteration counter (0-indexed) */
  iteration: number;

  /** Hard upper bound on iterations */
  maxIterations: number;

  /** The final consolidated answer (null until done) */
  finalAnswer: string | null;

  /** Current graph execution status */
  status: 'running' | 'done' | 'error';

  /** Memory context (facts, episodes) */
  memory?: MemoryContext;

  /** RAG context from uploaded documents */
  ragContext?: string;
}

/**
 * Create an initial graph state for a new reasoning session.
 */
export function createInitialState(idea: string, maxIterations: number = 3): GraphState {
  return {
    idea,
    messages: [],
    toolResults: [],
    iterations: [],
    iteration: 0,
    maxIterations: Math.min(5, Math.max(1, maxIterations)),
    finalAnswer: null,
    status: 'running',
  };
}
