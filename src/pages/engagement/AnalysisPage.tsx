import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, CheckCircle, ArrowRight, ExternalLink } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AppShell } from '../../components/layout/AppShell';
import { ConfidenceBadge } from '../../components/engagement/Badges';
import { supabase } from '../../lib/supabase';
import { runAnalysisBranch, OPENAI_MODEL } from '../../lib/openai';
import { saveStageOutput } from '../../lib/engagementStages';
import { startStageRun, finishStageRun } from '../../lib/audit';
import type { Engagement, IssueNode, Finding, Claim } from '../../types';

export function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [nodes, setNodes] = useState<IssueNode[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [branchStatus, setBranchStatus] = useState<Record<string, 'queued' | 'running' | 'done' | 'error'>>({});
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [streamSteps, setStreamSteps] = useState<Record<string, {label: string, status: 'done' | 'running'}[]>>({});

  const scopedNodes = nodes.filter(n => n.in_scope && !n.parent_id);

  useEffect(() => { loadData(); }, [id]);
  useEffect(() => {
    if (scopedNodes.length > 0 && !selectedBranch) setSelectedBranch(scopedNodes[0].id);
  }, [scopedNodes.length]);

  async function loadData() {
    if (!id) return;
    const [{ data: eng }, { data: nodeData }, { data: findingData }, { data: claimData }] = await Promise.all([
      supabase.from('engagements').select('*').eq('id', id).single(),
      supabase.from('issue_nodes').select('*').eq('engagement_id', id).eq('in_scope', true),
      supabase.from('findings').select('*').eq('engagement_id', id),
      supabase.from('claims').select('*').eq('engagement_id', id),
    ]);
    if (eng) setEngagement(eng as Engagement);
    if (nodeData) setNodes(nodeData as IssueNode[]);
    if (findingData) setFindings(findingData as Finding[]);
    if (claimData) {
      setClaims(claimData as Claim[]);
      const existingStatuses: Record<string, 'done'> = {};
      (claimData as Claim[]).forEach(c => { existingStatuses[c.issue_node_id] = 'done'; });
      setBranchStatus(existingStatuses);
    }
  }

  async function runAnalysis(node: IssueNode) {
    if (!id) return;
    setBranchStatus(prev => ({ ...prev, [node.id]: 'running' }));
    setSelectedBranch(node.id);
    setStreamSteps(prev => ({ ...prev, [node.id]: [{ label: 'Preparing analysis context...', status: 'running' }] }));

    const updateStream = (label: string) => {
      setStreamSteps(prev => {
        const branchSteps = prev[node.id] || [];
        return {
          ...prev,
          [node.id]: [
            ...branchSteps.slice(0, -1),
            { label: branchSteps[branchSteps.length - 1]?.label || 'Done', status: 'done' },
            { label, status: 'running' }
          ]
        };
      });
    };

    const runId = await startStageRun(id, 'analysis', OPENAI_MODEL);
    try {
      const branchFindings = findings.filter(f => f.issue_node_id === node.id);
      
      updateStream('Running analytical frameworks...');
      await new Promise(r => setTimeout(r, 800)); // UI delay
      
      updateStream('Checking for quantitative models...');
      await new Promise(r => setTimeout(r, 800)); // UI delay
      
      updateStream('Synthesizing claims & generating charts...');
      const newClaims = await runAnalysisBranch(engagement!, node, branchFindings);
      
      setStreamSteps(prev => {
        const branchSteps = prev[node.id] || [];
        return {
          ...prev,
          [node.id]: [
            ...branchSteps.slice(0, -1),
            { label: branchSteps[branchSteps.length - 1]?.label || 'Done', status: 'done' }
          ]
        };
      });
      await supabase.from('claims').delete().eq('issue_node_id', node.id);
      const { data: inserted } = await supabase.from('claims').insert(
        newClaims.map(c => ({ engagement_id: id, issue_node_id: node.id, statement: c.statement, framework_used: c.framework_used ?? null, chart_config: c.chart_config ?? null, created_at: new Date().toISOString() }))
      ).select();
      if (inserted) {
        setClaims(prev => [...prev.filter(c => c.issue_node_id !== node.id), ...(inserted as Claim[])]);
        await saveStageOutput(id, 'analysis', { latest_branch: node.label, claims_count: claims.length + (inserted.length || 0), last_analyzed_at: new Date().toISOString() });
      }
      setBranchStatus(prev => ({ ...prev, [node.id]: 'done' }));
      await finishStageRun(runId, 'done');
    } catch {
      await finishStageRun(runId, 'error');
      setBranchStatus(prev => ({ ...prev, [node.id]: 'error' }));
    }
  }

  async function runAll() {
    for (const node of scopedNodes) {
      if (branchStatus[node.id] !== 'done') await runAnalysis(node);
    }
  }

  async function handleApprove() {
    if (!id) return;
    setApproving(true);
    await supabase.from('engagements').update({ stage: 'synthesis', updated_at: new Date().toISOString() }).eq('id', id);
    const frameworks = Array.from(new Set(claims.map(c => c.framework_used).filter(Boolean)));
    await saveStageOutput(id, 'analysis', { claims_count: claims.length, frameworks_used: frameworks, claims: claims.map(c => ({ id: c.id, statement: c.statement, framework_used: c.framework_used, issue_node_id: c.issue_node_id })), approved_at: new Date().toISOString() }, 'completed');
    navigate(`/engagement/${id}/synthesis`);
  }

  const allDone = scopedNodes.length > 0 && scopedNodes.every(n => branchStatus[n.id] === 'done');
  const selectedNode = nodes.find(n => n.id === selectedBranch);
  const selectedClaims = claims.filter(c => c.issue_node_id === selectedBranch);
  const selectedFindings = findings.filter(f => f.issue_node_id === selectedBranch);

  return (
    <AppShell engagementId={id} currentStage="analysis" completedStages={['scoping', 'issue_tree', 'research']}>
      <div className="workflow-layout">
        {/* Left: workflow panel */}
        <div className="workflow-panel">
          <div className="workflow-panel-header">
            <div className="workflow-panel-title">Stage 4</div>
            <div className="workflow-panel-heading">Analysis</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: 6 }}>
              Apply structured frameworks to findings.
            </p>
          </div>

          <div className="branch-list">
            {scopedNodes.map(node => {
              const status = branchStatus[node.id] ?? 'queued';
              const count = claims.filter(c => c.issue_node_id === node.id).length;
              const isSelected = selectedBranch === node.id;
              return (
                <div key={node.id} className={`branch-row ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedBranch(node.id)}>
                  <div className={`branch-status-dot ${status}`} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="branch-label" style={{ fontSize: '0.8125rem' }}>{node.label}</div>
                    {count > 0 && <div className="branch-count">{count} claim{count !== 1 ? 's' : ''}</div>}
                    {status === 'running' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <div className="thinking-dots"><span /><span /><span /></div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>Analysing…</span>
                      </div>
                    )}
                  </div>
                  <button className={`branch-run-btn ${status === 'queued' ? 'primary' : ''}`} onClick={e => { e.stopPropagation(); runAnalysis(node); }} disabled={status === 'running'}>
                    {status === 'running' ? <span className="spinner spinner-sm" style={{ width: 10, height: 10 }} /> : <Play size={10} style={{ display: 'inline' }} />}
                    {' '}{status === 'done' ? 'Re-run' : status === 'running' ? '…' : 'Run'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="workflow-panel-footer">
            <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={runAll} disabled={allDone}>
              <Play size={13} /> Run All Branches
            </button>
            {allDone && (
              <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={handleApprove} disabled={approving}>
                {approving ? <span className="spinner spinner-sm spinner-gold" /> : <CheckCircle size={14} />}
                Proceed to Synthesis <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Right: claims + findings */}
        <div className="workflow-main">
          {selectedNode ? (
            <div className="animate-in">
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>{selectedNode.label}</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
                  {selectedFindings.length} findings · {selectedClaims.length} claims
                </p>
              </div>

              {branchStatus[selectedNode.id] === 'running' ? (
                <div className="stage-thinking" style={{ padding: '32px 40px', alignItems: 'flex-start', textAlign: 'left' }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div className="stage-thinking-icon" style={{ margin: 0 }}>
                      <Play size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ marginBottom: 4 }}>Applying analytical frameworks</h3>
                      <p style={{ fontSize: '0.875rem', margin: 0 }}>Running structured analysis across {selectedFindings.length} findings…</p>
                      
                      <div className="agent-working-steps" style={{ marginTop: 24, textAlign: 'left', alignItems: 'flex-start' }}>
                        {(streamSteps[selectedNode.id] || []).map((step, i) => {
                          const status = step.status;
                          return (
                            <div key={i} className={`agent-step ${status}`}>
                              <div className="agent-step-dot" />
                              {status === 'done' ? <CheckCircle size={12} style={{ color: 'var(--success)', flexShrink: 0 }} /> : null}
                              <span>{step.label}</span>
                              {status === 'running' && <div className="thinking-dots" style={{ marginLeft: 'auto' }}><span /><span /><span /></div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : selectedClaims.length === 0 ? (
                <div style={{ padding: '56px 32px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--r-lg)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Run analysis to generate framework-backed claims.</p>
                </div>
              ) : (
                <>
                  <div className="section-heading">Analytical Claims</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
                    {selectedClaims.map(claim => (
                      <div key={claim.id} className="claim-block">
                        {claim.framework_used && <div className="claim-framework">{claim.framework_used}</div>}
                        <p className="claim-text">{claim.statement}</p>
                        {claim.chart_config && (
                          <div style={{ marginTop: 16, height: 200, width: '100%', background: 'var(--bg-1)', borderRadius: 8, padding: 12, border: '1px solid var(--b2)' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              {claim.chart_config.type === 'bar' ? (
                                <BarChart data={claim.chart_config.data}>
                                  <XAxis dataKey="label" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                                  <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                                  <Tooltip cursor={{ fill: 'var(--bg-3)' }} contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--b2)', borderRadius: 6 }} />
                                  <Bar dataKey="value" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              ) : claim.chart_config.type === 'line' ? (
                                <LineChart data={claim.chart_config.data}>
                                  <XAxis dataKey="label" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                                  <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                                  <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--b2)', borderRadius: 6 }} />
                                  <Line type="monotone" dataKey="value" stroke="var(--gold)" strokeWidth={2} dot={{ r: 4, fill: 'var(--bg-1)', stroke: 'var(--gold)' }} />
                                </LineChart>
                              ) : (
                                <PieChart>
                                  <Pie data={claim.chart_config.data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={60} fill="var(--gold)" label>
                                    {claim.chart_config.data.map((_, index) => <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--gold)' : 'var(--accent)'} />)}
                                  </Pie>
                                  <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--b2)', borderRadius: 6 }} />
                                </PieChart>
                              )}
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {selectedFindings.length > 0 && (
                    <>
                      <div className="section-heading">Supporting Evidence</div>
                      {selectedFindings.map((f, i) => (
                        <div key={f.id} className="finding-row">
                          <div className="finding-num">{String(i + 1).padStart(2, '0')}</div>
                          <div className="finding-body">
                            <p className="finding-text" style={{ fontSize: '0.875rem' }}>{f.content}</p>
                            <div className="finding-footer">
                              <ConfidenceBadge confidence={f.confidence} />
                              {f.source_url && (
                                <a href={f.source_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                  <ExternalLink size={11} /> {f.source_title ?? 'Source'}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          ) : (
            <div style={{ padding: '80px 32px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Select a branch to view its analysis.</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
