import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sparkles, CheckCircle, ArrowRight, Check } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AppShell } from '../../components/layout/AppShell';
import { supabase } from '../../lib/supabase';
import { runSynthesis } from '../../lib/openai';
import { saveStageOutput } from '../../lib/engagementStages';
import { startStageRun, finishStageRun } from '../../lib/audit';
import type { Engagement, IssueNode, Claim, DeliverableDocument } from '../../types';

const GEN_STEPS = [
  'Reading analytical claims',
  'Applying Pyramid Principle',
  'Drafting governing thought',
  'Structuring argument',
  'Writing recommendations',
  'Building roadmap',
];

function PriorityBadge({ p }: { p: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    high:   { bg: 'rgba(239,68,68,0.1)',   color: '#f87171' },
    medium: { bg: 'rgba(245,158,11,0.1)',  color: '#fbbf24' },
    low:    { bg: 'rgba(52,211,153,0.1)',  color: '#34d399' },
  };
  const s = styles[p] ?? styles.medium;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: s.bg, color: s.color, border: `1px solid ${s.color}30` }}>
      {p}
    </span>
  );
}

export function SynthesisPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [nodes, setNodes] = useState<IssueNode[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [deliverable, setDeliverable] = useState<DeliverableDocument | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, [id]);

  useEffect(() => {
    if (!generating) { setGenStep(0); return; }
    const interval = setInterval(() => setGenStep(prev => Math.min(prev + 1, GEN_STEPS.length - 1)), 5000);
    return () => clearInterval(interval);
  }, [generating]);

  async function loadData() {
    if (!id) return;
    const [{ data: eng }, { data: nodeData }, { data: claimData }, { data: delData }] = await Promise.all([
      supabase.from('engagements').select('*').eq('id', id).single(),
      supabase.from('issue_nodes').select('*').eq('engagement_id', id).eq('in_scope', true),
      supabase.from('claims').select('*').eq('engagement_id', id),
      supabase.from('deliverables').select('*').eq('engagement_id', id).eq('is_current', true).maybeSingle(),
    ]);
    if (eng) setEngagement(eng as Engagement);
    if (nodeData) setNodes(nodeData as IssueNode[]);
    if (claimData) setClaims(claimData as Claim[]);
    if (delData) setDeliverable((delData as { document: DeliverableDocument }).document);
  }

  async function handleGenerate() {
    if (!id) return;
    setGenerating(true);
    setError('');
    const runId = await startStageRun(id, 'synthesis', 'gpt-4o');
    try {
      const doc = await runSynthesis(engagement!, nodes, claims);
      setDeliverable(doc);
      await supabase.from('deliverables').update({ is_current: false }).eq('engagement_id', id);
      await supabase.from('deliverables').insert({ engagement_id: id, version: 1, document: doc, is_current: true, created_at: new Date().toISOString() });
      await saveStageOutput(id, 'synthesis', { governing_thought: doc.governing_thought, executive_summary: doc.executive_summary, sections_count: doc.sections?.length ?? 0, recommendations_count: doc.recommendations?.length ?? 0, document: doc, synthesized_at: new Date().toISOString() });
      await finishStageRun(runId, 'done');
    } catch (err: unknown) {
      await finishStageRun(runId, 'error');
      setError(err instanceof Error ? err.message : 'Synthesis failed. Please retry.');
    }
    setGenerating(false);
  }

  async function handleApprove() {
    if (!id) return;
    setApproving(true);
    await supabase.from('engagements').update({ stage: 'quality_check', updated_at: new Date().toISOString() }).eq('id', id);
    await saveStageOutput(id, 'synthesis', { approved: true, governing_thought: deliverable?.governing_thought, approved_at: new Date().toISOString() }, 'completed');
    navigate(`/engagement/${id}/quality-check`);
  }

  return (
    <AppShell engagementId={id} currentStage="synthesis" completedStages={['scoping', 'issue_tree', 'research', 'analysis']}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 48px' }}>

        <div style={{ marginBottom: 36 }}>
          <div className="badge badge-gold" style={{ marginBottom: 12 }}>Stage 5 — Synthesis</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 8 }}>Synthesis</h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
            The synthesis agent applies the Pyramid Principle to turn {claims.length} claims into a structured deliverable.
          </p>
        </div>

        {!deliverable ? (
          generating ? (
            <div className="card">
              <div className="agent-working">
                <div className="agent-working-icon-wrap">
                  <div className="agent-working-icon">
                    <Sparkles size={22} />
                  </div>
                </div>
                <div>
                  <h3 style={{ marginBottom: 4 }}>Synthesising deliverable</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', margin: 0 }}>This typically takes 30–60 seconds</p>
                </div>
                <div className="agent-working-steps">
                  {GEN_STEPS.map((step, i) => {
                    const status = i < genStep ? 'done' : i === genStep ? 'running' : 'pending';
                    return (
                      <div key={step} className={`agent-step ${status}`}>
                        <div className="agent-step-dot" />
                        {status === 'done' && <Check size={12} style={{ color: 'var(--success)', flexShrink: 0 }} />}
                        <span>{step}</span>
                        {status === 'running' && <div className="thinking-dots" style={{ marginLeft: 'auto' }}><span /><span /><span /></div>}
                      </div>
                    );
                  })}
                </div>
                <div className="processing-bar" style={{ width: '100%', maxWidth: 380 }} />
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid rgba(200,169,110,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--accent)' }}>
                <Sparkles size={20} />
              </div>
              <h3 style={{ marginBottom: 8, fontSize: '1.0625rem' }}>Generate Synthesis</h3>
              <p style={{ marginBottom: 28, maxWidth: 440, margin: '0 auto 28px', fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
                Synthesises {claims.length} analytical claims across {nodes.length} branches into a structured deliverable document using the Pyramid Principle.
              </p>
              {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
              <button className="btn btn-gold btn-lg" onClick={handleGenerate}>
                <Sparkles size={15} /> Generate with AI
              </button>
            </div>
          )
        ) : (
          <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Governing Thought Hero */}
            <div className="synthesis-hero">
              <div className="synthesis-hero-label">Governing Thought</div>
              <div className="synthesis-hero-thought">"{deliverable.governing_thought}"</div>
            </div>

            {/* Executive Summary */}
            <div className="card">
              <div className="section-heading">Executive Summary</div>
              <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0 }}>{deliverable.executive_summary}</p>
            </div>

            {/* Sections */}
            {deliverable.sections && deliverable.sections.length > 0 && (
              <div className="card">
                <div className="section-heading">Sections ({deliverable.sections.length})</div>
                {deliverable.sections.map((section, i) => (
                  <div key={section.id} className="outline-section">
                    <div className="outline-num">{String(i + 1).padStart(2, '0')}</div>
                    <div className="outline-body">
                      <div className="outline-title">{section.title}</div>
                      <div className="outline-content">{section.content}</div>
                      {section.chart && (
                        <div style={{ marginTop: 24, height: 260, width: '100%', background: 'var(--bg-1)', borderRadius: 8, padding: 12, border: '1px solid var(--b2)' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            {section.chart.type === 'bar' ? (
                              <BarChart data={section.chart.data}>
                                <XAxis dataKey="label" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{ fill: 'var(--bg-3)' }} contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--b2)', borderRadius: 6 }} />
                                <Bar dataKey="value" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            ) : section.chart.type === 'line' ? (
                              <LineChart data={section.chart.data}>
                                <XAxis dataKey="label" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--b2)', borderRadius: 6 }} />
                                <Line type="monotone" dataKey="value" stroke="var(--gold)" strokeWidth={2} dot={{ r: 4, fill: 'var(--bg-1)', stroke: 'var(--gold)' }} />
                              </LineChart>
                            ) : (
                              <PieChart>
                                <Pie data={section.chart.data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80} fill="var(--gold)" label>
                                  {section.chart.data.map((_, index) => <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--gold)' : 'var(--accent)'} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--b2)', borderRadius: 6 }} />
                              </PieChart>
                            )}
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {deliverable.recommendations && deliverable.recommendations.length > 0 && (
              <div className="card">
                <div className="section-heading">Recommendations</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {deliverable.recommendations.map((rec) => (
                    <div key={rec.id} className="rec-row">
                      <div className={`rec-priority-bar ${rec.priority}`} />
                      <div className="rec-body">
                        <div className="rec-title">{rec.title}</div>
                        <div className="rec-rationale">{rec.rationale}</div>
                      </div>
                      <div className="rec-badge">
                        <PriorityBadge p={rec.priority} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-outline" onClick={handleGenerate} disabled={generating}>
                {generating ? <span className="spinner spinner-sm" /> : <Sparkles size={13} />}
                Regenerate
              </button>
              <button className="btn btn-gold" onClick={handleApprove} disabled={approving}>
                {approving ? <span className="spinner spinner-sm spinner-gold" /> : <CheckCircle size={14} />}
                Proceed to Quality Check <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
