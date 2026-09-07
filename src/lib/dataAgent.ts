import { OPENAI_MODEL, createChatCompletion } from './openai';
import { fetchConsolidatedData } from './dataFetcher';
import { queryGlobalPinecone } from './pinecone';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw || !raw.trim()) return fallback;
  let clean = raw.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  }
  try {
    return JSON.parse(clean) as T;
  } catch {
    return fallback;
  }
}

export interface DataAgentResponse {
  answer: string;
  query_used?: string;
  data_retrieved?: any;
}

export async function askDataAgent(
  userQuery: string,
  schemaStr: string,
  projectUrl: string,
  serviceRoleKey: string
): Promise<DataAgentResponse> {
  const prompt = `You are a Data Engineering AI. 
The user is asking a question about their connected Supabase database.
Here is the schema of their database:

${schemaStr}

User Question: "${userQuery}"

Your task is to write the precise PostgREST API path and query parameters to retrieve the exact data needed to answer the question.
- Start the path with a slash, e.g., "/users?select=id,name&limit=10"
- Use PostgREST operators like eq, gt, lt, order, limit.
- You CANNOT use raw SQL. You MUST use PostgREST syntax.
- Only SELECT data. Do not mutate data.
- If you need to aggregate, use PostgREST aggregations or just select the required columns and limits.
- If you can answer the user's question directly from the schema provided above (e.g., "what tables exist?", "what are the columns in the users table?"), set "postgrest_path" to null and provide the answer in the "direct_answer" field.

Return ONLY a JSON object:
{
  "postgrest_path": "/tablename?select=..." | null,
  "direct_answer": "Your answer here if no query is needed, otherwise null",
  "explanation": "Briefly explain why you chose this query."
}`;

  let postgrestPath: string | null = '';
  let directAnswer: string | null = null;
  try {
    const res = await createChatCompletion({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const parsed = safeJsonParse<{ postgrest_path: string | null, direct_answer?: string | null }>(res.choices[0]?.message?.content, { postgrest_path: '' });
    postgrestPath = parsed.postgrest_path;
    directAnswer = parsed.direct_answer || null;
  } catch (err) {
    console.error('Error generating query:', err);
    return { answer: 'I encountered an error trying to understand your question.' };
  }

  if (directAnswer) {
    return { answer: directAnswer };
  }

  if (!postgrestPath) {
    return { answer: "I couldn't determine the correct tables to query for your request." };
  }

  if (postgrestPath.startsWith('/')) {
    postgrestPath = postgrestPath.substring(1);
  }

  let dataRetrieved = null;
  const baseUrl = projectUrl.trim().replace(/\/$/, '');
  
  try {
    const response = await fetch(`${baseUrl}/rest/v1/${postgrestPath}`, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      dataRetrieved = await response.json();
    } else {
      dataRetrieved = { error: `Database responded with status ${response.status}: ${response.statusText}` };
    }
  } catch (err: any) {
    dataRetrieved = { error: err.message };
  }

  const answerPrompt = `You are a Data Analysis AI.
The user asked: "${userQuery}"

You executed this query: ${postgrestPath}
The database returned the following JSON data:
${JSON.stringify(dataRetrieved).substring(0, 4000)}

Provide a helpful, conversational answer to the user's question based strictly on this data. 
Format your response using Markdown if you want to show a list or table.`;

  try {
    const res = await createChatCompletion({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: answerPrompt }],
      temperature: 0.3,
    });

    return {
      answer: res.choices[0]?.message?.content || 'Sorry, I could not format the final answer.',
      query_used: `GET /rest/v1/${postgrestPath}`,
      data_retrieved: dataRetrieved
    };
  } catch (err) {
    console.error('Error formatting answer:', err);
    return { answer: 'I fetched the data but encountered an error trying to summarize it.' };
  }
}

export async function askUniversalDataAgent(
  userQuery: string,
  connectorId: string,
  displayName: string,
  credentials: Record<string, any>,
  schemaStr?: string
): Promise<DataAgentResponse> {
  if (connectorId === 'supabase') {
    return askDataAgent(userQuery, schemaStr || '', credentials.project_url, credentials.service_role_key);
  }

  // Universal Logic for CSV, Paystack, Shopify, etc.
  let dataRetrieved = null;
  try {
    const res = await fetchConsolidatedData(connectorId, displayName, credentials);
    dataRetrieved = res.streams;
  } catch (err: any) {
    return { answer: `Failed to fetch data from ${displayName}: ${err.message}` };
  }

  const rawDataStr = JSON.stringify(dataRetrieved);
  const truncatedData = rawDataStr.substring(0, 30000);

  const prompt = `You are a Universal Data Analysis AI.
The user asked: "${userQuery}"

Here is the raw data pulled from their connected ${displayName} integration:
${truncatedData}
${rawDataStr.length > 30000 ? '\n(Data was truncated due to size limits)' : ''}

Analyze this data and provide a helpful, conversational answer.
If the data was truncated and you cannot fully answer the question (e.g. asking for a global sum), explicitly state that you are only analyzing the first 50 rows / recent records.
Format your response using Markdown if you want to show a list or table.`;

  try {
    const res = await createChatCompletion({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    return {
      answer: res.choices[0]?.message?.content || 'Sorry, I could not format the final answer.',
      query_used: `Universal Data Fetch: ${displayName}`,
      data_retrieved: dataRetrieved
    };
  } catch (err) {
    console.error('Error formatting answer:', err);
    return { answer: 'I fetched the data but encountered an error trying to summarize it.' };
  }
}

export async function askGlobalKnowledgeAgent(
  userId: string,
  userQuery: string,
  engagementsList: { id: string; client_name: string; business_question: string }[]
): Promise<DataAgentResponse> {
  let dataRetrieved = null;
  let contextStr = '';
  
  try {
    const rawContext = await queryGlobalPinecone(userId, userQuery, 15);
    contextStr = rawContext.join('\n\n');
    dataRetrieved = rawContext;
  } catch (err: any) {
    return { answer: `Failed to search your global knowledge base: ${err.message}` };
  }

  const engagementsInfo = engagementsList.map(e => `- [${e.id}] ${e.client_name}: ${e.business_question}`).join('\n');

  const prompt = `You are a Global Strategic AI Assistant.
The user is asking a question that spans across ALL their engagements.
You have access to a semantic search over their entire knowledge base.

Here are the user's active engagements for context:
${engagementsInfo}

Here is the retrieved context from their global knowledge base (which may span multiple engagements):
${contextStr}

User Question: "${userQuery}"

Synthesize a comprehensive answer based on the retrieved context. If possible, explicitly cite which engagement the insights are coming from. 
Format your response beautifully using Markdown.`;

  try {
    const res = await createChatCompletion({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    return {
      answer: res.choices[0]?.message?.content || 'Sorry, I could not format the final answer.',
      query_used: `Global Pinecone Semantic Search`,
      data_retrieved: dataRetrieved
    };
  } catch (err) {
    console.error('Error formatting global answer:', err);
    return { answer: 'I found the information but encountered an error trying to summarize it.' };
  }
}
