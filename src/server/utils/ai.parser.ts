import { generateAIResponse, GenerateParams } from '../services/ai.service';
import { executeJavaScript } from '../tools/sandbox';

export interface ParsedAIResponse {
  summary: string;
  full_response: string;
  code_snippet?: string;
  code_output?: string;
  thoughtProcess?: string;
  raw: string;
}

/**
 * Step 2 — Hard Validation Rules
 */
export function isValid(output: string): boolean {
  // Relaxed: MODEL: is now optional for validation
  if (!output.includes("SUMMARY:")) return false;
  if (!output.includes("DETAIL:")) return false;
  if (!output.includes("CODE:")) return false;

  // Relaxed: Only reject obvious instructional placeholders or empty brackets
  // Allow single < or > which are common in math or markdown quotes
  if (output.includes("<Your") || output.includes("[Insert") || output.includes("<Enter")) return false;
  
  // Reject placeholder language often used by failing models
  if (output.includes("Argument from [") || output.includes("DETAIL: [")) return false;
  
  // Step 7 — Minimum quality check
  if (output.trim().length < 50) return false;

  return true;
}

export function extractStructuredText(raw: string, reasoningFromApi?: string): ParsedAIResponse {
  // Remove <think> blocks or use reasoning from API
  let thoughtProcess = reasoningFromApi || '';
  
  if (!thoughtProcess) {
    const thinkMatch = raw.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
      thoughtProcess = thinkMatch[1].trim();
      raw = raw.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
    }
  } else {
    // If we have reasoning from API, also strip any redundant <think> tags from content if present
    raw = raw.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
  }

  // Remove markdown wrapping the entire response if the model did it anyway
  raw = raw.replace(/^```(plaintext|markdown|json)?\n?/i, '');
  raw = raw.replace(/```$/i, '').trim();

  // Strip generic instructional leakages
  raw = raw.replace(/\[One to two sentences.*?\]/gi, '');
  raw = raw.replace(/\(Write exactly one to two sentences.*?\)/gi, '');
  raw = raw.replace(/\[Your full argument.*?\]/gi, '');
  raw = raw.replace(/\(Write your full argument here.*?\)/gi, '');
  raw = raw.replace(/\[Optional\. If including code.*?\]/gi, '');
  raw = raw.replace(/\(If including code, write valid.*?\)/gi, '');

  const summaryMatch = raw.match(/SUMMARY:\s*([\s\S]*?)DETAIL:/i);
  const detailMatch = raw.match(/DETAIL:\s*([\s\S]*?)(?:CODE:|$)/i);
  const codeMatch = raw.match(/CODE:\s*([\s\S]*)/i);

  if (!summaryMatch || !detailMatch) {
    // If it fails even after cleaning, try to treat the whole thing as detail
    return {
      summary: "Observation",
      full_response: raw,
      thoughtProcess,
      raw
    };
  }

  let summary = summaryMatch[1].trim();
  let full_response = detailMatch[1].trim();
  let code_snippet: string | undefined;
  let code_output: string | undefined;

  if (codeMatch && codeMatch[1].trim().length > 0) {
    let code = codeMatch[1].trim();
    // Remove trailing markdown ticks if the model wrapped the code inside the block
    code = code.replace(/^```(javascript|js)?\n?/i, '').replace(/```$/i, '').trim();
    
    if (code !== 'NONE' && code !== 'None' && code !== 'none' && !code.toLowerCase().includes('optional javascript code')) {
      code_snippet = code;
      try {
        const { output, error } = executeJavaScript(code_snippet);
        code_output = error ? `Error: ${error}` : output;
      } catch (err: any) {
        code_output = `Execution Failed: ${err.message}`;
      }
    }
  }

  if (!summary || !full_response) {
    throw new Error('ValidationFailed: SUMMARY or DETAIL section is empty after cleaning.');
  }

  return { summary, full_response, code_snippet, code_output, thoughtProcess, raw };
}

export async function generateValidatedAIResponse(params: GenerateParams, maxAttempts = 3): Promise<ParsedAIResponse> {
  let lastRaw = '';
  // Clone messages to avoid mutating the original array
  const activeMessages = [...params.messages];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const aiRes = await generateAIResponse({ ...params, messages: activeMessages });
      lastRaw = aiRes.content;

      // Step 2 & 3 — Validate and Retry
      if (isValid(lastRaw)) {
        return extractStructuredText(lastRaw, aiRes.reasoning);
      } else {
        console.warn(`[Validation] Attempt ${attempt} failed validation for ${params.targetConfig?.model || 'unknown model'}.`);
        console.debug(`[Validation Failure Content]:\n${lastRaw.substring(0, 500)}...`);
      }
    } catch (err: any) {
      console.warn(`[Validation] Attempt ${attempt} encountered error: ${err.message}`);
    }

    // Provide a firm hint to the model on the retry
    if (attempt < maxAttempts) {
      activeMessages.push({
        role: 'user',
        content: 'SYSTEM WARNING: Your response was INVALID. It must use EXACT tags: MODEL:, SUMMARY:, DETAIL:, CODE:. No instructional placeholders. Reference other agents. Minimum 50 chars. Try again.'
      });
    }
  }
  
  // Step 4 — Fallback System (CRITICAL)
  console.error('[Validation] All attempts failed. Generating hard fallback.');
  
  const modelNameMatch = lastRaw.match(/MODEL:\s*([^\n]+)/);
  const modelName = modelNameMatch ? modelNameMatch[1].trim() : 'AI Agent';

  const fallbackRaw = `SUMMARY:
Observation (Stabilized)

DETAIL:
${lastRaw || 'The agent was unable to produce a structured response within the required constraints. Falling back to internal reasoning trace.'}

CODE:
NONE`;

  return extractStructuredText(fallbackRaw);
}
