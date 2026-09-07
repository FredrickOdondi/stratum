import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowRight, FileText, Link2, FileSpreadsheet, FileImage, File, Trash2 } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { StageBadge } from '../../components/engagement/Badges';
import { DeleteEngagementModal } from '../../components/engagement/DeleteEngagementModal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { loadConnectors, type ConnectorCredential } from '../../lib/connectorStorage';
import type { Engagement } from '../../types';
import { formatDistanceToNow } from 'date-fns';

const DOMAIN_MAP: Record<string, string> = {
  shopify: 'shopify.com', woocommerce: 'woocommerce.com', bigcommerce: 'bigcommerce.com',
  amazon_seller: 'amazon.com', tiktok_shop: 'tiktok.com', stripe: 'stripe.com',
  paystack: 'paystack.com', paypal: 'paypal.com', recharge: 'rechargepayments.com',
  meta_ads: 'meta.com', google_ads: 'google.com', tiktok_ads: 'tiktok.com',
  pinterest_ads: 'pinterest.com', amazon_ads: 'amazon.com', klaviyo: 'klaviyo.com',
  attentive: 'attentive.com', postscript: 'postscript.io', omnisend: 'omnisend.com',
  mailchimp: 'mailchimp.com', ga4: 'google.com', triple_whale: 'triplewhale.com',
  northbeam: 'northbeam.io', yotpo: 'yotpo.com', okendo: 'okendo.io',
  smile: 'smile.io', loox: 'loox.app', shipstation: 'shipstation.com',
  cin7: 'cin7.com', gorgias: 'gorgias.com', zendesk: 'zendesk.com', skio: 'skio.com',
  supabase: 'supabase.com'
};

const ICON_OVERRIDE: Record<string, string> = {
  paystack: 'https://website-v3-assets.s3.amazonaws.com/assets/img/hero/Paystack-mark-white-twitter.png',
  csv: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Jonkerz_Icon_CSV.svg'
};

function getDocIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['csv', 'xlsx', 'xls'].includes(ext || '')) return <FileSpreadsheet size={14} color="var(--green)" />;
  if (['png', 'jpg', 'jpeg', 'svg'].includes(ext || '')) return <FileImage size={14} color="var(--gold)" />;
  if (['pdf'].includes(ext || '')) return <FileText size={14} color="var(--red)" />;
  return <File size={14} color="var(--t3)" />;
}

function getStageRoute(stage: string) {
  if (stage === 'issue_tree') return 'issue-tree';
  if (stage === 'quality_check') return 'quality-check';
  if (stage === 'in_review') return 'review';
  if (stage === 'delivered') return 'deliverable';
  return stage;
}

export function AllEngagementsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectors, setConnectors] = useState<ConnectorCredential[]>([]);
  const [engagementToDelete, setEngagementToDelete] = useState<{id: string, name: string} | null>(null);

  useEffect(() => {
    if (!user) return;
    loadEngagements();
    loadConnectors().then(setConnectors);
  }, [user]);

  async function loadEngagements() {
    setLoading(true);
    const { data, error } = await supabase
      .from('engagements')
      .select('*, intake_answers(field, value), documents(id, name, mime_type)')
      .eq('owner_id', user!.id)
      .order('updated_at', { ascending: false });
    if (!error && data) setEngagements(data as Engagement[]);
    setLoading(false);
  }

  const confirmDelete = async (id: string) => {
    try {
      await supabase.from('engagements').delete().eq('id', id);
      setEngagements(prev => prev.filter(eng => eng.id !== id));
    } catch (err) {
      console.error('Failed to delete engagement', err);
      alert('Failed to delete engagement');
    }
  };

  return (
    <AppShell>
      <div className="page">
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
          >
            <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Back to Dashboard
          </button>
        </div>
        <div className="page-header" style={{ marginBottom: 48 }}>
          <h1 className="page-title">All Engagements</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            A complete history of your active and delivered strategy engagements.
          </p>
        </div>

        {/* Engagement Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {loading ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 160, borderRadius: 'var(--r-lg)' }} />
            ))
          ) : engagements.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '80px 40px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
              <FileText style={{ opacity: 0.12, width: 44, height: 44, margin: '0 auto 16px', display: 'block' }} />
              <h3 style={{ fontSize: '1.125rem', color: 'var(--text-primary)', marginBottom: '6px' }}>No engagements found</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>You haven't created any engagements yet.</p>
            </div>
          ) : (
            engagements.map((eng) => (
              <div
                key={eng.id}
                className="dossier-card"
                onClick={() => navigate(`/engagement/${eng.id}/${getStageRoute(eng.stage)}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                    {eng.client_name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEngagementToDelete({ id: eng.id, name: eng.client_name });
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px', color: 'var(--red)', opacity: 0.6 }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                      title="Delete Engagement"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ArrowRight size={15} className="dossier-arrow" />
                  </div>
                </div>

                <p style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: '20px', flex: 1 }}>
                  {eng.business_question}
                </p>

                {(() => {
                  const appIdsStr = (eng as any).intake_answers?.find((a: any) => a.field === 'connected_app_ids')?.value;
                  const activeApps = appIdsStr ? connectors.filter(c => appIdsStr.split(',').includes(c.id)) : [];
                  const docs = (eng as any).documents || [];
                  
                  if (activeApps.length === 0 && docs.length === 0) return null;
                  
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                      {activeApps.map(app => {
                        const icon = ICON_OVERRIDE[app.connector_id];
                        const domain = DOMAIN_MAP[app.connector_id];
                        return (
                          <div key={app.id} title={app.display_name} style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--b1)', background: icon ? '#00C3F7' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {icon ? <img src={icon} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} /> :
                             domain ? <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" style={{ width: 12, height: 12, objectFit: 'contain' }} /> :
                             <Link2 size={12} color="var(--t3)" />}
                          </div>
                        );
                      })}
                      {docs.map((doc: any) => (
                        <div key={doc.id} title={doc.name} style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--b1)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {getDocIcon(doc.name)}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <StageBadge stage={eng.stage} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                    <Clock size={11} />
                    {formatDistanceToNow(new Date(eng.updated_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      <DeleteEngagementModal
        isOpen={!!engagementToDelete}
        onClose={() => setEngagementToDelete(null)}
        onConfirm={() => {
          if (engagementToDelete) confirmDelete(engagementToDelete.id);
        }}
        clientName={engagementToDelete?.name || ''}
      />
    </AppShell>
  );
}
