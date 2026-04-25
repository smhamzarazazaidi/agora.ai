// ─── Tool Node — Executes requested tools and returns results ───

import { GraphState, ToolResult } from '../state';
import { searchWeb } from '../../../tools/tavily';
import { executeJavaScript } from '../../../tools/sandbox';

export interface ToolExecutionResult {
  success: boolean;
  result: string;
  toolResult: ToolResult;
}

/**
 * Execute a tool by name and return the result.
 * Supports: web_search, run_code.
 * Unknown tools return a descriptive error.
 */
export async function runToolNode(
  toolName: string,
  toolArgs: any,
  state: GraphState
): Promise<ToolExecutionResult> {
  const timestamp = new Date().toISOString();

  if (toolName === 'web_search' || toolName === 'search_web') {
    const query = toolArgs?.query || toolArgs?.q || String(toolArgs);
    console.log(`[ToolNode] Executing web_search: "${query}"`);

    try {
      const result = await searchWeb(query);
      const toolResult: ToolResult = {
        tool: 'web_search',
        query,
        result,
        timestamp,
      };
      return { success: true, result, toolResult };
    } catch (err: any) {
      const errorMsg = `Search failed: ${err.message}`;
      return {
        success: false,
        result: errorMsg,
        toolResult: { tool: 'web_search', query, result: errorMsg, timestamp },
      };
    }
  }

  if (toolName === 'run_code' || toolName === 'execute_code') {
    const code = toolArgs?.code || String(toolArgs);
    console.log(`[ToolNode] Executing run_code (${code.length} chars)`);

    try {
      const { output, error } = executeJavaScript(code);
      const result = error ? `Error: ${error}\nOutput: ${output}` : output;
      const toolResult: ToolResult = {
        tool: 'run_code',
        query: code.substring(0, 100) + (code.length > 100 ? '...' : ''),
        result,
        timestamp,
      };
      return { success: !error, result, toolResult };
    } catch (err: any) {
      const errorMsg = `Code execution failed: ${err.message}`;
      return {
        success: false,
        result: errorMsg,
        toolResult: { tool: 'run_code', query: code.substring(0, 100), result: errorMsg, timestamp },
      };
    }
  }

  // Unknown tool
  const errorMsg = `Unknown tool: "${toolName}". Available tools: web_search, run_code.`;
  console.warn(`[ToolNode] ${errorMsg}`);
  return {
    success: false,
    result: errorMsg,
    toolResult: { tool: toolName, query: JSON.stringify(toolArgs), result: errorMsg, timestamp },
  };
}
