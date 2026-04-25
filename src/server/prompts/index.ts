import { BASE_SYSTEM_PROMPT } from './system_base_prompt';
import { GPT_PROMPT } from './model_gpt_prompt';
import { CLAUDE_PROMPT } from './model_claude_prompt';
import { GEMINI_PROMPT } from './model_gemini_prompt';
import { STRICT_OUTPUT_SCHEMA } from './output_schema_strict';

export function buildSystemPrompt(modelName: string): string {
  const lower = modelName.toLowerCase();
  
  let stylePrompt = '';
  if (lower.includes('gpt') || lower.includes('openai')) {
    stylePrompt = GPT_PROMPT;
  } else if (lower.includes('claude') || lower.includes('anthropic')) {
    stylePrompt = CLAUDE_PROMPT;
  } else if (lower.includes('gemini') || lower.includes('google')) {
    stylePrompt = GEMINI_PROMPT;
  } else {
    // Default to a balanced approach if model is unknown (e.g. Llama)
    stylePrompt = `
REASONING STYLE: LOGICAL (NEUTRAL)
Your reasoning should be objective, highly structured, and empirical.
Focus on dissecting arguments rigorously.
`;
  }

  return `${BASE_SYSTEM_PROMPT}

${stylePrompt}

${STRICT_OUTPUT_SCHEMA}
`;
}
