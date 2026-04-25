import OpenAI from 'openai';
import dotenv from 'dotenv';
import { AIResponse } from '../../shared/types';
import { availableTools, handleToolCalls } from '../tools/executor';

dotenv.config();

// Auto-detect provider
const provider = (process.env.AI_PROVIDER || 'auto') as string;

// ─── OpenAI client (default) ───
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-to-prevent-crash',
});

export interface AIConfig {
  key: string;
  model: string;
  url: string;
  supportsTools: boolean;
}

export function getActiveModels(): AIConfig[] {
  const configs = [
    { key: process.env.GROQ_API_1, model: 'llama-3.3-70b-versatile', url: 'https://api.groq.com/openai/v1', supportsTools: true },
    { key: process.env.GROQ_API_1, model: 'llama-3.1-70b-versatile', url: 'https://api.groq.com/openai/v1', supportsTools: true },
    { key: process.env.GROQ_API_1, model: 'llama-3.1-8b-instant', url: 'https://api.groq.com/openai/v1', supportsTools: false },
    { key: process.env.OPENROUTER_1, model: 'google/gemma-2-9b-it:free', url: 'https://openrouter.ai/api/v1', supportsTools: false },
    { key: process.env.OPENROUTER_1, model: 'qwen/qwen-2.5-72b-instruct:free', url: 'https://openrouter.ai/api/v1', supportsTools: false },
    { key: process.env.GROQ_API_2 || process.env.GROQ_API_1, model: 'mixtral-8x7b-32768', url: 'https://api.groq.com/openai/v1', supportsTools: false },
  ].filter(c => c.key) as AIConfig[];

  // Return up to 4 models to try in rotation
  return configs.slice(0, 4);
}

export function formatModelName(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('llama-3') || lower.includes('llama3')) return 'Llama-3';
  if (lower.includes('llama')) return 'Llama';
  if (lower.includes('mixtral')) return 'Mixtral';
  if (lower.includes('mistral')) return 'Mistral';
  if (lower.includes('gemma')) return 'Gemma';
  if (lower.includes('qwen')) return 'Qwen';
  if (lower.includes('minimax')) return 'MiniMax';
  if (lower.includes('gpt')) return 'GPT';
  if (lower.includes('claude')) return 'Claude';
  if (lower.includes('gemini')) return 'Gemini';
  // For openrouter slugs like "meta-llama/llama-3-8b-instruct:free"
  const afterSlash = raw.split('/').pop() || raw;
  return afterSlash.split(':')[0].split('-').slice(0, 2).join('-');
}

export interface GenerateParams {
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  mode: 'fast' | 'deep';
  targetConfig?: AIConfig;
}

// ─── Unified AI call — routes by AI_PROVIDER env ───
export async function generateAIResponse(params: GenerateParams): Promise<AIResponse> {
  const { systemPrompt, messages, mode, targetConfig } = params;
  const maxTokens = mode === 'deep' ? 1000 : 500;

  if (targetConfig) {
    try {
      const client = new OpenAI({ baseURL: targetConfig.url, apiKey: targetConfig.key });
      const currentMessages = [{ role: 'system', content: systemPrompt }, ...messages] as any[];
      let response = await client.chat.completions.create({
        model: targetConfig.model,
        max_tokens: maxTokens,
        messages: currentMessages,
        ...(targetConfig.supportsTools && { tools: availableTools })
      });
      let responseMessage = response.choices[0]?.message;
      let iterations = 0;
      while (responseMessage?.tool_calls && iterations < 2) {
        currentMessages.push(responseMessage);
        responseMessage = await handleToolCalls(client, targetConfig.model, currentMessages, responseMessage.tool_calls, maxTokens);
        iterations++;
      }
      return { 
        content: responseMessage?.content || '',
        reasoning: (responseMessage as any)?.reasoning || (responseMessage as any)?.reasoning_content
      };
    } catch (err) {
      console.warn(`[Target Model] Failed using ${targetConfig.model}. Falling back to auto.`);
    }
  }

  if (provider === 'auto') {
    const configs = getActiveModels();
    let lastError: any;
    for (const config of configs) {
      try {
        const autoClient = new OpenAI({ baseURL: config.url, apiKey: config.key });
        const currentMessages = [{ role: 'system', content: systemPrompt }, ...messages] as any[];
        
        let response = await autoClient.chat.completions.create({
          model: config.model,
          max_tokens: maxTokens,
          messages: currentMessages,
          ...(config.supportsTools && { tools: availableTools })
        });

        let responseMessage = response.choices[0]?.message;

        // Execute tool calls if the AI requested them
        let iterations = 0;
        while (responseMessage?.tool_calls && iterations < 2) {
          currentMessages.push(responseMessage);
          responseMessage = await handleToolCalls(autoClient, config.model, currentMessages, responseMessage.tool_calls, maxTokens);
          iterations++;
        }

        return { 
        content: responseMessage?.content || '',
        reasoning: (responseMessage as any)?.reasoning || (responseMessage as any)?.reasoning_content
      };
      } catch (err) {
        lastError = err;
        console.warn(`[Auto Provider] Failed using model ${config.model}:`, (err as any).message);
        continue; // Try next configuration
      }
    }
    throw new Error(`All auto fallback providers failed. Last error: ${lastError?.message || 'Unknown'}`);
  }

  if (provider === 'openai') {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const response = await openaiClient.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    });
    return { 
      content: response.choices[0]?.message?.content || '',
      reasoning: (response.choices[0]?.message as any)?.reasoning
    };
  }

  if (provider === 'groq') {
    const model = process.env.GROQ_MODEL_1 || 'llama-3.3-70b-versatile';
    const groqClient = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_1,
    });
    const response = await groqClient.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    });
    return { 
      content: response.choices[0]?.message?.content || '',
      reasoning: (response.choices[0]?.message as any)?.reasoning
    };
  }

  if (provider === 'openrouter') {
    const model = process.env.OPENROUTER_MODEL_1 || 'google/gemma-2-9b-it:free';
    const openrouterClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_1,
    });
    const response = await openrouterClient.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    });
    return { 
      content: response.choices[0]?.message?.content || '',
      reasoning: (response.choices[0]?.message as any)?.reasoning
    };
  }

  if (provider === 'anthropic') {
    // Anthropic via fetch (no SDK required)
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
      }),
    });
    const data = await res.json() as { content: Array<{ text: string }> };
    return { content: data.content[0]?.text || '' };
  }

  if (provider === 'google') {
    // Google Gemini via fetch
    const geminiMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: geminiMessages,
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      }
    );
    const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
    return { content: data.candidates[0]?.content?.parts[0]?.text || '' };
  }

  throw new Error(`Unknown AI_PROVIDER: ${provider}`);
}
