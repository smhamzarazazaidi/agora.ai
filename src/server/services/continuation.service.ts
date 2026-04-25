import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getActiveModels, formatModelName } from './ai.service';
import { generateValidatedAIResponse, ParsedAIResponse } from '../utils/ai.parser';
import { executeJavaScript } from '../tools/sandbox';
import { Message, SSEEvent, ContinuationIntensity } from '../../shared/types';
import { Debate } from '../config/mockDb';

import { buildSystemPrompt } from '../prompts';

function sendSSE(res: Response, event: SSEEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export async function runContinuation(
  res: Response,
  debateId: string,
  followUp: string,
  intensity: ContinuationIntensity
) {
  // Load full debate context from DB
  const debate = await Debate.findById(debateId);
  if (!debate) throw new Error('Debate not found');

  const activeConfigs = getActiveModels();
  if (activeConfigs.length === 0) throw new Error('No AI models configured');

  const m1 = activeConfigs[0];
  const m2 = activeConfigs[1] || activeConfigs[0];
  const m3 = activeConfigs[2] || activeConfigs[0];

  const ALL_AGENTS = [
    { name: formatModelName(m1.model), color: 'blue' as const, config: m1 },
    { name: formatModelName(m2.model), color: 'green' as const, config: m2 },
    { name: formatModelName(m3.model), color: 'amber' as const, config: m3 },
  ];

  // Pick agents based on intensity
  const agentsToRun =
    intensity === 'low' ? [ALL_AGENTS[0]] :
    intensity === 'medium' ? [ALL_AGENTS[0], ALL_AGENTS[1]] :
    ALL_AGENTS;

  // Reconstruct debate history for context
  const verdictCtx = debate.verdict
    ? `\n\n[CONSENSUS CONCLUSION reached]: "${(debate.verdict as any).agreed_statement}"`
    : '';

  const contextMessages = [
    {
      role: 'user' as const,
      content: `Debate topic: "${debate.idea}". Below is the debate transcript.`
    },
    ...debate.messages.map((m: any) => ({
      role: 'assistant' as const,
      content: `[${m.agent}]: ${m.summary}\n${m.content}`
    })),
    {
      role: 'user' as const,
      content: `${verdictCtx}\n\nUser follow-up question: "${followUp}"\n\nPlease respond to this follow-up, referencing the prior debate and conclusion. Use STRICT_OUTPUT_SCHEMA.`
    }
  ];

  // Track which round we're on (use max round + 1 for continuation numbering)
  const maxRound = debate.messages.reduce((max: number, m: any) => Math.max(max, m.round || 0), 0);
  const continuationRound = maxRound + 1;

  // Persist User Message to DB
  const userMessage: Message = {
    id: uuidv4(),
    agent: 'You',
    role: 'user',
    color: 'purple',
    summary: followUp,
    content: '',
    round: continuationRound,
    createdAt: new Date().toISOString(),
  };
  await Debate.findByIdAndUpdate(debateId, { $push: { messages: userMessage } });

  for (const agent of agentsToRun) {
    sendSSE(res, { type: 'typing', agent: agent.name });

    const minThinkTime = new Promise(resolve => setTimeout(resolve, 2500));
    const systemPrompt = buildSystemPrompt(agent.name);

    const aiPromise = generateValidatedAIResponse({
      systemPrompt,
      messages: contextMessages,
      mode: 'deep',
      targetConfig: agent.config
    });

    const [parsed] = await Promise.all([
      aiPromise,
      minThinkTime
    ]);

    let full_response = parsed.full_response;
    if (parsed.thoughtProcess) {
      full_response = `*Thought Process:*\n${parsed.thoughtProcess}\n\n*Response:*\n${full_response}`;
    }

    const message: Message = {
      id: uuidv4(),
      agent: agent.name,
      color: agent.color,
      summary: parsed.summary,
      content: full_response,
      ...(parsed.code_snippet && { code_snippet: parsed.code_snippet, code_output: parsed.code_output }),
      round: continuationRound,
      createdAt: new Date().toISOString(),
    };

    // Persist to DB
    await Debate.findByIdAndUpdate(debateId, { $push: { messages: message } });

    sendSSE(res, { type: 'continuation_message', message });

    // Append to context for next agent in this loop
    contextMessages.push({
      role: 'assistant',
      content: `[${agent.name}]: ${parsed.summary}\n${full_response}`
    });
  }

  sendSSE(res, { type: 'done' });
}
