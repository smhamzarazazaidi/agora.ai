import OpenAI from 'openai';
import { searchWeb, tavilyToolSchema } from './tavily';

export const availableTools = [tavilyToolSchema];

export async function handleToolCalls(
  client: OpenAI, 
  model: string, 
  messages: any[], 
  toolCalls: any[], 
  maxTokens: number
) {
  // Execute all tools requested by the AI
  for (const toolCall of toolCalls) {
    if (toolCall.function.name === 'search_web') {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`[ToolManager] AI requested search: "${args.query}"`);
        const result = await searchWeb(args.query);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: result
        });
        console.log(`[ToolManager] Search completed. Resubmitting to AI...`);
      } catch (err) {
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: "Error parsing tool arguments."
        });
      }
    }
  }

  // Call the AI again with the tool results appended
  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages,
    tools: availableTools,
  });

  return response.choices[0]?.message;
}
