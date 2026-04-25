import { generateAIResponse } from './ai.service';
import { Memory } from '../config/mockDb';

export interface MemoryContext {
  shortTermSummary?: string;
  longTermFacts: string[];
  relevantEpisodes: any[];
}

/**
 * Memory Service handles short-term summarization, long-term fact extraction,
 * and episodic retrieval of past reasoning.
 */
export class MemoryService {
  
  /**
   * Summarize conversation context to prevent token overflow.
   */
  static async summarizeContext(messages: Array<{ role: string; content: string }>): Promise<string> {
    const transcript = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const prompt = `Summarize the following debate history into a concise 2-3 paragraph summary. 
    Focus on key arguments made, points of consensus, and unresolved tensions. 
    This summary will serve as the "memory" for the next round.
    
    TRANSCRIPT:
    ${transcript}`;

    const res = await generateAIResponse({
      systemPrompt: "You are a precise debate summarizer.",
      messages: [{ role: 'user', content: prompt }],
      mode: 'fast'
    });

    return res.content;
  }

  /**
   * Extract persistent facts from a finished debate transcript.
   */
  static async extractAndStoreFacts(userId: string, transcript: string): Promise<void> {
    const prompt = `Identify and extract key persistent facts about the user's situation, business, or goals from this transcript. 
    Ignore temporary debate points. Focus on things that will be true in the next session.
    Example: "User has 3 months runway", "Team size is 5", "Targeting enterprise clients".
    Return each fact as a simple sentence on a new line. If no new facts, return nothing.

    TRANSCRIPT:
    ${transcript}`;

    const res = await generateAIResponse({
      systemPrompt: "You are a fact extraction engine.",
      messages: [{ role: 'user', content: prompt }],
      mode: 'fast'
    });

    const facts = res.content.split('\n').map(f => f.trim()).filter(f => f.length > 10);
    for (const fact of facts) {
      await Memory.addFact(userId, fact);
    }
  }

  /**
   * Retrieve facts and relevant past episodes for a user.
   */
  static async getMemoryContext(userId: string, currentIdea: string): Promise<MemoryContext> {
    const facts = await Memory.getFacts(userId);
    const episodes = await Memory.getEpisodes(userId);

    // Simple keyword-based relevance for episodes
    const keywords = currentIdea.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const relevantEpisodes = episodes.filter(ep => {
      const title = (ep.decision || ep.idea || "").toLowerCase();
      return keywords.some(k => title.includes(k));
    }).slice(0, 2);

    return {
      longTermFacts: facts,
      relevantEpisodes
    };
  }

  /**
   * Save a finished debate as an episode.
   */
  static async storeEpisode(userId: string, idea: string, verdict: any): Promise<void> {
    await Memory.addEpisode(userId, { idea, decision: verdict.decision, action: verdict.recommendation.action });
  }
}
