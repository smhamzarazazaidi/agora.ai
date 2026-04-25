import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generateAIResponse, getActiveModels, formatModelName } from './ai.service';
import { generateValidatedAIResponse, ParsedAIResponse } from '../utils/ai.parser';
import { executeJavaScript } from '../tools/sandbox';
import { Agent, Message, Verdict, SSEEvent } from '../../shared/types';
import { Debate } from '../config/mockDb';

import { buildSystemPrompt } from '../prompts';
import { MemoryService } from './memory.service';
import { retrieveContext } from './rag.service';

// ─── SSE helper ───
function sendSSE(res: Response, event: SSEEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// ─── Main debate orchestration ───
export async function runDebate(
  res: Response,
  userId: string,
  debateId: string,
  idea: string,
  rounds: number,
  mode: 'fast' | 'deep'
) {
  const activeConfigs = getActiveModels();
  if (activeConfigs.length === 0) {
    throw new Error('No AI models configured in environment variables.');
  }

  // Fallback to same model if less than 3 available
  const m1 = activeConfigs[0];
  const m2 = activeConfigs[1] || activeConfigs[0];
  const m3 = activeConfigs[2] || activeConfigs[0];

  const AGENTS: (Agent & { config: any })[] = [
    { name: formatModelName(m1.model), color: 'blue', config: m1 },
    { name: formatModelName(m2.model), color: 'green', config: m2 },
    { name: formatModelName(m3.model), color: 'amber', config: m3 },
  ];

  const history: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: `The debate topic is: "${idea}"` },
  ];
  
  // ─── Fetch Memory Context ───
  const memory = await MemoryService.getMemoryContext(userId, idea);
  const memoryPrompt = `
[LONG-TERM FACTS ABOUT USER]
${memory.longTermFacts.length ? memory.longTermFacts.join('\n') : 'None yet.'}

[PAST RELEVANT EXPERIENCES]
${memory.relevantEpisodes.length ? memory.relevantEpisodes.map(e => `- ${e.idea}: ${e.decision}`).join('\n') : 'None yet.'}
`;

  let currentSummary = "";
  
  // ─── Fetch RAG Context ───
  const ragExcerpts = await retrieveContext(idea, 3);
  const ragPrompt = ragExcerpts.length > 0 
    ? `\n\n[DOCUMENT CONTEXT]\nThe user has uploaded a document. The following excerpts are relevant to their idea. Use this as grounding context for your reasoning.\n\n${ragExcerpts.join('\n---\n')}\n[END DOCUMENT CONTEXT]`
    : '';

  const feedWithIds: string[] = [];
  const generateShortId = () => "m" + Math.floor(1000 + Math.random() * 9000);

  for (let r = 1; r <= rounds; r++) {
    for (let i = 0; i < AGENTS.length; i++) {
      const agent = AGENTS[i];
      const other1 = AGENTS[(i + 1) % 3].name;
      const other2 = AGENTS[(i + 2) % 3].name;

      sendSSE(res, { type: 'typing', agent: agent.name });

      const minThinkTime = new Promise(resolve => setTimeout(resolve, 2500));
      const systemPrompt = buildSystemPrompt(agent.name);
      const conversationFeed = `[CONVERSATION FEED]\n${feedWithIds.join('\n')}\n[END FEED]`;
      
      // Short-term memory: Summarize if history is getting long
      if (r > 2 && history.length > 5 && !currentSummary) {
        currentSummary = await MemoryService.summarizeContext(history);
      }

      const aiPromise = generateValidatedAIResponse({
        systemPrompt: `${systemPrompt}\n\n${memoryPrompt}\n${currentSummary ? `[CONTEXT SUMMARY]:\n${currentSummary}` : ''}${r === 1 && i === 0 ? ragPrompt : ''}`,
        messages: [
          ...(currentSummary ? [] : history), // If we have a summary, we can trim the old history to save tokens
          { role: 'user', content: `${conversationFeed}\n\nRound ${r}: Respond to the debate so far. Topic: "${idea}"\nRemember to explicitly respond to ${other1} and ${other2}. Follow the STRICT_OUTPUT_SCHEMA.` },
        ],
        mode,
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

      const mId = generateShortId();
      const message: Message = {
        id: mId,
        agent: agent.name,
        color: agent.color,
        summary: parsed.summary,
        content: full_response,
        ...(parsed.code_snippet && { code_snippet: parsed.code_snippet, code_output: parsed.code_output }),
        round: r,
        createdAt: new Date().toISOString(),
      };

      feedWithIds.push(`${mId} | ${agent.name}: ${parsed.summary.substring(0, 100)}...`);

      let historyContent = `[${agent.name}]: ${parsed.summary}\n${full_response}`;
      if (parsed.code_snippet) {
        historyContent += `\n\n[EXECUTED CODE]:\n${parsed.code_snippet}\n[OUTPUT]:\n${parsed.code_output}`;
      }

      history.push({ role: 'assistant', content: historyContent });
      await Debate.findByIdAndUpdate(debateId, { $push: { messages: message } });

      sendSSE(res, { type: 'message', message });
    }
  }

  // ─── Generate Decision Brief (Consensus Conclusion) ───
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


  const debateSummary = history
    .filter(m => m.role === 'assistant')
    .map(m => m.content)
    .join('\n\n');

  // Emit synthesis start
  res.write(`data: ${JSON.stringify({ type: 'typing', agent: 'System (Synthesizer)' })}\n\n`);

  // Truncate transcript if too long (approx 20k chars)
  let finalTranscript = debateSummary;
  if (finalTranscript.length > 20000) {
    console.warn(`[Debate] Transcript too long (${finalTranscript.length}). Truncating for synthesis.`);
    finalTranscript = finalTranscript.substring(0, 5000) + "\n\n... [TRUNCATED] ...\n\n" + finalTranscript.slice(-15000);
  }

  const verdictRes = await generateAIResponse({
    systemPrompt: verdictPrompt,
    messages: [{ role: 'user', content: `Debate topic: "${idea}"\n\nFull Debate Transcript:\n${finalTranscript}` }],
    mode: 'deep',
  });

  let verdict: Verdict;
  try {
    const raw = verdictRes.content;
    const getSection = (name: string) => {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`${escapedName}\\s*[\\r\\n]+([\\s\\S]*?)(?=\\r?\\n[A-Z\\s]{3,}|---|$|CONFIDENCE SCORE:)`, 'i');
      const m = raw.match(regex);
      return m ? m[1].trim() : '';
    };

    const recActionMatch = raw.match(/RECOMMENDATION\s*[\r\n]+(PROCEED|PIVOT|STOP)/i);
    const recAction = (recActionMatch ? recActionMatch[1].toUpperCase() : 'PIVOT') as 'PROCEED' | 'PIVOT' | 'STOP';
    
    const confidenceMatch = raw.match(/CONFIDENCE SCORE:\s*(\d+)/i);
    const confidenceScore = confidenceMatch ? parseInt(confidenceMatch[1]) : 0;
    
    const basisMatch = raw.match(/Basis:\s*(.*)/i);
    const confidenceBasis = basisMatch ? basisMatch[1].trim() : 'N/A';

    verdict = {
      decision: getSection("WHAT YOU'RE DECIDING"),
      assumptions: getSection("CORE ASSUMPTIONS").split('\n').filter(l => l.includes('→')).map(l => ({
        text: l.replace(/^[-* ]+/, '').split('→')[0].trim(),
        status: l.includes('VALIDATED') && !l.includes('UNVALIDATED') ? 'VALIDATED' : 'UNVALIDATED'
      })),
      steelman: getSection("STRONGEST VERSION (STEELMAN)"),
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
      confirmed_by: getSection("CONFIRMED BY").split(',').map(s => s.trim()).filter(Boolean),
      minority_note: getSection("MINORITY NOTE"),
      agreed_statement: getSection("WHAT YOU'RE DECIDING")
    };
  } catch (err) {
    console.error('Verdict parsing failed:', err);
    verdict = {
      decision: 'Analysis failed to synthesize.',
      assumptions: [],
      steelman: 'N/A',
      caseAgainst: 'N/A',
      missing: 'Parsing error',
      recommendation: { action: 'STOP', condition: 'System error' },
      nextActions: [],
      confidence: { score: 0, basis: 'Parsing failure' },
      confirmed_by: [],
      agreed_statement: 'Synthesis failed.'
    };
  }

  // ─── Post-Debate Memory Processing ───
  try {
    await MemoryService.storeEpisode(userId, idea, verdict);
    await MemoryService.extractAndStoreFacts(userId, debateSummary);
  } catch (err) {
    console.error('Memory storage failed:', err);
  }


  await Debate.findByIdAndUpdate(debateId, { verdict, status: 'done' });
  sendSSE(res, { type: 'verdict', verdict });
  sendSSE(res, { type: 'done' });
}
