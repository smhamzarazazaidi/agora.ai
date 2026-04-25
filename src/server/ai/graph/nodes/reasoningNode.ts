// ─── Reasoning Node — Core LLM call that decides the next action ───

import { GraphState, IterationRecord } from '../state';
import { buildReasoningPrompt, buildToolContextMessage } from '../prompt';
import { generateAIResponse } from '../../../services/ai.service';

export interface ReasoningResult {
  action: 'continue' | 'tool_call' | 'final_answer';
  reasoning: string;
  toolName?: string;
  toolArgs?: any;
  summary?: string;
  answer?: string;
}

/**
 * Parse the LLM's structured output into a typed ReasoningResult.
 * Handles malformed output gracefully by falling back to CONTINUE or FINAL_ANSWER.
 */
function parseReasoningOutput(raw: string, isFinalIteration: boolean): ReasoningResult {
  const trimmed = raw.trim();

  // Try to extract ACTION line
  const actionMatch = trimmed.match(/ACTION:\s*(CONTINUE|TOOL_CALL|FINAL_ANSWER)/i);

  if (!actionMatch) {
    // Model didn't follow format — treat as final answer if last iteration, else continue
    if (isFinalIteration) {
      return {
        action: 'final_answer',
        reasoning: trimmed,
        summary: trimmed.substring(0, 120),
        answer: trimmed,
      };
    }
    return { action: 'continue', reasoning: trimmed };
  }

  const action = actionMatch[1].toUpperCase();

  if (action === 'CONTINUE') {
    const summaryMatch = trimmed.match(/SUMMARY:\s*([^\n]+)/i);
    const reasoningMatch = trimmed.match(/REASONING:\s*([\s\S]*)/i);
    return {
      action: 'continue',
      summary: summaryMatch ? summaryMatch[1].trim() : 'Analyzing...',
      reasoning: reasoningMatch ? reasoningMatch[1].trim() : trimmed,
    };
  }

  if (action === 'TOOL_CALL') {
    const toolMatch = trimmed.match(/TOOL:\s*(\S+)/i);
    const argsMatch = trimmed.match(/ARGS:\s*(\{[\s\S]*?\})/i);
    const summaryMatch = trimmed.match(/SUMMARY:\s*([^\n]+)/i);
    const reasoningMatch = trimmed.match(/REASONING:\s*([\s\S]*)/i);

    let toolArgs: any = {};
    if (argsMatch) {
      try {
        toolArgs = JSON.parse(argsMatch[1]);
      } catch {
        const queryMatch = argsMatch[1].match(/"query":\s*"([^"]+)"/);
        if (queryMatch) toolArgs = { query: queryMatch[1] };
      }
    }

    return {
      action: 'tool_call',
      summary: summaryMatch ? summaryMatch[1].trim() : 'Using tools...',
      reasoning: reasoningMatch ? reasoningMatch[1].trim() : '',
      toolName: toolMatch ? toolMatch[1].trim().toLowerCase() : 'unknown',
      toolArgs,
    };
  }

  // FINAL_ANSWER
  const summaryMatch = trimmed.match(/SUMMARY:\s*([^\n]+)/i);
  const answerMatch = trimmed.match(/ANSWER:\s*([\s\S]*)/i);
  const reasoningMatch = trimmed.match(/REASONING:\s*([\s\S]*?)(?:SUMMARY:|ANSWER:|$)/i);

  return {
    action: 'final_answer',
    reasoning: reasoningMatch ? reasoningMatch[1].trim() : '',
    summary: summaryMatch ? summaryMatch[1].trim() : 'Analysis complete.',
    answer: answerMatch ? answerMatch[1].trim() : trimmed,
  };
}


/**
 * Execute the reasoning node: call the LLM and determine the next action.
 * 
 * Token efficiency: Only the last 3 assistant messages are included in context,
 * plus the system prompt and any tool results.
 */
export async function runReasoningNode(state: GraphState): Promise<ReasoningResult> {
  const isFinalIteration = state.iteration + 1 >= state.maxIterations;

  // Build the system prompt for this iteration
  const systemPrompt = buildReasoningPrompt(
    state.idea,
    state.iteration + 1,
    state.maxIterations
  );

  // Build context messages — keep it trim for token efficiency
  const contextMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Add any initial/follow-up messages from state
  for (const m of state.messages) {
    if (m.role === 'user' || m.role === 'assistant') {
      contextMessages.push({ role: m.role, content: m.content });
    }
  }

  // Add tool context if any
  const toolContext = buildToolContextMessage(state.toolResults);
  if (toolContext) {
    contextMessages.push({ role: 'user', content: toolContext });
  }

  // Add only the last 3 reasoning iterations as assistant context
  const recentIterations = state.iterations.slice(-3);
  for (const iter of recentIterations) {
    contextMessages.push({
      role: 'assistant',
      content: `[Iteration ${iter.iteration}] ${iter.reasoning}\nACTION: ${iter.action}${iter.toolName ? ` (${iter.toolName})` : ''}`,
    });
  }

  // Build the conversation feed with IDs for the reply system
  const feedItems: string[] = [];
  for (const m of state.messages) {
    if (m.id) {
      feedItems.push(`${m.id} | ${m.name || 'User'}: ${m.content.substring(0, 100).replace(/\n/g, ' ')}...`);
    }
  }
  for (const iter of state.iterations) {
    if (iter.id) {
      feedItems.push(`${iter.id} | ReasoningAgent: ${iter.summary || iter.reasoning.substring(0, 100).replace(/\n/g, ' ')}...`);
    }
  }
  const conversationFeed = `[CONVERSATION FEED]\n${feedItems.join('\n')}\n[END FEED]`;

  const memory = state.memory;
  const memoryPrompt = memory ? `
[LONG-TERM FACTS ABOUT USER]
${memory.longTermFacts.length ? memory.longTermFacts.join('\n') : 'None yet.'}

[PAST RELEVANT EXPERIENCES]
${memory.relevantEpisodes.length ? memory.relevantEpisodes.map(e => `- ${e.idea}: ${e.decision}`).join('\n') : 'None yet.'}
` : '';

  // The current prompt
  contextMessages.push({
    role: 'user',
    content: `${memoryPrompt}\n\n${conversationFeed}\n\n${state.ragContext || ''}\n\nAnalyze this idea: "${state.idea}"\n\nThis is iteration ${state.iteration + 1} of ${state.maxIterations}. ${isFinalIteration ? 'You MUST provide your FINAL_ANSWER now.' : 'Decide your next action.'}`,
  });

  // Call the AI service with validation
  let result: ReasoningResult | null = null;
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    const aiResponse = await generateAIResponse({
      systemPrompt,
      messages: contextMessages,
      mode: 'deep',
    });

    result = parseReasoningOutput(aiResponse.content, isFinalIteration);
    
    // Simple validation: If it's a tool call, ensure we have tool name
    if (result.action === 'tool_call' && (!result.toolName || result.toolName === 'unknown')) {
      attempts++;
      contextMessages.push({ role: 'user', content: 'ERROR: You requested a tool call but did not specify a valid TOOL name. Please try again.' });
      continue;
    }

    break;
  }

  return result!;
}

