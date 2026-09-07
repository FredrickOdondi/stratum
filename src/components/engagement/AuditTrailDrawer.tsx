import { useState, useEffect } from 'react';
import { X, Clock, RefreshCw, Cpu, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { getStageRuns } from '../../lib/audit';
import { supabase } from '../../lib/supabase';
import type { StageRun, EngagementStageRecord } from '../../types';
import { STAGE_META } from '../../types';

interface AuditTrailDrawerProps {
  engagementId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AuditTrailDrawer({ engagementId, isOpen, onClose }: AuditTrailDrawerProps) {
  const [runs, setRuns] = useState<StageRun[]>([]);
  const [stageRecords, setStageRecords] = useState<EngagementStageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'runs' | 'snapshots'>('runs');
  const [selectedSnapshot, setSelectedSnapshot] = useState<EngagementStageRecord | null>(null);

  useEffect(() => {
    if (isOpen && engagementId) {
      loadData();
    }
  }, [isOpen, engagementId]);

  async function loadData() {
    setLoading(true);
    try {
      const [runsData, { data: stagesData }] = await Promise.all([
        getStageRuns(engagementId),
        supabase.from('engagement_stages').select('*').eq('engagement_id', engagementId).order('created_at'),
      ]);
      setRuns(runsData);
      if (stagesData) {
        setStageRecords(stagesData as EngagementStageRecord[]);
        if (!selectedSnapshot && stagesData.length > 0) {
          const completedWithMeta = (stagesData as EngagementStageRecord[]).find(
            s => s.metadata && Object.keys(s.metadata).length > 0
          );
          setSelectedSnapshot(completedWithMeta || stagesData[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load audit trail:', err);
    }
    setLoading(false);
  }

  if (!isOpen) return null;

  const calculateDuration = (start: string, end: string | null) => {
    if (!end) return 'In progress';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(26, 39, 68, 0.45)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 580,
          maxWidth: '90vw',
          height: '100%',
          background: 'var(--bg-2)',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--border)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--t1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} style={{ color: 'var(--gold)' }} />
              <h3 style={{ margin: 0, color: 'var(--t1)', fontSize: '1.125rem' }}>Audit Trail & History</h3>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--t3)' }}>
              Execution runs, token telemetry, and stage data snapshots
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={loadData}
              disabled={loading}
              title="Refresh"
              style={{ color: 'var(--t2)' }}
            >
              <RefreshCw size={14} className={loading ? 'spinner-sm' : ''} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              title="Close"
              style={{ color: 'var(--t2)' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-2)',
            padding: '0 24px',
          }}
        >
          <button
            onClick={() => setActiveTab('runs')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: activeTab === 'runs' ? 600 : 400,
              color: activeTab === 'runs' ? 'var(--t1)' : 'var(--t3)',
              borderBottom: activeTab === 'runs' ? '2px solid var(--gold)' : '2px solid transparent',
            }}
          >
            AI Runs ({runs.length})
          </button>
          <button
            onClick={() => setActiveTab('snapshots')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: activeTab === 'snapshots' ? 600 : 400,
              color: activeTab === 'snapshots' ? 'var(--t1)' : 'var(--t3)',
              borderBottom: activeTab === 'snapshots' ? '2px solid var(--gold)' : '2px solid transparent',
            }}
          >
            Stage Snapshots ({stageRecords.length})
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
              <span className="spinner spinner-gold" />
            </div>
          ) : activeTab === 'runs' ? (
            runs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--muted)' }}>
                <Clock size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p>No agent runs recorded yet.</p>
                <p style={{ fontSize: '0.8125rem' }}>Runs will appear automatically as AI agents execute.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {runs.map(run => {
                  const meta = STAGE_META[run.stage];
                  return (
                    <div
                      key={run.id}
                      style={{
                        padding: 16,
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="badge badge-gold" style={{ fontSize: '0.75rem' }}>
                            {meta?.label ?? run.stage}
                          </span>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color:
                                run.status === 'done'
                                  ? 'var(--success)'
                                  : run.status === 'error'
                                  ? 'var(--error)'
                                  : 'var(--warn)',
                            }}
                          >
                            {run.status === 'done' ? (
                              <CheckCircle2 size={13} />
                            ) : run.status === 'error' ? (
                              <AlertCircle size={13} />
                            ) : (
                              <Loader2 size={13} className="spinner-sm" />
                            )}
                            {run.status.toUpperCase()}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {new Date(run.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: 8,
                          paddingTop: 8,
                          borderTop: '1px solid var(--border)',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <div>
                          <div style={{ color: 'var(--muted)', fontSize: '0.6875rem' }}>MODEL</div>
                          <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Cpu size={12} style={{ color: 'var(--gold)' }} />
                            {run.model ?? 'gpt-4o'}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--muted)', fontSize: '0.6875rem' }}>DURATION</div>
                          <div style={{ fontWeight: 500 }}>{calculateDuration(run.started_at, run.finished_at)}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--muted)', fontSize: '0.6875rem' }}>TOKENS</div>
                          <div style={{ fontWeight: 500 }}>{run.token_count ? `~${run.token_count}` : '—'}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div>
              {/* Stage buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {stageRecords.map(st => {
                  const isSelected = selectedSnapshot?.id === st.id;
                  const hasMeta = st.metadata && Object.keys(st.metadata).length > 0;
                  return (
                    <button
                      key={st.id}
                      onClick={() => setSelectedSnapshot(st)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: '0.75rem',
                        border: isSelected ? '1.5px solid var(--gold)' : '1px solid var(--border)',
                        background: isSelected ? 'var(--bg-hover)' : hasMeta ? 'var(--bg-3)' : 'var(--bg)',
                        color: isSelected ? 'var(--t1)' : 'var(--t2)',
                        cursor: 'pointer',
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      {STAGE_META[st.stage]?.label ?? st.stage}
                      {hasMeta && <span style={{ marginLeft: 4, color: isSelected ? 'var(--gold)' : 'var(--muted)' }}>•</span>}
                    </button>
                  );
                })}
              </div>

              {selectedSnapshot && (
                <div
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'var(--bg)',
                    padding: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h4 style={{ margin: 0, color: 'var(--t1)' }}>
                      {STAGE_META[selectedSnapshot.stage]?.label} Snapshot
                    </h4>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background:
                          selectedSnapshot.status === 'completed'
                            ? 'var(--success-dim)'
                            : selectedSnapshot.status === 'in_progress'
                            ? 'var(--warn-dim)'
                            : 'var(--bg-3)',
                        color:
                          selectedSnapshot.status === 'completed'
                            ? 'var(--success)'
                            : selectedSnapshot.status === 'in_progress'
                            ? 'var(--warn)'
                            : 'var(--muted)',
                      }}
                    >
                      {selectedSnapshot.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: 12 }}>
                    <div>Started: {selectedSnapshot.started_at ? new Date(selectedSnapshot.started_at).toLocaleString() : 'Pending'}</div>
                    <div>Completed: {selectedSnapshot.completed_at ? new Date(selectedSnapshot.completed_at).toLocaleString() : 'Not completed'}</div>
                  </div>

                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
                    PERSISTED JSON DATA
                  </div>
                  <pre
                    style={{
                      background: 'var(--bg-4)',
                      color: 'var(--t1)',
                      padding: 12,
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      maxHeight: 340,
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {JSON.stringify(selectedSnapshot.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
