// Web search via Tavily API (with mock fallback when API key is a placeholder)
const TAVILY_API_KEY = import.meta.env.VITE_TAVILY_API_KEY as string;
const IS_MOCK = !TAVILY_API_KEY || TAVILY_API_KEY.startsWith('placeholder');

export interface SearchResult {
  title: string;
  content: string;
  url: string;
  score: number;
}

export async function webSearch(query: string, maxResults = 5): Promise<SearchResult[]> {
  if (IS_MOCK) {
    return getMockResults(query, maxResults);
  }

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      max_results: maxResults,
      search_depth: 'advanced',
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const errBody = await res.json();
      if (errBody?.detail?.error) detail = errBody.detail.error;
      else if (errBody?.message) detail = errBody.message;
      else if (errBody?.error) detail = errBody.error;
    } catch {
      // Keep statusText
    }
    throw new Error(`Tavily search failed (${res.status}): ${detail}`);
  }

  const data = await res.json();
  return (data.results ?? []).map((r: { title: string; content: string; url: string; score: number }) => ({
    title: r.title,
    content: r.content,
    url: r.url,
    score: r.score ?? 1,
  }));
}

// ─── Mock data for development ─────────────────────────────────────────────────
function getMockResults(query: string, n: number): SearchResult[] {
  const mocks: SearchResult[] = [
    {
      title: 'Global Market Size Report 2024 — Industry Research Ltd.',
      content: `The global market for ${query.split(' ').slice(0, 3).join(' ')} reached $2.4 trillion in 2024, growing at a CAGR of 8.3% from 2019–2024. Key growth drivers include digital transformation, regulatory tailwinds, and emerging market penetration. The top 5 players control 62% of market share, with fragmentation in the long tail creating M&A opportunities.`,
      url: 'https://example-research.com/market-report-2024',
      score: 0.95,
    },
    {
      title: 'Competitive Landscape Analysis — Strategy+Business',
      content: `Leading incumbents have invested $180B collectively in R&D over the past 3 years. New entrants with AI-native approaches are capturing 12% of addressable market annually. Customer acquisition cost has declined 22% YoY due to digital channel shifts, while lifetime value has increased 15% driven by product bundling strategies.`,
      url: 'https://strategy-business.com/competitive-landscape',
      score: 0.88,
    },
    {
      title: 'Unit Economics Benchmarks by Segment — McKinsey Insights',
      content: `Best-in-class operators in this segment achieve gross margins of 68–74%, EBITDA margins of 22–28%, and payback periods under 18 months. Customer retention rates above 85% are a hallmark of category leaders. Companies with NPS above 50 command 2.3x premium valuation multiples vs. peers.`,
      url: 'https://mckinsey.com/insights/unit-economics-2024',
      score: 0.85,
    },
    {
      title: 'Regulatory Environment Overview Q3 2024',
      content: `Three major regulatory frameworks are converging that will reshape competitive dynamics: updated data localisation requirements, ESG disclosure mandates effective 2025, and antitrust scrutiny on platform consolidation. Companies proactively addressing compliance are seeing 18% lower legal cost ratios.`,
      url: 'https://regulatory-monitor.com/overview-q3-2024',
      score: 0.78,
    },
    {
      title: 'Consumer Behaviour Shifts Post-2023 — Deloitte Survey',
      content: `Survey of 12,000 global consumers reveals: 71% prioritise value-for-money over brand loyalty (up 14pp vs 2021), 58% are willing to switch providers for better digital experience, and 43% actively seek businesses with strong sustainability credentials. SMB decision-makers increasingly bypass traditional procurement channels.`,
      url: 'https://deloitte.com/consumer-survey-2024',
      score: 0.73,
    },
  ];
  return mocks.slice(0, n);
}
