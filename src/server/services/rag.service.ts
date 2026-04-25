// Use dynamic require to avoid crashing Vercel Serverless if pdf-parse fails
let pdf: any;
try {
  pdf = require('pdf-parse');
  if (pdf.default) pdf = pdf.default;
} catch {
  console.warn('pdf-parse failed to load, PDF extraction will be disabled');
  pdf = async () => ({ text: '' });
}

interface VectorEntry {
  text: string;
  embedding: number[];
}

const vectorStore: VectorEntry[] = [];
const COHERE_API_KEY = process.env.COHERE_API_KEY;

/**
 * Split text into chunks with overlap
 */
function chunkText(text: string, size: number = 500, overlap: number = 50): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start += (size - overlap);
  }
  return chunks;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Call Cohere Embedding API
 */
async function getEmbeddings(texts: string[], inputType: 'search_document' | 'search_query'): Promise<number[][]> {
  if (!COHERE_API_KEY) {
    console.error('COHERE_API_KEY is missing');
    return [];
  }

  const response = await fetch('https://api.cohere.com/v2/embed', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${COHERE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'embed-v4.0',
      texts,
      input_type: inputType,
      embedding_types: ['float'],
      output_dimension: 1024
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cohere API error: ${err}`);
  }

  const data = await response.json() as any;
  return data.embeddings.float;
}

export async function ingestFile(buffer: Buffer, mimetype: string): Promise<number> {
  let text = '';
  if (mimetype === 'application/pdf') {
    const data = await pdf(buffer);
    text = data.text;
  } else {
    text = buffer.toString('utf-8');
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) return 0;

  // Cohere has a limit on texts per request (usually 96), but for hackathon we'll just send all
  // if it's not massive.
  const embeddings = await getEmbeddings(chunks, 'search_document');

  for (let i = 0; i < chunks.length; i++) {
    vectorStore.push({
      text: chunks[i],
      embedding: embeddings[i]
    });
  }

  console.log(`[RAG] Ingested ${chunks.length} chunks into memory store.`);
  return chunks.length;
}

export async function retrieveContext(query: string, topK: number = 3): Promise<string[]> {
  if (vectorStore.length === 0) return [];

  const [queryEmbedding] = await getEmbeddings([query], 'search_query');
  
  const scored = vectorStore.map(entry => ({
    text: entry.text,
    score: cosineSimilarity(queryEmbedding, entry.embedding)
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(s => s.text);
}
