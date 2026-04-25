import dotenv from 'dotenv';
dotenv.config();

export async function searchWeb(query: string): Promise<string> {
  const apiKey = process.env.TRAVILY_API_KEY || process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("Tavily API key is missing. Skipping search.");
    return "Error: Search unavailable due to missing API key.";
  }

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: 3
      })
    });
    
    if (!res.ok) {
      const err = await res.text();
      console.error("Tavily error:", err);
      return "Error: Could not search the web.";
    }

    const data = await res.json() as any;
    if (!data.results || data.results.length === 0) {
      return "No results found.";
    }

    return data.results.map((r: any) => `Source: ${r.url}\nTitle: ${r.title}\nContent: ${r.content}`).join('\n\n');
  } catch (err: any) {
    console.error("Tavily fetch error:", err);
    return `Error: ${err.message}`;
  }
}

export const tavilyToolSchema = {
  type: "function" as const,
  function: {
    name: "search_web",
    description: "Search the internet for real-time information, news, or facts to support your debate arguments. Use this when you need accurate, up-to-date data. You MUST specify a highly specific query.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The highly specific search query"
        }
      },
      required: ["query"]
    }
  }
};
