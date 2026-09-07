import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sparkles, CheckCircle, Edit3, ArrowRight, Check, Database } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { supabase } from '../../lib/supabase';
import { OPENAI_MODEL, runScoping } from '../../lib/openai';
import { loadConnectors } from '../../lib/connectorStorage';
import { fetchConsolidatedData } from '../../lib/dataFetcher';
import { saveStageOutput } from '../../lib/engagementStages';
import { startStageRun, finishStageRun } from '../../lib/audit';
import { DocumentManager } from '../../components/engagement/DocumentManager';
import type { Engagement, IntakeAnswer, IssueNode } from '../../types';


export function ScopingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [answers, setAnswers] = useState<IntakeAnswer[]>([]);
  const [statement, setStatement] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [editing, setEditing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState('');
  const [streamSteps, setStreamSteps] = useState<{label: string, status: 'done' | 'running'}[]>([]);

  const [connectors, setConnectors] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    loadConnectors().then(setConnectors);
  }, [id]);

  async function loadData() {
    if (!id) return;
    const [{ data: eng }, { data: ans }] = await Promise.all([
      supabase.from('engagements').select('*').eq('id', id).single(),
      supabase.from('intake_answers').select('*').eq('engagement_id', id),
    ]);
    if (eng) {
      setEngagement(eng as Engagement);
      if (eng.problem_statement) { setStatement(eng.problem_statement); setGenerated(true); }
    }
    if (ans) setAnswers(ans as IntakeAnswer[]);
  }

  async function handleGenerate() {
    if (!engagement || !id) return;
    setGenerating(true);
    setStreamSteps([{ label: 'Reading client intake...', status: 'running' }]);
    setError('');
    
    const runId = await startStageRun(id, 'scoping', OPENAI_MODEL);
    try {
      const intake = Object.fromEntries(answers.map(a => [a.field, a.value]));
      
      setStreamSteps(prev => [ ...prev.slice(0, -1), { label: prev[prev.length - 1].label, status: 'done' }, { label: 'Extracting relevant documents...', status: 'running' }]);
      const { data: docs } = await supabase.from('documents').select('name, parsed_chunks').eq('engagement_id', id);
      const docContext = (docs ?? []).map(d => {
        const chunks = Array.isArray(d.parsed_chunks) ? (d.parsed_chunks as Array<{ text: string }>).map(c => c.text).join('\n') : '';
        return `Document [${d.name}]:\n${chunks}`;
      }).join('\n\n');

      let connectedAppDataStr = '';
      if (intake['connected_app_ids']) {
        const ids = intake['connected_app_ids'].split(',');
        const connectors = await loadConnectors();
        const activeConnectors = connectors.filter(c => ids.includes(c.id));
        
        const results = [];
        for (const conn of activeConnectors) {
          setStreamSteps(prev => [ ...prev.slice(0, -1), { label: prev[prev.length - 1].label, status: 'done' }, { label: `Analyzing data from ${conn.display_name}...`, status: 'running' }]);
          try {
            let creds = conn.credentials;
            if (typeof creds === 'string') creds = JSON.parse(creds);
            const data = await fetchConsolidatedData(conn.connector_id, conn.display_name, creds);
            results.push(`Data from ${conn.display_name}:\n${JSON.stringify(data.streams).substring(0, 10000)}`);
          } catch (err) {
            results.push(`Failed to fetch data from ${conn.display_name}.`);
          }
        }
        connectedAppDataStr = results.join('\n\n');
      }

      setStreamSteps(prev => [ ...prev.slice(0, -1), { label: prev[prev.length - 1].label, status: 'done' }, { label: 'Drafting Problem Statement & Issue Tree...', status: 'running' }]);
      const result = await runScoping(intake, docContext, connectedAppDataStr);
      
      setStreamSteps(prev => [ ...prev.slice(0, -1), { label: prev[prev.length - 1].label, status: 'done' } ]);
      
      setStatement(result.problem_statement);
      setGenerated(true);

      if (result.draft_nodes?.length) {
        type DraftNode = Partial<IssueNode> & { parent_label?: string };
        const draftNodes = result.draft_nodes as DraftNode[];
        await supabase.from('issue_nodes').delete().eq('engagement_id', id);
        const rootNodes = draftNodes.filter(n => !n.parent_label);
        const childNodes = draftNodes.filter(n => n.parent_label);
        const { data: inserted } = await supabase.from('issue_nodes').insert(
          rootNodes.map((n, i) => ({ engagement_id: id, parent_id: null, label: n.label, description: n.description ?? '', in_scope: true, sort_order: i }))
        ).select();
        if (inserted && childNodes.length) {
          await supabase.from('issue_nodes').insert(childNodes.map((n, i) => {
            const parent = (inserted as IssueNode[]).find(p => p.label === n.parent_label);
            return { engagement_id: id, parent_id: parent?.id ?? null, label: n.label, description: n.description ?? '', in_scope: true, sort_order: i };
          }));
        }
      }

      await saveStageOutput(id, 'scoping', { problem_statement: result.problem_statement, draft_nodes_count: result.draft_nodes?.length ?? 0, draft_nodes: result.draft_nodes, generated_at: new Date().toISOString() });
      await finishStageRun(runId, 'done');
    } catch {
      await finishStageRun(runId, 'error');
      setError('AI generation failed. Check your OpenAI API key in .env');
    }
    setGenerating(false);
  }

  async function handleApprove() {
    if (!id || !statement) return;
    setApproving(true);
    await supabase.from('engagements').update({ problem_statement: statement, stage: 'issue_tree', updated_at: new Date().toISOString() }).eq('id', id);
    await saveStageOutput(id, 'scoping', { problem_statement: statement, approved: true, approved_at: new Date().toISOString() }, 'completed');
    navigate(`/engagement/${id}/issue-tree`);
  }

  const intake = Object.fromEntries(answers.map(a => [a.field, a.value]));
  const intakeRows = [
    { label: 'Client', value: engagement?.client_name },
    { label: 'Industry', value: intake.industry },
    { label: 'Business Question', value: intake.business_question },
    { label: 'Decision', value: intake.decision },
    { label: 'Timeline', value: intake.timeline },
    { label: 'Competitors', value: intake.competitors },
    { label: 'Geography', value: intake.geography },
  ].filter(r => r.value);

  const activeConnectors = connectors.filter(c => intake.connected_app_ids?.split(',').includes(c.id));

  return (
    <AppShell engagementId={id} currentStage="scoping" completedStages={[]}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 48px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div className="badge badge-gold" style={{ marginBottom: 12 }}>Stage 1 — Scoping</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 8 }}>Problem Statement</h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
            Review the intake, generate a scoped problem statement, then approve to build the issue tree.
          </p>
        </div>

        {/* Intake Summary */}
        <div className="card animate-in" style={{ marginBottom: 20 }}>
          <div className="section-heading" style={{ paddingBottom: 16, marginBottom: 16 }}>Intake Summary</div>
          <div>
            {intakeRows.map(row => (
              <div key={row.label} className="intake-row">
                <span className="intake-label">{row.label}</span>
                <span className="intake-value">{row.value}</span>
              </div>
            ))}
            
            {activeConnectors.length > 0 && (
              <div className="intake-row" style={{ borderBottom: 'none' }}>
                <span className="intake-label">DATA SOURCES</span>
                <span className="intake-value" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {activeConnectors.map(c => (
                    <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6, background: 'var(--gold-lo)', color: 'var(--gold)', fontSize: '0.75rem', fontWeight: 600 }}>
                      <Database size={12} />
                      {c.display_name}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Documents */}
        <div className="animate-in stagger-1" style={{ marginBottom: 20 }}>
          <DocumentManager engagementId={id!} />
        </div>

        {/* Generate / Statement */}
        <div className="animate-in stagger-2">
          {!generated ? (
            generating ? (
              /* Agent Working */
              <div className="card">
                <div className="agent-working">
                  <div className="agent-working-icon-wrap">
                    <div className="agent-working-icon">
                      <Sparkles size={22} />
                    </div>
                  </div>
                  <div>
                    <h3 style={{ marginBottom: 4 }}>Agent is working</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', margin: 0 }}>
                      This typically takes 20–40 seconds
                    </p>
                  </div>
                  <div className="agent-working-steps">
                    {streamSteps.map((step, i) => {
                      const status = step.status;
                      return (
                        <div key={i} className={`agent-step ${status}`}>
                          <div className="agent-step-dot" />
                          {status === 'done' ? <Check size={12} style={{ color: 'var(--success)', flexShrink: 0 }} /> : null}
                          <span>{step.label}</span>
                          {status === 'running' && <div className="thinking-dots" style={{ marginLeft: 'auto' }}><span /><span /><span /></div>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="processing-bar" style={{ width: '100%', maxWidth: 380 }} />
                </div>
              </div>
            ) : (
              /* Empty — ready to generate */
              <div className="card" style={{ padding: '48px 32px', textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid rgba(200,169,110,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--accent)' }}>
                  <Sparkles size={20} />
                </div>
                <h3 style={{ marginBottom: 8, fontSize: '1.0625rem' }}>Generate Problem Statement</h3>
                <p style={{ marginBottom: 28, maxWidth: 420, margin: '0 auto 28px', fontSize: '0.9375rem' }}>
                  The Engagement Lead agent will read your intake and uploaded documents, then produce a structured problem statement and first-pass issue tree.
                </p>
                {error && <div className="alert alert-error" style={{ marginBottom: 16, textAlign: 'left' }}>{error}</div>}
                <button className="btn btn-gold btn-lg" onClick={handleGenerate}>
                  <Sparkles size={15} />
                  Generate with AI
                </button>
              </div>
            )
          ) : (
            /* Problem Statement */
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div className="section-heading" style={{ margin: 0 }}>Problem Statement</div>
                <button className="btn btn-outline btn-sm" onClick={() => setEditing(!editing)}>
                  <Edit3 size={12} />
                  {editing ? 'Done' : 'Edit'}
                </button>
              </div>

              {editing ? (
                <textarea
                  className="form-textarea"
                  value={statement}
                  onChange={e => setStatement(e.target.value)}
                  rows={8}
                  style={{ fontSize: '0.9375rem', lineHeight: 1.7 }}
                />
              ) : (
                <div className="problem-statement animate-in">
                  <p className="problem-statement-text">{statement}</p>
                </div>
              )}

              <div className="divider" />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button className="btn btn-outline btn-sm" onClick={handleGenerate} disabled={generating}>
                  {generating ? <span className="spinner spinner-sm" /> : <Sparkles size={13} />}
                  Regenerate
                </button>
                <button className="btn btn-gold" onClick={handleApprove} disabled={approving || !statement}>
                  {approving ? <span className="spinner spinner-sm spinner-gold" /> : <CheckCircle size={15} />}
                  Approve & Build Issue Tree
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
