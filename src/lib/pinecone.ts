import OpenAI from 'openai';

const PINECONE_API_KEY = import.meta.env.VITE_PINECONE_API_KEY;
const PINECONE_HOST = import.meta.env.VITE_PINECONE_HOST; // e.g. https://seagreen-knowledge-yyrwmzo.svc.aped-4627-b74a.pinecone.io
const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY, dangerouslyAllowBrowser: true });

import { supabase } from './supabase';

// Basic chunking by paragraphs/newlines (roughly ~500 tokens max)
function chunkText(text: string, maxTokens = 500): string[] {
  const maxChars = maxTokens * 4;
  const chunks: string[] = [];
  
  // Split by single newlines instead of double to handle dense data (JSON/CSV) better
  const lines = text.split('\n');
  let currentChunk = '';
  
  for (const line of lines) {
    if (currentChunk.length + line.length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // If a single line is STILL bigger than maxChars (e.g. huge JSON object), forcefully slice it
      if (line.length > maxChars) {
        for (let i = 0; i < line.length; i += maxChars) {
          chunks.push(line.slice(i, i + maxChars).trim());
        }
      } else {
        currentChunk = line;
      }
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  
  return chunks.filter(c => c.length > 0);
}

export async function indexDataToPinecone(engagementId: string, dataItems: any[]) {
  if (!PINECONE_API_KEY || !PINECONE_HOST) {
    throw new Error("Pinecone API key or Host is missing in environment variables.");
  }

  // Retrieve owner_id for namespace mapping
  const { data: engData } = await supabase.from('engagements').select('owner_id').eq('id', engagementId).single();
  const userId = engData?.owner_id;
  if (!userId) {
    throw new Error("Cannot index to Pinecone: Could not find owner_id for engagement " + engagementId);
  }
  
  console.log(`Vectorizing ${dataItems.length} sources for engagement ${engagementId} into namespace ${userId}`);
  
  for (const item of dataItems) {
    let textContent = '';
    if (item.source && item.data && Array.isArray(item.data)) {
      textContent = `Source: ${item.source}\n` + item.data.map((row: any) => JSON.stringify(row)).join('\n');
    } else {
      textContent = JSON.stringify(item);
    }

    const chunks = chunkText(textContent, 800);
    
    // Process in batches
    for (let i = 0; i < chunks.length; i += 20) {
      const batchChunks = chunks.slice(i, i + 20);
      
      const embeddings = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batchChunks
      });
      
      const vectors = embeddings.data.map((emb, idx) => ({
        id: `eng_${engagementId}_${Math.random().toString(36).substring(7)}_chunk_${i + idx}`,
        values: emb.embedding,
        metadata: {
          engagementId, // CRITICAL: Saved as metadata for filtering
          source: item.source || item.type || 'unknown',
          content: batchChunks[idx]
        }
      }));
      
      // Upsert using raw Pinecone REST API
      const res = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
        method: 'POST',
        headers: {
          'Api-Key': PINECONE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vectors: vectors,
          namespace: userId
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Pinecone Upsert failed: ${res.status} ${errText}`);
      }
    }
  }
}

export async function queryPinecone(engagementId: string, query: string, topK = 5): Promise<string[]> {
  if (!PINECONE_API_KEY || !PINECONE_HOST) return [];

  // Retrieve owner_id for namespace mapping
  const { data: engData } = await supabase.from('engagements').select('owner_id').eq('id', engagementId).single();
  const userId = engData?.owner_id;
  if (!userId) return [];
  
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query
  });
  
  const res = await fetch(`${PINECONE_HOST}/query`, {
    method: 'POST',
    headers: {
      'Api-Key': PINECONE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      namespace: userId,
      vector: embedding.data[0].embedding,
      topK,
      includeMetadata: true,
      filter: {
        engagementId: { "$eq": engagementId }
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Pinecone Query failed: ${res.status} ${errText}`);
    return [];
  }

  const data = await res.json();
  if (!data.matches) return [];
  
  return data.matches.map((m: any) => m.metadata?.content || '');
}

export async function queryGlobalPinecone(userId: string, query: string, topK = 10): Promise<string[]> {
  if (!PINECONE_API_KEY || !PINECONE_HOST) return [];

  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query
  });
  
  const res = await fetch(`${PINECONE_HOST}/query`, {
    method: 'POST',
    headers: {
      'Api-Key': PINECONE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      namespace: userId,
      vector: embedding.data[0].embedding,
      topK,
      includeMetadata: true
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Pinecone Global Query failed: ${res.status} ${errText}`);
    return [];
  }

  const data = await res.json();
  if (!data.matches) return [];
  
  // Prepend the engagement ID so the AI knows which engagement this content came from
  return data.matches.map((m: any) => `[Engagement ID: ${m.metadata?.engagementId || 'unknown'}]\n${m.metadata?.content || ''}`);
}
