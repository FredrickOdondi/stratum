import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, ArrowRight, FileText, Link2, FileSpreadsheet, FileImage, File, Trash2 } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { StageBadge } from '../../components/engagement/Badges';
import { DeleteEngagementModal } from '../../components/engagement/DeleteEngagementModal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { loadConnectors, type ConnectorCredential } from '../../lib/connectorStorage';
import { AI_TEAM } from '../../lib/agents';
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

export function DashboardPage() {
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

  const stats = {
    total: engagements.length,
    active: engagements.filter(e => !['delivered'].includes(e.stage)).length,
    delivered: engagements.filter(e => e.stage === 'delivered').length,
  };

  const handle = user?.email?.split('@')[0] ?? 'there';
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour >= 5 && hour < 12) greeting = 'Good morning';
  else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';

  return (
    <AppShell>
      <div style={{ padding: '48px', maxWidth: '1280px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '48px' }}>
          <div>
            <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '10px' }}>
              Stratum Advisory
            </p>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {greeting}, {handle}.
            </h1>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
              {stats.active} active engagement{stats.active !== 1 ? 's' : ''} in progress.
            </p>
          </div>
          <button className="btn btn-gold" onClick={() => navigate('/engagement/new')}>
            <Plus size={14} />
            New Engagement
          </button>
        </div>

        {/* Metrics Rail */}
        <div style={{ display: 'flex', alignItems: 'stretch', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '28px 0', marginBottom: '48px' }}>
          {[
            { label: 'Total', value: stats.total, color: 'var(--text-primary)' },
            { label: 'In Progress', value: stats.active, color: 'var(--accent)' },
            { label: 'Delivered', value: stats.delivered, color: 'var(--success)' },
          ].map((m, i) => (
            <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: i === 0 ? '0 32px 0 0' : i === 2 ? '0 0 0 32px' : '0 32px', borderLeft: i > 0 ? '1px solid var(--border)' : undefined }}>
              <span style={{ fontSize: '2.75rem', fontWeight: 700, letterSpacing: '-0.04em', color: m.color, lineHeight: 1 }}>
                {m.value}
              </span>
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginTop: '10px' }}>
                {m.label}
              </span>
            </div>
          ))}
        </div>

        {/* Main Content Grid (Two-Column Layout) */}
        <div className="dashboard-grid">
          
          {/* Left Column: Engagements */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--t3)' }}>
                Recent Engagements
              </p>
              <button
                onClick={() => navigate('/engagements')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', fontSize: '0.75rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                View All <ArrowRight size={12} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {loading ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 160, borderRadius: 'var(--r-lg)' }} />
            ))
          ) : engagements.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '80px 40px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
              <FileText style={{ opacity: 0.12, width: 44, height: 44, margin: '0 auto 16px', display: 'block' }} />
              <h3 style={{ fontSize: '1.125rem', color: 'var(--text-primary)', marginBottom: '6px' }}>No engagements yet</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Create one to get started.</p>
            </div>
          ) : (
            engagements.slice(0, 6).map((eng) => (
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

          {/* Right Column: AI Team & Integrations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
            
            {/* My Team (AI Agents) */}
            <div>
              <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 16 }}>
                My Team
              </p>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {AI_TEAM.map((agent) => (
                    <div 
                      key={agent.id} 
                      onClick={() => navigate(`/agent/${agent.id}`)}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: 12, 
                        padding: '8px', borderRadius: '8px',
                        cursor: 'pointer', transition: 'background-color 0.2s ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-3)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <img src={agent.avatar} alt={agent.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--t1)' }}>{agent.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--t2)', marginTop: 2 }}>{agent.role}</div>
                      </div>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0, boxShadow: '0 0 0 2px var(--bg)' }} title="Online" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Connected Integrations */}
            {connectors.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--t3)' }}>
                    Integrations
                  </p>
                  <button
                    onClick={() => navigate('/platform/connectors')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', fontSize: '0.75rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    Manage <ArrowRight size={12} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {connectors.map(conn => {
                    const domain = DOMAIN_MAP[conn.connector_id];
                    const icon = ICON_OVERRIDE[conn.connector_id];
                    const label = conn.display_name || conn.connector_id.replace(/_/g, ' ');

                    return (
                      <div
                        key={conn.id}
                        title={label}
                        onClick={() => navigate('/platform/connectors')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 14px', borderRadius: 'var(--r8)',
                          border: '1px solid var(--b2)',
                          background: 'var(--bg-2)',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--gold)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--b2)'; }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: 6,
                          background: icon ? '#00C3F7' : 'var(--bg)',
                          border: '1px solid var(--b1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, overflow: 'hidden',
                        }}>
                          {icon
                            ? <img src={icon} alt={label} style={{ width: 18, height: 18, objectFit: 'contain' }} />
                            : domain
                              ? <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt={label} style={{ width: 16, height: 16, objectFit: 'contain' }} />
                              : <Link2 size={14} color="var(--t3)" />}
                        </div>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--t1)', fontWeight: 500, textTransform: 'capitalize' }}>
                          {label}
                        </span>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
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
