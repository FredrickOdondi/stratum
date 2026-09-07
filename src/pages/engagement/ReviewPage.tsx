import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MessageSquare, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { ReviewStatusBadge } from '../../components/engagement/Badges';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { saveStageOutput } from '../../lib/engagementStages';
import { indexDataToPinecone } from '../../lib/pinecone';
import type { Engagement, ReviewRequest, ReviewComment, Deliverable } from '../../types';

export function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [_engagement, setEngagement] = useState<Engagement | null>(null);
  const [reviewRequest, setReviewRequest] = useState<ReviewRequest | null>(null);
  const [deliverable, setDeliverable] = useState<Deliverable | null>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sectionRef, setSectionRef] = useState('General');
  const [submitting, setSubmitting] = useState(false);
  const [actioning, setActioning] = useState(false);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    if (!id) return;
    const [{ data: eng }, { data: rr }, { data: del }] = await Promise.all([
      supabase.from('engagements').select('*').eq('id', id).single(),
      supabase.from('review_requests').select('*').eq('engagement_id', id).order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('deliverables').select('*').eq('engagement_id', id).eq('is_current', true).maybeSingle(),
    ]);
    if (eng) setEngagement(eng as Engagement);
    if (rr) {
      setReviewRequest(rr as ReviewRequest);
      const { data: comms } = await supabase.from('review_comments').select('*').eq('review_request_id', rr.id).order('created_at');
      if (comms) setComments(comms as ReviewComment[]);
    }
    if (del) setDeliverable(del as Deliverable);
  }

  async function submitComment() {
    if (!reviewRequest || !user || !newComment.trim()) return;
    setSubmitting(true);
    const { data } = await supabase.from('review_comments').insert({
      review_request_id: reviewRequest.id,
      reviewer_id: user.id,
      section_ref: sectionRef,
      body: newComment,
      resolved: false,
      created_at: new Date().toISOString(),
    }).select().single();
    if (data) setComments(prev => [...prev, data as ReviewComment]);
    setNewComment('');
    setSubmitting(false);
  }

  async function handleSignOff() {
    if (!reviewRequest || !user) return;
    setActioning(true);
    await Promise.all([
      supabase.from('review_requests').update({ status: 'signed_off', reviewer_id: user.id, resolved_at: new Date().toISOString() }).eq('id', reviewRequest.id),
      supabase.from('engagements').update({ stage: 'delivered', updated_at: new Date().toISOString() }).eq('id', id),
    ]);

    if (id) {
      await saveStageOutput(id, 'in_review', {
        review_request_id: reviewRequest.id,
        status: 'signed_off',
        reviewer_id: user.id,
        comments_count: comments.length,
        resolved_at: new Date().toISOString(),
      }, 'completed');

      await saveStageOutput(id, 'delivered', {
        signed_off_by: user.id,
        deliverable_id: deliverable?.id,
        delivered_at: new Date().toISOString(),
      }, 'completed');

      // ─── PINECONE INTEGRATION ───
      // Push the finalized deliverable back into the vector database
      if (deliverable?.document) {
        const dataItems = [];
        const doc = deliverable.document;

        if (doc.executive_summary) {
          dataItems.push({
            content: `Executive Summary: ${doc.executive_summary}`,
            type: 'final_deliverable_summary',
            source: 'final_deliverable'
          });
        }

        if (doc.claims && doc.claims.length > 0) {
          doc.claims.forEach((claim: any) => {
            dataItems.push({
              content: `Finalized Claim (${claim.type}): ${claim.text}`,
              type: 'final_deliverable_claim',
              source: 'final_deliverable'
            });
          });
        }

        if (dataItems.length > 0) {
          try {
            await indexDataToPinecone(id, dataItems);
            console.log('Successfully indexed finalized deliverable to Pinecone.');
          } catch (err) {
            console.error('Failed to index deliverable to Pinecone:', err);
          }
        }
      }
    }

    await loadData();
    setActioning(false);
  }

  async function handleRequestChanges() {
    if (!reviewRequest) return;
    setActioning(true);
    await supabase.from('review_requests').update({ status: 'changes_requested', resolved_at: new Date().toISOString() }).eq('id', reviewRequest.id);
    await supabase.from('engagements').update({ stage: 'deliverable', updated_at: new Date().toISOString() }).eq('id', id);

    if (id) {
      await saveStageOutput(id, 'in_review', {
        review_request_id: reviewRequest.id,
        status: 'changes_requested',
        comments_count: comments.length,
        resolved_at: new Date().toISOString(),
      }, 'in_progress');
    }

    await loadData();
    setActioning(false);
  }

  return (
    <AppShell engagementId={id} currentStage="in_review" completedStages={['scoping', 'issue_tree', 'research', 'analysis', 'synthesis', 'quality_check', 'deliverable']}>
      <div className="page-narrow">
        <div className="page-header">
          <div className="badge badge-gold" style={{ marginBottom: 12 }}>Stage 8 — Expert Review</div>
          <h1 className="page-title">Review & Sign-off</h1>
          <p>Expert reviewer comments, requests changes, or signs off. Sign-off adds a review badge to the deliverable.</p>
        </div>

        {reviewRequest && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <ReviewStatusBadge status={reviewRequest.status} />
            <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
              Submitted {new Date(reviewRequest.submitted_at).toLocaleDateString()}
            </span>
          </div>
        )}

        {reviewRequest?.status === 'signed_off' && (
          <div className="review-badge mb-6" style={{ display: 'inline-flex' }}>
            <CheckCircle size={14} />
            Expert Reviewed & Signed Off
          </div>
        )}

        {/* Deliverable snapshot */}
        {deliverable?.document && (
          <div className="card mb-6">
            <h3 className="card-title" style={{ marginBottom: 8 }}>"{deliverable.document.governing_thought}"</h3>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.65, margin: 0 }}>{deliverable.document.executive_summary?.slice(0, 400)}…</p>
          </div>
        )}

        {/* Comments */}
        <div className="card mb-6">
          <h4 style={{ marginBottom: 16 }}>Reviewer Comments ({comments.length})</h4>
          {comments.length === 0 ? (
            <p style={{ color: 'var(--muted-light)', fontSize: '0.875rem' }}>No comments yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {comments.map(comment => (
                <div key={comment.id} style={{ padding: '12px 16px', background: 'var(--warm-grey)', borderRadius: 'var(--radius)', borderLeft: '3px solid var(--gold)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="badge badge-navy" style={{ fontSize: '0.6875rem' }}>{comment.section_ref}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-light)' }}>
                      {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>{comment.body}</p>
                </div>
              ))}
            </div>
          )}

          {/* Add comment */}
          {reviewRequest?.status !== 'signed_off' && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="divider" style={{ margin: '0 0 4px' }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  className="form-input"
                  style={{ maxWidth: 180 }}
                  placeholder="Section ref"
                  value={sectionRef}
                  onChange={e => setSectionRef(e.target.value)}
                />
                <input
                  className="form-input"
                  placeholder="Add a comment…"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitComment()}
                />
                <button className="btn btn-primary" onClick={submitComment} disabled={submitting || !newComment.trim()}>
                  <MessageSquare size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {reviewRequest?.status !== 'signed_off' && reviewRequest?.status !== 'changes_requested' && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-danger" onClick={handleRequestChanges} disabled={actioning}>
              <XCircle size={15} />
              Request Changes
            </button>
            <button className="btn btn-gold" onClick={handleSignOff} disabled={actioning}>
              {actioning ? <span className="spinner spinner-sm spinner-gold" /> : <CheckCircle size={15} />}
              Sign Off
            </button>
          </div>
        )}

        {reviewRequest?.status === 'changes_requested' && (
          <div className="alert alert-warn">
            <AlertTriangle size={16} />
            Changes have been requested. The owner will revise the deliverable and resubmit.
          </div>
        )}
      </div>
    </AppShell>
  );
}
