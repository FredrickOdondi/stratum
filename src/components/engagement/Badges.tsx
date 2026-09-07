import type { Confidence, EngagementStage } from '../../types';
import { STAGE_META } from '../../types';

// ─── Confidence Badge ─────────────────────────────────────────────────────────
export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const labels: Record<Confidence, string> = {
    verified: '● Verified',
    estimate: '● Estimate',
    assumption: '● Assumption',
  };
  return (
    <span className={`badge confidence-${confidence}`} style={{ fontSize: '0.6875rem' }}>
      {labels[confidence]}
    </span>
  );
}

// ─── Stage Badge ──────────────────────────────────────────────────────────────
export function StageBadge({ stage }: { stage: EngagementStage }) {
  const meta = STAGE_META[stage];
  return (
    <span className={`badge stage-${stage}`}>
      {meta.label}
    </span>
  );
}

// ─── Priority Badge ───────────────────────────────────────────────────────────
export function PriorityBadge({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const map = {
    high: 'badge-error',
    medium: 'badge-warn',
    low: 'badge-success',
  };
  return <span className={`badge ${map[priority]}`}>{priority}</span>;
}

// ─── Review Status Badge ──────────────────────────────────────────────────────
export function ReviewStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'badge-muted',
    in_review: 'badge-gold',
    changes_requested: 'badge-error',
    signed_off: 'badge-success',
  };
  const labels: Record<string, string> = {
    pending: 'Pending Review',
    in_review: 'In Review',
    changes_requested: 'Changes Requested',
    signed_off: '✓ Signed Off',
  };
  return <span className={`badge ${map[status] ?? 'badge-muted'}`}>{labels[status] ?? status}</span>;
}
