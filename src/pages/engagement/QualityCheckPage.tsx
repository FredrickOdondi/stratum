import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, CheckCircle, ArrowRight, AlertTriangle, Info, Lightbulb } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { supabase } from '../../lib/supabase';
import { runQualityCheck, autoFixDeliverable } from '../../lib/openai';
import { saveStageOutput } from '../../lib/engagementStages';
import { startStageRun, finishStageRun } from '../../lib/audit';
import type { Engagement, Claim, DeliverableDocument, QualityFlag } from '../../types';

export function QualityCheckPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [_engagement, setEngagement] = useState<Engagement | null>(null);
  const [deliverable, setDeliverable] = useState<DeliverableDocument | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [flags, setFlags] = useState<QualityFlag[]>([]);
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);
  const [approving, setApproving] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    if (!id) return;
    const [{ data: eng }, { data: delData }, { data: claimData }] = await Promise.all([
      supabase.from('engagements').select('*').eq('id', id).single(),
      supabase.from('deliverables').select('*').eq('engagement_id', id).eq('is_current', true).maybeSingle(),
      supabase.from('claims').select('*').eq('engagement_id', id),
    ]);
    if (eng) setEngagement(eng as Engagement);
    if (delData) setDeliverable((delData as { document: DeliverableDocument }).document);
    if (claimData) setClaims(claimData as Claim[]);
  }

  async function handleRun() {
    if (!deliverable || !id) return;
    setRunning(true);
    setError('');
    const runId = await startStageRun(id, 'quality_check', 'gpt-4o');
    try {
      const result = await runQualityCheck(deliverable, claims);
      setFlags(result);
      setRan(true);

      await saveStageOutput(id, 'quality_check', {
        flags_count: result.length,
        critical_count: result.filter(f => f.severity === 'critical').length,
        warning_count: result.filter(f => f.severity === 'warning').length,
        suggestion_count: result.filter(f => f.severity === 'suggestion').length,
        flags: result,
        checked_at: new Date().toISOString(),
      });

      await finishStageRun(runId, 'done');
    } catch (err: unknown) {
      console.error('QA pass error:', err);
      await finishStageRun(runId, 'error');
      const msg = err instanceof Error ? err.message : 'QA pass failed. Please retry.';
      setError(msg);
    }
    setRunning(false);
  }

  function toggleFlag(flagId: string) {
    setFlags(prev => prev.map(f => f.id === flagId ? { ...f, resolved: !f.resolved } : f));
  }

  async function handleAutoFix() {
    if (!deliverable || !id) return;
    setIsFixing(true);
    setError('');
    const runId = await startStageRun(id, 'quality_check_autofix', 'gpt-4o');
    
    try {
      // 1. Run the auto-fix agent
      const updatedDeliverable = await autoFixDeliverable(deliverable, flags);
      
      // 2. Archive current version and save new one
      await supabase.from('deliverables').update({ is_current: false }).eq('engagement_id', id);
      
      // We need to fetch the max version to increment it. 
      // A quick shortcut since we know there's at least one: 
      const { data: allDocs } = await supabase.from('deliverables').select('version').eq('engagement_id', id);
      const nextVersion = allDocs ? Math.max(...allDocs.map(d => d.version)) + 1 : 1;
      
      await supabase.from('deliverables').insert({ 
        engagement_id: id, 
        version: nextVersion, 
        document: updatedDeliverable, 
        is_current: true, 
        created_at: new Date().toISOString() 
      });

      // 3. Update local state
      setDeliverable(updatedDeliverable);
      
      // 4. Mark unresolved flags as resolved
      setFlags(prev => prev.map(f => ({ ...f, resolved: true })));
      
      await finishStageRun(runId, 'done');
    } catch (err: unknown) {
      console.error('Auto-fix error:', err);
      await finishStageRun(runId, 'error');
      const msg = err instanceof Error ? err.message : 'Auto-fix failed. Please retry.';
      setError(msg);
    }
    setIsFixing(false);
  }

  async function handleApprove() {
    if (!id) return;
    setApproving(true);
    await supabase.from('engagements').update({ stage: 'deliverable', updated_at: new Date().toISOString() }).eq('id', id);

    await saveStageOutput(id, 'quality_check', {
      passed: criticals.length === 0,
      total_flags: flags.length,
      resolved_flags: flags.filter(f => f.resolved).length,
      unresolved_criticals: criticals.length,
      approved_at: new Date().toISOString(),
    }, 'completed');

    navigate(`/engagement/${id}/deliverable`);
  }

  const criticals = flags.filter(f => f.severity === 'critical' && !f.resolved);

  const severityIcon = (s: string) => {
    if (s === 'critical') return <AlertTriangle size={14} />;
    if (s === 'warning') return <Info size={14} />;
    return <Lightbulb size={14} />;
  };
  const severityClass = (s: string) => s === 'critical' ? 'alert-error' : s === 'warning' ? 'alert-warn' : 'alert-info';

  return (
    <AppShell engagementId={id} currentStage="quality_check" completedStages={['scoping', 'issue_tree', 'research', 'analysis', 'synthesis']}>
      <div className="page-narrow">
        <div className="page-header">
          <div className="badge badge-gold" style={{ marginBottom: 12 }}>Stage 6 — Quality Check</div>
          <h1 className="page-title">Red-team QA</h1>
          <p>An independent agent reviews the deliverable for unsupported claims, logic gaps, and contradictions before it goes to the client.</p>
        </div>

        {!ran ? (
          <div className={`card ${running ? 'analyzing-card' : ''}`} style={{ textAlign: 'center', padding: '48px 28px' }}>
            {running && <div className="analyzing-scan-line" />}
            <div className={running ? 'analyzing-icon-pulse' : ''} style={{ width: 52, height: 52, background: 'var(--navy)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', position: 'relative', zIndex: 2, transition: 'all 0.3s ease' }}>
              <Shield size={22} style={{ color: 'var(--gold)' }} />
            </div>
            <h3 style={{ marginBottom: 8, position: 'relative', zIndex: 2 }}>
              {running ? (
                <span className="analyzing-text-shimmer">Analysing Deliverable...</span>
              ) : (
                'Run Red-team Check'
              )}
            </h3>
            
            {running ? (
              <p style={{ maxWidth: 420, margin: '0 auto', position: 'relative', zIndex: 2, color: 'var(--t3)', fontSize: '0.875rem' }}>
                Cross-referencing claims against source documents and fact-checking statements...
              </p>
            ) : (
              <>
                <p style={{ maxWidth: 420, margin: '0 auto 24px', position: 'relative', zIndex: 2 }}>
                  Reviews the entire deliverable for unsupported claims, logical gaps, and internal contradictions.
                  Flags appear as an inline checklist you resolve or accept.
                </p>
                {error && <div className="alert alert-error" style={{ marginBottom: 16, position: 'relative', zIndex: 2 }}>{error}</div>}
                <button className="btn btn-gold btn-lg" style={{ position: 'relative', zIndex: 2 }} onClick={handleRun} disabled={running}>
                  <Shield size={16} />
                  Run QA Pass
                </button>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Summary row */}
            <div className="grid-3">
              <div className="card card-sm" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontFamily: 'var(--font-sans)', fontWeight: 600, color: 'var(--error)' }}>{flags.filter(f => f.severity === 'critical').length}</div>
                <p style={{ fontSize: '0.8125rem', margin: 0 }}>Critical</p>
              </div>
              <div className="card card-sm" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontFamily: 'var(--font-sans)', fontWeight: 600, color: 'var(--warn)' }}>{flags.filter(f => f.severity === 'warning').length}</div>
                <p style={{ fontSize: '0.8125rem', margin: 0 }}>Warnings</p>
              </div>
              <div className="card card-sm" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontFamily: 'var(--font-sans)', fontWeight: 600, color: 'var(--success)' }}>{flags.filter(f => f.resolved).length}</div>
                <p style={{ fontSize: '0.8125rem', margin: 0 }}>Resolved</p>
              </div>
            </div>

            {criticals.length > 0 && (
              <div className="alert alert-error">
                <AlertTriangle size={16} />
                {criticals.length} critical issue{criticals.length > 1 ? 's' : ''} must be resolved before proceeding to the deliverable.
              </div>
            )}

            {flags.length === 0 ? (
              <div className="alert alert-success">
                <CheckCircle size={16} />
                No issues found. The deliverable passed the QA review.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {flags.map(flag => (
                  <div key={flag.id} className={`alert ${severityClass(flag.severity)}`} style={{ opacity: flag.resolved ? 0.5 : 1 }}>
                    {severityIcon(flag.severity)}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.8125rem' }}>
                        {flag.section_ref && <span style={{ opacity: 0.7, marginRight: 6 }}>[{flag.section_ref}]</span>}
                        {flag.severity.toUpperCase()}
                      </div>
                      <div>{flag.issue}</div>
                    </div>
                    <button
                      className="btn btn-sm btn-outline"
                      style={{ flexShrink: 0, fontSize: '0.75rem' }}
                      onClick={() => toggleFlag(flag.id)}
                    >
                      {flag.resolved ? 'Unresolve' : 'Resolve'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
              <button className="btn btn-outline" onClick={handleRun} disabled={running || isFixing}>
                {running ? <span className="spinner spinner-sm" /> : <Shield size={15} />}
                Re-run QA
              </button>
              
              <div style={{ display: 'flex', gap: 10 }}>
                {flags.some(f => !f.resolved) && (
                  <button className="btn btn-outline" onClick={handleAutoFix} disabled={isFixing || running}>
                    {isFixing ? <span className="spinner spinner-sm" /> : <Shield size={15} style={{ color: 'var(--gold)' }} />}
                    {isFixing ? 'Fixing with AI...' : 'Auto-Fix Issues with AI'}
                  </button>
                )}
                <button className="btn btn-gold" onClick={handleApprove} disabled={approving || isFixing || criticals.length > 0}>
                  {approving ? <span className="spinner spinner-sm spinner-gold" /> : <CheckCircle size={15} />}
                  {criticals.length > 0 ? `Resolve ${criticals.length} critical issue${criticals.length > 1 ? 's' : ''} first` : 'Proceed to Deliverable'}
                  {criticals.length === 0 && <ArrowRight size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
