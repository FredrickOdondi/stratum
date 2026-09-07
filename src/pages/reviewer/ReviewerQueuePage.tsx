import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, ArrowRight } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { ReviewStatusBadge } from '../../components/engagement/Badges';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface QueueItem {
  id: string;
  engagement_id: string;
  status: string;
  submitted_at: string;
  client_name: string;
  business_question: string;
}

export function ReviewerQueuePage() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 5;

  useEffect(() => { loadQueue(); }, [currentPage]);

  async function loadQueue() {
    setLoading(true);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize - 1;

    const { data, count } = await supabase
      .from('review_requests')
      .select('*, engagements(client_name, business_question)', { count: 'exact' })
      .order('submitted_at', { ascending: false })
      .range(start, end);

    if (data) {
      setQueue(data.map((r: { id: string; engagement_id: string; status: string; submitted_at: string; engagements: { client_name: string; business_question: string } }) => ({
        id: r.id,
        engagement_id: r.engagement_id,
        status: r.status,
        submitted_at: r.submitted_at,
        client_name: r.engagements?.client_name ?? 'Unknown',
        business_question: r.engagements?.business_question ?? '',
      })));
    }
    if (count !== null) {
      setTotalPages(Math.ceil(count / pageSize));
    }
    setLoading(false);
  }

  return (
    <AppShell>
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Review Queue</h1>
          <p>Engagements submitted for expert review. Sign off or request changes inline.</p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />)}
          </div>
        ) : queue.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <CheckSquare className="empty-icon" />
              <h3>Queue is empty</h3>
              <p>No engagements have been submitted for review yet.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {queue.map(item => (
              <div
                key={item.id}
                className="engagement-card"
                onClick={() => navigate(`/engagement/${item.engagement_id}/review`)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div className="engagement-card-client">{item.client_name}</div>
                    <div className="engagement-card-question">{item.business_question}</div>
                    <div className="engagement-card-meta">
                      <ReviewStatusBadge status={item.status} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted-light)' }}>
                        {formatDistanceToNow(new Date(item.submitted_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <ArrowRight size={18} style={{ color: 'var(--warm-grey2)', marginTop: 4, flexShrink: 0 }} />
                </div>
              </div>
            ))}
            
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 32 }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 'var(--radius-md)', color: currentPage === 1 ? 'var(--muted-light)' : 'var(--text-primary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}
                >
                  Previous
                </button>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 'var(--radius-md)', color: currentPage === totalPages ? 'var(--muted-light)' : 'var(--text-primary)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
