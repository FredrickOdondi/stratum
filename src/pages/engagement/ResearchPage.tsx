import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, CheckCircle, ArrowRight, ExternalLink, AlertTriangle } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { ConfidenceBadge } from '../../components/engagement/Badges';
import { supabase } from '../../lib/supabase';
import { runResearchBranch, OPENAI_MODEL } from '../../lib/openai';
import { webSearch } from '../../lib/search';
import { loadConnectors } from '../../lib/connectorStorage';
import { fetchConsolidatedData } from '../../lib/dataFetcher';
import { indexDataToPinecone, queryPinecone } from '../../lib/pinecone';
import { saveStageOutput } from '../../lib/engagementStages';
import { startStageRun, finishStageRun } from '../../lib/audit';
import { getConnectorInstructions } from '../../lib/connectorInstructions';
import type { Engagement, IssueNode, Finding } from '../../types';

type BranchStatus = 'queued' | 'running' | 'done' | 'error';

export function ResearchPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [nodes, setNodes] = useState<IssueNode[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [branchStatus, setBranchStatus] = useState<Record<string, BranchStatus>>({});
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [approving, setApproving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [connectors, setConnectors] = useState<any[]>([]);
  const [connectedAppIds, setConnectedAppIds] = useState<string>('');
  const [streamSteps, setStreamSteps] = useState<Record<string, {label: string, status: 'done' | 'running'}[]>>({});

  const scopedNodes = nodes.filter(n => n.in_scope && !n.parent_id);

  useEffect(() => { loadData(); }, [id]);

  useEffect(() => {
    // Auto-select first branch if none selected
    if (scopedNodes.length > 0 && !selectedBranch) {
      setSelectedBranch(scopedNodes[0].id);
    }
  }, [scopedNodes.length]);

  async function loadData() {
    if (!id) return;
    loadConnectors().then(setConnectors);
    
    const [{ data: eng }, { data: nodeData }, { data: findingData }, { data: ansData }] = await Promise.all([
      supabase.from('engagements').select('*').eq('id', id).single(),
      supabase.from('issue_nodes').select('*').eq('engagement_id', id).eq('in_scope', true),
      supabase.from('findings').select('*').eq('engagement_id', id),
      supabase.from('intake_answers').select('*').eq('engagement_id', id)
    ]);
    if (eng) setEngagement(eng as Engagement);
    if (ansData) {
      const ids = (ansData as any[]).find(a => a.field === 'connected_app_ids')?.value;
      if (ids) setConnectedAppIds(ids);
    }
    if (nodeData) {
      const n = nodeData as IssueNode[];
      setNodes(n);
      const existingStatuses: Record<string, BranchStatus> = {};
      if (findingData) {
        n.forEach(node => {
          const hasFinding = (findingData as Finding[]).some(f => f.issue_node_id === node.id);
          if (hasFinding) existingStatuses[node.id] = 'done';
        });
      }
      setBranchStatus(existingStatuses);
    }
    if (findingData) setFindings(findingData as Finding[]);
  }

  async function runBranch(node: IssueNode) {
    if (!id) return;
    setBranchStatus(prev => ({ ...prev, [node.id]: 'running' }));
    setSelectedBranch(node.id);
    setApiError('');
    setStreamSteps(prev => ({ ...prev, [node.id]: [{ label: 'Preparing research query...', status: 'running' }] }));
    
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

    const runId = await startStageRun(id, 'research', OPENAI_MODEL);
    try {
      const searchQuery = `${engagement?.business_question} ${node.label} market data benchmarks`;
      
      updateStream('Searching the web for external intelligence...');
      const [webResults, { data: docs }] = await Promise.all([
        webSearch(searchQuery, 5),
        supabase.from('documents').select('name, parsed_chunks').eq('engagement_id', id),
      ]);
      const docContext = (docs ?? []).map(d => {
        const chunks = Array.isArray(d.parsed_chunks) ? (d.parsed_chunks as Array<{ text: string }>).map(c => c.text).join('\n') : '';
        return `Document [${d.name}]:\n${chunks}`;
      }).join('\n\n');

      let connectedAppDataStr = '';
      let connectorInstructions = '';
      if (connectedAppIds) {
        const ids = connectedAppIds.split(',');
        const activeConnectors = connectors.filter(c => ids.includes(c.id));
        const connectorSystemIds = activeConnectors.map(c => c.connector_id);
        connectorInstructions = getConnectorInstructions(connectorSystemIds);
        
        const rawDataItems = [];
        for (const conn of activeConnectors) {
          updateStream(`Fetching live data from ${conn.display_name}...`);
          try {
            let creds = conn.credentials;
            if (typeof creds === 'string') creds = JSON.parse(creds);
            const data = await fetchConsolidatedData(conn.connector_id, conn.display_name, creds);
            rawDataItems.push({ source: conn.display_name, type: conn.connector_id, data: data.streams || data });
            await new Promise(r => setTimeout(r, 1200)); // Artificial delay for UI UX
          } catch (err) {
            console.warn(`Failed to fetch data from ${conn.display_name}.`, err);
          }
        }
        
        if (rawDataItems.length > 0) {
          updateStream('Vectorizing data to Pinecone (RAG)...');
          try {
            await indexDataToPinecone(id, rawDataItems);
          } catch (err) {
            console.error('Pinecone index failed', err);
          }
        }
      }

      updateStream('Searching vector database for context...');
      try {
        const ragContext = await queryPinecone(id, searchQuery, 10);
        if (ragContext.length > 0) {
          connectedAppDataStr = `Retrieved RAG Context (from Documents & Connected Apps):\n` + ragContext.join('\n\n---\n\n');
        }
      } catch (err) {
        console.error('Pinecone RAG query failed', err);
      }

      updateStream('Synthesizing findings & drafting citations...');
      const newFindings = await runResearchBranch(engagement!, node, webResults, docContext, connectedAppDataStr, connectorInstructions);
      
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
      const { data: inserted } = await supabase.from('findings').insert(
        newFindings.map(f => ({ engagement_id: id, issue_node_id: node.id, content: f.content, source_url: f.source_url ?? null, source_title: f.source_title ?? null, confidence: f.confidence ?? 'estimate', retrieved_at: f.retrieved_at ?? new Date().toISOString() }))
      ).select();
      if (inserted) {
        setFindings(prev => [...prev.filter(f => f.issue_node_id !== node.id), ...(inserted as Finding[])]);
        await saveStageOutput(id, 'research', { latest_branch: node.label, total_findings: findings.length + inserted.length, last_researched_at: new Date().toISOString() });
      }
      setBranchStatus(prev => ({ ...prev, [node.id]: 'done' }));
      await finishStageRun(runId, 'done');
    } catch (err: unknown) {
      await finishStageRun(runId, 'error');
      setBranchStatus(prev => ({ ...prev, [node.id]: 'error' }));
      const msg = err instanceof Error ? err.message : 'Research failed. Check API keys.';
      setApiError(msg);
    }
  }

  async function runAllBranches() {
    setRunningAll(true);
    for (const node of scopedNodes) {
      if (branchStatus[node.id] !== 'done') await runBranch(node);
    }
    setRunningAll(false);
  }

  async function handleApprove() {
    if (!id) return;
    setApproving(true);
    await supabase.from('engagements').update({ stage: 'analysis', updated_at: new Date().toISOString() }).eq('id', id);
    const counts = { verified: findings.filter(f => f.confidence === 'verified').length, estimate: findings.filter(f => f.confidence === 'estimate').length, assumption: findings.filter(f => f.confidence === 'assumption').length };
    await saveStageOutput(id, 'research', { total_findings: findings.length, ...counts, approved_at: new Date().toISOString() }, 'completed');
    navigate(`/engagement/${id}/analysis`);
  }

  const allDone = scopedNodes.length > 0 && scopedNodes.every(n => branchStatus[n.id] === 'done');
  const selectedNode = nodes.find(n => n.id === selectedBranch);
  const selectedFindings = findings.filter(f => f.issue_node_id === selectedBranch);

  return (
    <AppShell engagementId={id} currentStage="research" completedStages={['scoping', 'issue_tree']}>
      <div className="workflow-layout">
        {/* Left: workflow panel */}
        <div className="workflow-panel">
          <div className="workflow-panel-header">
            <div className="workflow-panel-title">Stage 3</div>
            <div className="workflow-panel-heading">Research</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: 6 }}>
              Run each branch to gather evidence.
            </p>
          </div>

          {apiError && (
            <div className="alert alert-error" style={{ margin: '0 16px 12px', fontSize: '0.8125rem' }}>
              <AlertTriangle size={14} />
              {apiError}
            </div>
          )}

          <div className="branch-list">
            {scopedNodes.map(node => {
              const status = branchStatus[node.id] ?? 'queued';
              const count = findings.filter(f => f.issue_node_id === node.id).length;
              const isSelected = selectedBranch === node.id;
              return (
                <div
                  key={node.id}
                  className={`branch-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedBranch(node.id)}
                >
                  <div className={`branch-status-dot ${status}`} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="branch-label" style={{ fontSize: '0.8125rem' }}>{node.label}</div>
                    {count > 0 && <div className="branch-count">{count} finding{count !== 1 ? 's' : ''}</div>}
                    {status === 'running' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <div className="thinking-dots"><span /><span /><span /></div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>Researching…</span>
                      </div>
                    )}
                  </div>
                  <button
                    className={`branch-run-btn ${status === 'queued' ? 'primary' : ''}`}
                    onClick={e => { e.stopPropagation(); runBranch(node); }}
                    disabled={status === 'running' || runningAll}
                  >
                    {status === 'running' ? <span className="spinner spinner-sm" style={{ width: 10, height: 10 }} /> : <Play size={10} style={{ display: 'inline' }} />}
                    {' '}{status === 'done' ? 'Re-run' : status === 'running' ? '…' : 'Run'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="workflow-panel-footer">
            <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={runAllBranches} disabled={runningAll || allDone}>
              {runningAll ? <span className="spinner spinner-sm" /> : <Play size={13} />}
              {runningAll ? 'Running all…' : 'Run All Branches'}
            </button>
            {allDone && (
              <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={handleApprove} disabled={approving}>
                {approving ? <span className="spinner spinner-sm spinner-gold" /> : <CheckCircle size={14} />}
                Approve & Proceed
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Right: findings */}
        <div className="workflow-main">
          {selectedNode ? (
            <div className="animate-in">
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 6 }}>
                  {selectedNode.label}
                </h2>
                {selectedFindings.length > 0 && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['verified', 'estimate', 'assumption'] as const).map(c => {
                      const count = selectedFindings.filter(f => f.confidence === c).length;
                      return count > 0 ? <ConfidenceBadge key={c} confidence={c} /> : null;
                    })}
                  </div>
                )}
              </div>

              {branchStatus[selectedNode.id] === 'running' ? (
                <div className="stage-thinking" style={{ padding: '32px 40px', alignItems: 'flex-start', textAlign: 'left' }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div className="stage-thinking-icon" style={{ margin: 0 }}>
                      <Play size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ marginBottom: 4 }}>Researching this branch</h3>
                      <p style={{ fontSize: '0.875rem', margin: 0 }}>Cross-referencing web data and internal sources...</p>
                      
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
              ) : selectedFindings.length === 0 ? (
                <div style={{ padding: '56px 32px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--r-lg)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No findings yet. Run this branch to gather evidence.</p>
                </div>
              ) : (
                <div>
                  {selectedFindings.map((f, i) => (
                    <div key={f.id} className="finding-row">
                      <div className="finding-num">{String(i + 1).padStart(2, '0')}</div>
                      <div className="finding-body">
                        <p className="finding-text">{f.content}</p>
                        <div className="finding-footer">
                          <ConfidenceBadge confidence={f.confidence} />
                          {f.source_url && (
                            <a href={f.source_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                              <ExternalLink size={11} />
                              {f.source_title ?? f.source_url}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '80px 32px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Select a branch from the left to view findings.</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
