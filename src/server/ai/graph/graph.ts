// ─── Graph Execution Loop — Autonomous reasoning with bounded iterations ───

import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { GraphState, IterationRecord, createInitialState } from './state';
import { runReasoningNode, ReasoningResult } from './nodes/reasoningNode';
import { runToolNode } from './nodes/toolNode';
import { MemoryService } from '../../services/memory.service';
import { retrieveContext } from '../../services/rag.service';
import { generateAIResponse } from '../../services/ai.service';
import { Message, Verdict, SSEEvent } from '../../../shared/types';
import { Debate } from '../../config/mockDb';

// ─── SSE Helper (reuses existing event contract) ───
function sendSSE(res: Response, event: SSEEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

const generateShortId = () => "m" + Math.floor(1000 + Math.random() * 9000);

function iterationToMessage(
  iteration: number,
  reasoning: string,
  agentName: string,
  color: 'blue' | 'green' | 'amber',
  explicitSummary?: string
): Message {
  // Use explicit summary if provided, else extract a short summary
  const summary = explicitSummary || (() => {
    const firstSentence = reasoning.match(/^[^.!?]+[.!?]/);
    return firstSentence
      ? firstSentence[0].trim()
      : reasoning.substring(0, 120) + (reasoning.length > 120 ? '…' : '');
  })();

  return {
    id: generateShortId(),
    agent: agentName,
    color,
    summary,
    content: reasoning,
    round: iteration,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build a decision brief from the full reasoning transcript.
 */
async function generateDecisionBrief(idea: string, iterations: IterationRecord[]): Promise<Verdict> {
  const verdictPrompt = `You are a decision synthesis engine. You receive a full reasoning transcript and structured user constraints. Your job is NOT to summarize the debate. Your job is to produce a decision brief a user can act on immediately.

You will always output in this exact structure. No deviations.

---
DECISION BRIEF
──────────────────────────────

WHAT YOU'RE DECIDING
[One sentence. Reframe the user's input as a clear decision, not a question or vague idea.]

CORE ASSUMPTIONS
- [Assumption 1] → VALIDATED / UNVALIDATED
- [Assumption 2] → VALIDATED / UNVALIDATED
- [Assumption 3] → VALIDATED / UNVALIDATED

STRONGEST VERSION (STEELMAN)
[2–3 sentences. The best-case version of this idea assuming competent execution. Be specific.]

STRONGEST CASE AGAINST
[2–3 sentences. The most realistic failure scenario. Attack the steelman version, not a weak strawman.]

WHAT YOU'RE MISSING
[1–2 sentences. The single most important unknown or blind spot not addressed in the input or debate.]

RECOMMENDATION
[One of: PROCEED / PIVOT / STOP]
[One sentence explaining the condition: "Proceed if X. Pivot if Y. Stop if Z."]

NEXT 3 ACTIONS
1. [Specific action] → [Who does it] → [By when] → [What success looks like]
2. [Specific action] → [Who does it] → [By when] → [What success looks like]
3. [Specific action] → [Who does it] → [By when] → [What success looks like]

CONFIDENCE SCORE: [0–100]%
Basis: [One line explaining what drove this score — e.g. "Low due to unvalidated market assumption" or "High due to clear constraints and prior traction"]
---

RULES:
- Never produce generic actions like "do more research" or "talk to users" without specifics
- If constraints (goal, timeframe, resources) were provided, every action must respect them
- Confidence score must reflect actual reasoning quality, not optimism
- If the transcript contains conflicting views, the recommendation must acknowledge the strongest objection`;

  const transcript = iterations
    .map(i => `[Iteration ${i.iteration}] ${i.reasoning}${i.toolName ? `\n(Called Tool: ${i.toolName} with Result: ${i.toolResult?.substring(0, 300)}...)` : ''}`)
    .join('\n\n');

  try {
    const res = await generateAIResponse({
      systemPrompt: verdictPrompt,
      messages: [{ role: 'user', content: `Original Idea: "${idea}"\n\nFull Reasoning Trace:\n${transcript}` }],
      mode: 'deep',
    });

    const raw = res.content;
    
    // Simple regex-based extraction for the text structure
    const getSection = (name: string) => {
      const regex = new RegExp(`${name}\\s*[\\r\\n]+([\\s\\S]*?)(?=\\r?\\n[A-Z\\s]+|---|$|CONFIDENCE)`, 'i');
      const m = raw.match(regex);
      return m ? m[1].trim() : '';
    };

    const recActionMatch = raw.match(/RECOMMENDATION\s*[\r\n]+(PROCEED|PIVOT|STOP)/i);
    const recAction = (recActionMatch ? recActionMatch[1].toUpperCase() : 'PIVOT') as 'PROCEED' | 'PIVOT' | 'STOP';
    
    const confidenceMatch = raw.match(/CONFIDENCE SCORE:\s*(\d+)/i);
    const confidenceScore = confidenceMatch ? parseInt(confidenceMatch[1]) : 0;
    
    const basisMatch = raw.match(/Basis:\s*(.*)/i);
    const confidenceBasis = basisMatch ? basisMatch[1].trim() : 'N/A';

    const verdict: Verdict = {
      decision: getSection("WHAT YOU'RE DECIDING"),
      assumptions: getSection("CORE ASSUMPTIONS").split('\n').filter(l => l.includes('→')).map(l => ({
        text: l.replace(/^[-* ]+/, '').split('→')[0].trim(),
        status: l.includes('VALIDATED') && !l.includes('UNVALIDATED') ? 'VALIDATED' : 'UNVALIDATED'
      })),
      steelman: getSection("STRONGEST VERSION \\(STEELMAN\\)"),
      caseAgainst: getSection("STRONGEST CASE AGAINST"),
      missing: getSection("WHAT YOU'RE MISSING"),
      recommendation: {
        action: recAction,
        condition: getSection("RECOMMENDATION").split('\n').pop()?.trim() || ''
      },
      nextActions: getSection("NEXT 3 ACTIONS").split('\n').filter(l => l.includes('→')).map(l => {
        const parts = l.split('→').map(p => p.trim());
        return {
          action: parts[0]?.replace(/^\d+\.\s*/, '') || 'N/A',
          who: parts[1] || 'N/A',
          when: parts[2] || 'N/A',
          success: parts[3] || 'N/A'
        };
      }),
      confidence: {
        score: confidenceScore,
        basis: confidenceBasis
      },
      rawOutput: raw,
      agreed_statement: getSection("WHAT YOU'RE DECIDING")
    };

    return verdict;
  } catch (err) {
    console.error('[Graph] Verdict synthesis failed:', err);
    return {
      decision: 'Analysis completed but synthesis failed.',
      assumptions: [],
      steelman: 'N/A',
      caseAgainst: 'N/A',
      missing: 'Parsing error',
      recommendation: { action: 'STOP', condition: 'System error' },
      nextActions: [],
      confidence: { score: 0, basis: 'Synthesis failed' },
      agreed_statement: 'Synthesis failed.'
    };
  }
}



/**
 * Run the full graph-based reasoning loop.
 *
 * Flow:
 *   START → reasoningNode → shouldContinue? → toolNode (if needed) → LOOP or END
 *
 * Stop conditions:
 *   1. iteration >= maxIterations (hard cap)
 *   2. model outputs ACTION: FINAL_ANSWER
 *   3. unrecoverable error
 *
 * SSE events are mapped to the existing frontend contract:
 *   iteration_start → typing
 *   reasoning → message
 *   tool_called → logged internally (not sent to frontend)
 *   tool_result → logged internally (not sent to frontend)
 *   final_answer → verdict + message
 *   done → done
 */
export async function runGraphReasoning(
  res: Response,
  userId: string,
  debateId: string,
  idea: string,
  maxIterations: number = 3,
  followUp?: string
): Promise<void> {
  const state = createInitialState(idea, maxIterations);
  
  // Load full debate context from DB if it exists
  const debate = await Debate.findById(debateId);
  if (debate) {
    // Sync existing messages into graph state context
    state.messages = debate.messages.map((m: any) => ({
      role: m.role || (m.agent === 'You' ? 'user' : 'assistant'),
      content: `[${m.agent}]: ${m.summary}\n${m.content}`,
      name: m.agent,
      id: m.id // Preserve ID
    }));
  }

  // ─── Fetch Memory Context ───
  state.memory = await MemoryService.getMemoryContext(userId, idea);

  // ─── Fetch RAG Context ───
  const ragExcerpts = await retrieveContext(idea, 3);
  if (ragExcerpts.length > 0) {
    state.ragContext = `\n\n[DOCUMENT CONTEXT]\nThe user has uploaded a document. The following excerpts are relevant to their idea. Use this as grounding context for your reasoning.\n\n${ragExcerpts.join('\n---\n')}\n[END DOCUMENT CONTEXT]`;
  }

  if (followUp) {
    console.log(`[Graph] Processing follow-up: "${followUp}"`);
    state.messages.push({ role: 'user', content: `Follow-up question: ${followUp}` });
  }

  const agentName = 'ReasoningAgent';


  const agentColor: 'blue' | 'green' | 'amber' = 'blue';

  console.log(`[Graph] Starting reasoning loop for idea: "${idea}" (max ${state.maxIterations} iterations)`);

  // ─── Main Execution Loop ───
  while (state.status === 'running' && state.iteration < state.maxIterations) {
    const currentIteration = state.iteration + 1;

    // Emit: typing (maps from iteration_start)
    sendSSE(res, { type: 'typing', agent: agentName });

    // Add a minimum think time so the UI shows the typing indicator
    const minThinkTime = new Promise(resolve => setTimeout(resolve, 1500));

    let result: ReasoningResult;
    try {
      // ─── Reasoning Node ───
      const [reasoningResult] = await Promise.all([
        runReasoningNode(state),
        minThinkTime,
      ]);
      result = reasoningResult;
    } catch (err: any) {
      console.error(`[Graph] Reasoning node error at iteration ${currentIteration}:`, err.message);
      state.status = 'error';

      // Emit error as a message
      const errorMsg = iterationToMessage(
        currentIteration,
        `Reasoning error: ${err.message}`,
        agentName,
        agentColor
      );
      await Debate.findByIdAndUpdate(debateId, { $push: { messages: errorMsg } });
      sendSSE(res, { type: 'message', message: errorMsg });
      break;
    }

    console.log(`[Graph] Iteration ${currentIteration}: action=${result.action}`);

    // ─── Record iteration ───
    const record: IterationRecord = {
      iteration: currentIteration,
      reasoning: result.reasoning,
      summary: result.summary,
      action: result.action,
      toolName: result.toolName,
      toolArgs: result.toolArgs,
      timestamp: new Date().toISOString(),
    };

    // ─── Handle action ───
    if (result.action === 'tool_call' && result.toolName) {
      // Log tool call internally (not sent to frontend per user decision)
      console.log(`[Graph] Tool call: ${result.toolName}(${JSON.stringify(result.toolArgs)})`);

      // Emit the reasoning leading up to the tool call as a message
      if (result.reasoning) {
        const reasoningMsg = iterationToMessage(
          currentIteration,
          `🔧 Calling ${result.toolName}...\n\n${result.reasoning}`,
          agentName,
          agentColor,
          result.summary
        );
        record.id = reasoningMsg.id; // Store ID
        await Debate.findByIdAndUpdate(debateId, { $push: { messages: reasoningMsg } });
        sendSSE(res, { type: 'message', message: reasoningMsg });
      }

      // Execute tool
      const toolResult = await runToolNode(result.toolName, result.toolArgs, state);

      // Store tool result in state
      state.toolResults.push(toolResult.toolResult);
      record.toolResult = toolResult.result;

      console.log(`[Graph] Tool result (${toolResult.success ? 'success' : 'failed'}): ${toolResult.result.substring(0, 100)}...`);

    } else if (result.action === 'final_answer') {
      // ─── Final Answer — map to message + verdict ───
      const finalContent = result.answer || result.reasoning;

      const finalMsg = iterationToMessage(
        currentIteration,
        finalContent,
        agentName,
        agentColor,
        result.summary
      );
      record.id = finalMsg.id; // Store ID
      await Debate.findByIdAndUpdate(debateId, { $push: { messages: finalMsg } });
      sendSSE(res, { type: 'message', message: finalMsg });

      // Build and emit verdict
      const verdict = await generateDecisionBrief(idea, state.iterations);
      await Debate.findByIdAndUpdate(debateId, { verdict, status: 'done' });
      sendSSE(res, { type: 'verdict', verdict });

      state.finalAnswer = finalContent;
      state.status = 'done';
      state.iterations.push(record);
      state.iteration++;
      break;

    } else {
      // ─── Continue — emit reasoning as a message ───
      const msg = iterationToMessage(
        currentIteration,
        result.reasoning,
        agentName,
        agentColor,
        result.summary
      );
      await Debate.findByIdAndUpdate(debateId, { $push: { messages: msg } });
      sendSSE(res, { type: 'message', message: msg });
    }

    state.iterations.push(record);
    state.iteration++;
  }

  // ─── Force final answer if loop exhausted without one ───
  if (state.status === 'running') {
    console.log(`[Graph] Max iterations reached. Forcing final answer.`);

    // The last reasoning node call should have been forced to FINAL_ANSWER
    // but if parsing failed, synthesize one from accumulated reasoning
    const accumulatedReasoning = state.iterations
      .map(i => i.reasoning)
      .filter(r => r)
      .join('\n\n');

    const fallbackAnswer = accumulatedReasoning || `Analysis of "${idea}" completed after ${state.maxIterations} iterations.`;

    const finalMsg = iterationToMessage(
      state.iteration + 1,
      fallbackAnswer,
      agentName,
      agentColor
    );
    await Debate.findByIdAndUpdate(debateId, { $push: { messages: finalMsg } });
    sendSSE(res, { type: 'message', message: finalMsg });

    const verdict = await generateDecisionBrief(idea, state.iterations);
    await Debate.findByIdAndUpdate(debateId, { verdict, status: 'done' });
    sendSSE(res, { type: 'verdict', verdict });

    // ─── Post-Reasoning Memory Processing ───
    try {
      await MemoryService.storeEpisode(userId, idea, verdict);
      const transcript = state.iterations.map(i => `REASONING: ${i.reasoning}\nACTION: ${i.action}`).join('\n\n');
      await MemoryService.extractAndStoreFacts(userId, transcript);
    } catch (err) {
      console.error('Memory storage failed:', err);
    }

    state.status = 'done';
  }

  // Persist the reasoning trace
  const traceRecords = state.iterations.map(i => ({
    iteration: i.iteration,
    reasoning: i.reasoning,
    action: i.action,
    toolName: i.toolName || undefined,
    toolResult: i.toolResult || undefined,
    timestamp: new Date(i.timestamp),
  }));
  await Debate.findByIdAndUpdate(debateId, { $set: { reasoningTrace: traceRecords } });

  // ─── Done ───
  sendSSE(res, { type: 'done' });
  console.log(`[Graph] Reasoning complete. ${state.iterations.length} iterations, status: ${state.status}`);
}
