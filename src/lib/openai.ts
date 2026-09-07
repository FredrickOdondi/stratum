import OpenAI from 'openai';
import type {
  Engagement,
  IssueNode,
  Finding,
  Claim,
  DeliverableDocument,
  QualityFlag,
} from '../types';

import { queryPinecone } from './pinecone';

export const OPENAI_MODEL = (import.meta.env.VITE_OPENAI_MODEL as string) || 'gpt-5';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY as string,
  dangerouslyAllowBrowser: true,
});

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw || !raw.trim()) {
    return fallback;
  }
  let clean = raw.trim();
  // Strip Markdown code blocks if present
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  }
  try {
    return JSON.parse(clean) as T;
  } catch (err) {
    console.warn('JSON parse fallback triggered. Raw content was:', raw, err);
    return fallback;
  }
}

export async function createChatCompletion(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
) {
  const modelName = params.model.toLowerCase();
  const isGpt5OrReasoning =
    modelName.startsWith('gpt-5') ||
    modelName.startsWith('o1') ||
    modelName.startsWith('o3') ||
    modelName.startsWith('gpt-6');

  // Clone parameters
  const normalized: Record<string, unknown> = { ...params };

  if (isGpt5OrReasoning) {
    // GPT-5 / reasoning models do not allow custom temperature
    delete normalized.temperature;

    // Reasoning tokens consume budget from max_completion_tokens.
    // If a smaller max_tokens is provided (e.g. 4000), reasoning tokens starve the output content.
    // Ensure at least 16,000 completion tokens so reasoning + JSON both fit.
    if (normalized.max_tokens) {
      const requested = typeof normalized.max_tokens === 'number' ? normalized.max_tokens : 4000;
      normalized.max_completion_tokens = Math.max(requested, 16000);
      delete normalized.max_tokens;
    }
  }

  try {
    const res = await openai.chat.completions.create(
      normalized as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
    );

    const finishReason = res.choices[0]?.finish_reason;
    const content = res.choices[0]?.message?.content;

    if (finishReason === 'length' && (!content || content.trim() === '')) {
      throw new Error(
        'OpenAI model exhausted completion tokens during reasoning. Increase max_completion_tokens.'
      );
    }

    return res;
  } catch (err: unknown) {
    console.error('OpenAI call error:', err);
    throw err;
  }
}

// ─── Scoping Agent ────────────────────────────────────────────────────────────
export async function runScoping(
  intake: Record<string, string>,
  documentContext = '',
  connectedAppData = ''
): Promise<{ problem_statement: string; draft_nodes: Partial<IssueNode>[] }> {
  const prompt = `You are an Engagement Lead at a top-tier strategy consulting firm.
Given the following client intake information, uploaded documentation context, and connected data samples, produce:
1. A crisp, structured Problem Statement (3-5 sentences) that scopes the engagement.
2. A first-pass MECE Issue Tree with 3-6 top-level branches and 2-4 sub-branches each.

Intake:
${Object.entries(intake).map(([k, v]) => `${k}: ${v}`).join('\n')}

Uploaded Document Context:
${documentContext || 'None provided.'}

Connected Live Data Samples (Use this to discover true patterns):
${connectedAppData || 'No live data connected.'}

Respond with a JSON object:
{
  "problem_statement": "...",
  "draft_nodes": [
    { "label": "...", "description": "...", "parent_id": null, "sort_order": 0 },
    { "label": "...", "description": "...", "parent_label": "...", "sort_order": 0 }
  ]
}`;

  const res = await createChatCompletion({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  return safeJsonParse<{ problem_statement: string; draft_nodes: Partial<IssueNode>[] }>(
    res.choices[0]?.message?.content,
    { problem_statement: '', draft_nodes: [] }
  );
}

// ─── Issue Tree Refinement Agent ──────────────────────────────────────────────
export async function refineIssueTree(
  problemStatement: string,
  existingNodes: IssueNode[]
): Promise<Partial<IssueNode>[]> {
  const prompt = `You are a McKinsey-style framework specialist.
Problem Statement: ${problemStatement}
Current issue tree: ${JSON.stringify(existingNodes, null, 2)}

Review this tree for MECE completeness (Mutually Exclusive, Collectively Exhaustive).
Return a refined tree as JSON array with the same node shape. Preserve existing IDs where possible.
Add, remove, or relabel nodes as needed.`;

  const res = await createChatCompletion({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  const data = safeJsonParse<{ nodes?: Partial<IssueNode>[] }>(res.choices[0]?.message?.content, {});
  return data.nodes ?? [];
}

// ─── Research Agent ────────────────────────────────────────────────────────────
export async function runResearchBranch(
  engagement: Engagement,
  node: IssueNode,
  webResults: Array<{ title: string; content: string; url: string }>,
  documentContext: string,
  connectedAppData: string = '',
  connectorInstructions: string = ''
): Promise<Partial<Finding>[]> {
  const prompt = `You are a Research Analyst at a strategy consulting firm.
Engagement: ${engagement.client_name} — ${engagement.business_question}
Branch to research: "${node.label}" — ${node.description}

Uploaded Client Documentation & Internal Context:
${documentContext || 'No documents uploaded.'}

Connected Live Data Samples (Internal APIs/CSVs):
${connectedAppData || 'No live data connected.'}

${connectorInstructions}

External Web Research Results:
${webResults.map((r, i) => `[Source ${i + 1}: ${r.title}](${r.url})\n${r.content}`).join('\n\n')}

Synthesize this information and extract 2-4 key findings relevant to this specific branch. 
Crucially: 
- Cross-reference the External Web Research with the Connected Live Data Samples if available.
- For EVERY finding, clearly cite the source in the "source_title" and "source_url" fields.
- If a finding comes from the Connected Live Data, use the data source's name as the "source_title" (e.g., "Internal Database (Supabase)", "Paystack CSV") and set "source_url" to "internal".
- Only output factual, data-driven insights. Do not hallucinate.

MANDATORY INSTRUCTION:
If 'Uploaded Client Documentation & Internal Context' contains document content, you MUST prioritize this primary client evidence and extract at least 2 to 4 findings directly from the uploaded client documents. Citing "Internal Doc: [Document Name]" as the source_title, source_url as null, and confidence as "verified".

For each finding assign:
- "source_title": The publication/website title or the internal document name (e.g., "Internal Doc: filename.pdf")
- "source_url": The web URL (or null for internal uploaded documents)
- "confidence":
  - "verified": directly evidenced in an uploaded client document or verified primary source
  - "estimate": extrapolated or modelled from data
  - "assumption": inferred hypothesis requiring validation

Return JSON:
{
  "findings": [
    {
      "content": "Crisp, factual finding with specific metrics/data where available...",
      "source_url": "https://... or null",
      "source_title": "Internal Doc: annual_report.pdf or Gartner Report",
      "confidence": "verified|estimate|assumption"
    }
  ]
}`;

  const res = await createChatCompletion({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  const data = safeJsonParse<{ findings?: Partial<Finding>[] }>(res.choices[0]?.message?.content, {});
  return (data.findings ?? []).map((f: Partial<Finding>) => ({
    ...f,
    issue_node_id: node.id,
    engagement_id: engagement.id,
    retrieved_at: new Date().toISOString(),
  }));
}

// ─── Analysis Agent ────────────────────────────────────────────────────────────
import { runPythonAnalytics } from './pythonRunner';
export async function runAnalysisBranch(
  engagement: Engagement,
  node: IssueNode,
  findings: Finding[]
): Promise<Array<Partial<Claim> & { _python_output?: string }>> {
  const prompt = `You are a Senior Management Consulting Framework & Quantitative Analytics Specialist.
Business question: ${engagement.business_question}
Branch: "${node.label}"

Findings:
${findings.map((f, i) => `[${i + 1}] (${f.confidence}) ${f.content} — source: ${f.source_url ?? 'none'}`).join('\n')}

Task:
1. Examine the findings for any quantitative data (market sizes, CAGRs, revenue figures, cost drivers, unit margins, retention rates, or benchmark metrics).
2. If quantitative data is present, write a clean, self-contained Python script (in "python_script") that calculates derived metrics (e.g., compound annual growth rates, margin bridges, breakeven thresholds, sensitivity analysis, or ratio benchmarks). Output the results with clear print() statements.
3. Apply appropriate consulting frameworks (Porter's Five Forces, Unit Economics, Value Chain, SWOT, Sensitivity/Variance, Jobs-to-be-Done) to synthesize the findings.
4. Produce 3-6 rigorous analytical claims that answer whether and how this branch is material to the business question. Ground claims in calculated numbers where applicable.
5. **CHARTING ENGINE**: If a claim relies heavily on quantitative data, you MUST generate a supporting chart to visualize the numbers. Include a "chart_config" object using Recharts schema (e.g., \`{"type": "bar", "data": [{"label": "Category", "value": 100}]}\`).

Return JSON:
{
  "python_script": "# Python code to model the numbers in the findings\\n# e.g.,\\n# cagr = ((end / start) ** (1 / years) - 1) * 100\\n# print(f'CAGR: {cagr:.1f}%')",
  "claims": [
    {
      "statement": "Analytical claim grounded in findings and computed metrics...",
      "framework_used": "Unit Economics / Quantitative Model",
      "finding_indices": [0, 2],
      "chart_config": {
        "type": "bar",
        "data": [
          { "label": "2023", "value": 100 },
          { "label": "2024", "value": 200 }
        ]
      }
    }
  ]
}`;

  const res = await createChatCompletion({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 16000,
  });

  const data = safeJsonParse<{
    python_script?: string;
    claims?: Array<{ statement: string; framework_used: string; finding_indices: number[]; chart_config?: any }>;
  }>(res.choices[0]?.message?.content, {});

  // If a Python quantitative script was generated, execute it in the in-browser runtime
  let pythonStdout = '';
  if (data.python_script && data.python_script.trim()) {
    try {
      const pyResult = await runPythonAnalytics(data.python_script);
      if (pyResult.success && pyResult.stdout) {
        pythonStdout = pyResult.stdout;
        console.log(`[Python Analytics] Computed for branch "${node.label}":\n${pythonStdout}`);
      }
    } catch (e) {
      console.warn('Python execution skipped:', e);
    }
  }

  return (data.claims ?? []).map((c: { statement: string; framework_used: string; finding_indices: number[]; chart_config?: any }) => ({
    statement: c.statement,
    framework_used: c.framework_used,
    chart_config: c.chart_config,
    engagement_id: engagement.id,
    issue_node_id: node.id,
    _finding_indices: c.finding_indices,
    _python_output: pythonStdout || undefined,
    created_at: new Date().toISOString(),
  }));
}

// ─── Synthesis Agent ───────────────────────────────────────────────────────────
export async function expandSection(
  engagement: Engagement,
  sectionTitle: string,
  sectionClaims: Claim[]
): Promise<{ content: string; slide_bullets: string[] }> {
  const prompt = `You are a Senior Partner writing a specific section of a strategy memo.
Client: ${engagement.client_name}
Problem Statement: ${engagement.problem_statement}

Section Title: ${sectionTitle}

Relevant Claims:
${sectionClaims.map(c => `- ${c.statement} (${c.framework_used ?? 'general analysis'})`).join('\n')}

Your task is to write the content for this specific section AND create a short PPTX presentation slide.
CRITICAL INSTRUCTION 1 (Report Content): You MUST write a massive, highly detailed essay for this section in the "content" field. It MUST be at least 600-800 words. Dive extremely deep into the data, analytical frameworks, and strategic implications. Use professional consulting tone. DO NOT output a short summary or brief bullet points for the report content.
CRITICAL INSTRUCTION 2 (Slide Bullets): You MUST ALSO distill this massive essay into 3-4 punchy, McKinsey-style bullet points for a PowerPoint slide. These should be short, action-oriented, and highlight the most critical data or insight.

Return JSON matching this exact shape:
{
  "content": "...",
  "slide_bullets": ["Bullet 1...", "Bullet 2..."]
}`;

  const res = await createChatCompletion({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 16000,
  });

  const parsed = safeJsonParse<{ content?: string; slide_bullets?: string[] }>(res.choices[0]?.message?.content, {});
  return {
    content: parsed.content || "Content generation failed.",
    slide_bullets: parsed.slide_bullets || ["No slide bullets generated."]
  };
}

export async function runSynthesis(
  engagement: Engagement,
  nodes: IssueNode[],
  claims: Claim[]
): Promise<DeliverableDocument> {
  // Step 1: Outline Generator
  const outlinePrompt = `You are a Senior Partner outlining the final strategy memo.
Client: ${engagement.client_name}
Problem Statement: ${engagement.problem_statement}

All analytical claims by branch:
${nodes.map(n => {
    const branchClaims = claims.filter(c => c.issue_node_id === n.id);
    return `## ${n.label}\n${branchClaims.map(c => `- [ID: ${c.id}] ${c.statement}`).join('\n')}`;
  }).join('\n\n')}

Apply the Pyramid Principle: lead with the Governing Thought (the single most important answer to the client's question), then structure the outline, recommendations, and roadmap.

CRITICAL CONSTRAINTS:
1. The "executive_summary" must be highly detailed, spanning at least 3 dense paragraphs.
2. The "roadmap" MUST provide a very detailed month-by-month breakdown with exhaustive actions.
3. The "recommendations" MUST include thorough, multi-sentence strategic rationale for each item.
4. Provide a minimum of 5 distinct sections. Leave "content" empty for now. You MUST assign the relevant claim IDs (e.g. "a1b2...") to the "claim_ids" array for each section based on the claims you use.

Return JSON matching this exact shape:
{
  "governing_thought": "...",
  "executive_summary": "...",
  "sections": [
    {
      "id": "s1",
      "title": "...",
      "content": "",
      "claim_ids": []
    }
  ],
  "recommendations": [
    { "id": "r1", "title": "...", "rationale": "...", "priority": "high|medium|low" }
  ],
  "roadmap": [
    { "phase": "Phase 1", "timeline": "0-3 months", "actions": ["..."] }
  ],
  "appendix": []
}`;

  const res = await createChatCompletion({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: outlinePrompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 16000,
  });

  const parsed = safeJsonParse<Partial<DeliverableDocument>>(res.choices[0]?.message?.content, {});
  if (!parsed.governing_thought && !parsed.executive_summary) {
    throw new Error(
      `Synthesis outline returned invalid or empty content (finish_reason: ${res.choices[0]?.finish_reason || 'unknown'}).`
    );
  }

  const doc = parsed as DeliverableDocument;

  // Step 2: Expansion Loop (Parallel)
  if (doc.sections && doc.sections.length > 0) {
    const expandedContents = await Promise.all(
      doc.sections.map(sec => {
        // Pass claims assigned to this section, or all claims if none were mapped
        const assignedClaims = sec.claim_ids?.length 
          ? claims.filter(c => sec.claim_ids?.includes(c.id))
          : claims; 
        
        // Attach chart if one of the claims has a chart_config
        const chartClaim = assignedClaims.find(c => c.chart_config);
        if (chartClaim && !sec.chart) {
          sec.chart = chartClaim.chart_config as any;
        }

        return expandSection(engagement, sec.title, assignedClaims);
      })
    );

    // Step 3: Stitch back together
    doc.sections.forEach((sec, idx) => {
      sec.content = expandedContents[idx].content;
      sec.slide_bullets = expandedContents[idx].slide_bullets;
    });
  }

  return doc;
}

// ─── QA / Red-team Agent ───────────────────────────────────────────────────────
export async function runQualityCheck(
  deliverable: DeliverableDocument,
  claims: Claim[]
): Promise<QualityFlag[]> {
  const prompt = `You are a Red-Team Analyst reviewing a consulting deliverable.
Your job: find unsupported claims, logical gaps, internal contradictions, and missing evidence.

Deliverable:
${JSON.stringify(deliverable, null, 2)}

Claims:
${claims.map((c, i) => `[${i}] ${c.statement}`).join('\n')}

For each issue, return a flag. Be harsh.
Return JSON:
{
  "flags": [
    {
      "claim_id": "...",
      "section_ref": "...",
      "issue": "...",
      "severity": "critical|warning|suggestion"
    }
  ]
}`;

  const res = await createChatCompletion({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.5,
    max_tokens: 16000,
  });

  const data = safeJsonParse<{ flags?: Array<Omit<QualityFlag, 'id' | 'resolved'>> }>(
    res.choices[0]?.message?.content,
    {}
  );
  return (data.flags ?? []).map((f: Omit<QualityFlag, 'id' | 'resolved'>, i: number) => ({
    ...f,
    id: `flag-${i}`,
    resolved: false,
  }));
}

// ─── Auto-Fix Agent ────────────────────────────────────────────────────────────
export async function autoFixDeliverable(
  deliverable: DeliverableDocument,
  flags: QualityFlag[]
): Promise<DeliverableDocument> {
  const unresolvedFlags = flags.filter(f => !f.resolved);
  if (unresolvedFlags.length === 0) return deliverable;

  const prompt = `You are a Senior Editor and Strategy Consultant.
A Red-Team QA pass found issues with the current deliverable. Your task is to rewrite the specific parts of the deliverable that have flags.

Current Deliverable:
${JSON.stringify(deliverable, null, 2)}

QA Feedback (Flags to address):
${unresolvedFlags.map((f, i) => `[Flag ${i + 1}] Severity: ${f.severity.toUpperCase()} | Location: ${f.section_ref || 'General'} | Issue: ${f.issue}`).join('\n')}

MANDATORY INSTRUCTIONS:
- Soften unsupported claims, add caveats, correct contradictions, or remove flawed statements based on the flags.
- You must ONLY return the fields or sections that you actually modified. 
- If the Governing Thought, Executive Summary, Roadmap, or a specific Section did not need changes to resolve the flags, completely omit it from your JSON response. This is critical to save output length.

Return JSON in this exact shape, omitting keys/objects that are unchanged:
{
  "governing_thought": "updated text or omit if unchanged",
  "executive_summary": "updated text or omit if unchanged",
  "sections": [
    {
      "id": "s1", // MUST include the original ID so we know which one to replace
      "content": "updated content..."
    }
  ],
  "recommendations": [
    { 
      "id": "r1", // MUST include the original ID
      "rationale": "updated rationale..." 
    }
  ]
}`;

  const res = await createChatCompletion({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 16000,
  });

  const parsed = safeJsonParse<{
    governing_thought?: string;
    executive_summary?: string;
    sections?: Array<{ id: string; content: string }>;
    recommendations?: Array<{ id: string; title?: string; rationale?: string }>;
  }>(res.choices[0]?.message?.content, {});

  const newDoc = { ...deliverable };
  if (parsed.governing_thought) newDoc.governing_thought = parsed.governing_thought;
  if (parsed.executive_summary) newDoc.executive_summary = parsed.executive_summary;
  
  if (parsed.sections && Array.isArray(parsed.sections)) {
    newDoc.sections = newDoc.sections?.map(s => {
      const match = parsed.sections!.find(p => p.id === s.id);
      return match ? { ...s, content: match.content } : s;
    });
  }

  if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
    newDoc.recommendations = newDoc.recommendations?.map(r => {
      const match = parsed.recommendations!.find(p => p.id === r.id);
      return match ? { ...r, ...match } : r;
    });
  }

  return newDoc;
}

// ─── Engagement Chat Agent ───────────────────────────────────────────────────
export async function streamEngagementAgent(
  engagementId: string,
  engagement: Engagement,
  findings: Finding[],
  query: string,
  onChunk: (chunk: string) => void,
  onSource: (source: string) => void
) {
  // Query Pinecone for context
  const ragContext = await queryPinecone(engagementId, query, 5);
  const ragStr = ragContext.length > 0 ? ragContext.join('\n\n---\n\n') : 'No deep vector context found.';
  
  onSource(ragContext.length > 0 ? 'Seagreen Knowledge Graph (Pinecone) + Live Progress State' : 'Live Progress State');

  // Summarize progress
  const completedFindings = findings.length;
  
  const prompt = `You are a highly intelligent Consulting Copilot embedded directly into the "${engagement.client_name}" engagement.
The business question is: "${engagement.business_question}"

Current Engagement Status:
- The engagement is currently on the "${engagement.stage}" stage.
- The research engine has generated ${completedFindings} automated findings so far.

Context on Stages (for your awareness):
- scoping: Defining the problem.
- issue_tree: Breaking down the problem.
- research: Vectorizing data and generating findings.
- analysis: Structuring findings.
- synthesis: Pyramid-principle deliverable drafting.
- quality_check: Red-teaming and verifying.
- deliverable: Final export.

Deep Vector Database Context (Pinecone RAG):
${ragStr}

User Query: "${query}"

Synthesize an incredibly sharp, helpful response. 
- If the user asks about the progress, state exactly which stage the engagement is on ("${engagement.stage}") and what that means.
- If the user asks deep data questions, extract the answer from the "Deep Vector Database Context".
- Format your response beautifully using markdown.`;

  const stream = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    if (content) {
      onChunk(content);
    }
  }
}
