import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  CheckSquare,
  LogOut,
  Check,
  Lock,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Sun,
  Moon,
  Link2,
  Database,
  MessageSquare,
  Home,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { supabase } from '../../lib/supabase';
import { AuditTrailDrawer } from '../engagement/AuditTrailDrawer';
import type { EngagementStage, IssueNode, EngagementStageRecord } from '../../types';
import { AppLogo } from './AppLogo';
import { STAGE_META, STAGE_ORDER } from '../../types';
import { usePaystackPayment } from 'react-paystack';

interface AppShellProps {
  children: React.ReactNode;
  engagementId?: string;
  currentStage?: EngagementStage;
  completedStages?: EngagementStage[];
  clientName?: string;
  issueNodes?: IssueNode[];
}

export function AppShell({
  children,
  engagementId,
  currentStage,
  completedStages = [],
}: AppShellProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [dbStages, setDbStages] = useState<Record<string, EngagementStageRecord>>({});
  const [auditOpen, setAuditOpen] = useState(false);
  const [engagementName, setEngagementName] = useState<string | null>(null);
  const [tier, setTier] = useState<'free' | 'pro'>('free');
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem('stratum_sidebar_collapsed');
    return stored !== null ? stored === 'true' : true;
  });

  // Detect tablet mode (≤1024px) — sidebar becomes bottom bar
  const [isTablet, setIsTablet] = useState(() => window.innerWidth <= 1024);
  useEffect(() => {
    const handler = () => setIsTablet(window.innerWidth <= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    localStorage.setItem('stratum_sidebar_collapsed', String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsCollapsed(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!engagementId) return;
    async function loadStages() {
      try {
        const { data, error } = await supabase
          .from('engagement_stages')
          .select('*')
          .eq('engagement_id', engagementId);
        if (!error && data && data.length > 0) {
          const map: Record<string, EngagementStageRecord> = {};
          data.forEach((r: EngagementStageRecord) => { map[r.stage] = r; });
          setDbStages(map);
        }
      } catch { /* graceful fallback */ }
    }
    loadStages();
  }, [engagementId, currentStage]);

  useEffect(() => {
    if (!engagementId) return;
    supabase.from('engagements').select('client_name').eq('id', engagementId).single()
      .then(({ data }) => { if (data) setEngagementName(data.client_name); });
  }, [engagementId]);

  useEffect(() => {
    if (user) {
      supabase
        .from('user_subscriptions')
        .select('tier')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data && data.tier === 'pro') {
            setTier('pro');
          }
        });
    }
  }, [user]);

  const config = {
    reference: (new Date()).getTime().toString(),
    email: user?.email || 'test@stratum.com',
    amount: 10 * 100, // 10 KES
    publicKey: 'pk_live_82a92343e08ef9d76f653ae86e0664d098685e20',
    currency: 'KES',
    channels: ['card', 'mobile_money'],
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = async () => {
    const { error } = await supabase.rpc('upgrade_to_pro');
    if (error) {
      console.error('Failed to upgrade to pro:', error);
      alert('Payment successful, but failed to upgrade account. Please contact support.');
    } else {
      setTier('pro');
      alert('Successfully upgraded to Pro!');
      window.location.reload();
    }
  };

  const initials = user?.user_metadata?.full_name?.slice(0, 2).toUpperCase() ?? user?.email?.slice(0, 2).toUpperCase() ?? 'U';

  const getStageStatus = (stage: EngagementStage) => {
    const record = dbStages[stage];
    if (record) {
      if (record.status === 'completed') return 'complete';
      if (record.status === 'in_progress' || stage === currentStage) return 'active';
      if (record.status === 'pending') return 'locked';
    }
    if (completedStages.includes(stage)) return 'complete';
    if (stage === currentStage) return 'active';
    const currentIdx = STAGE_ORDER.indexOf(currentStage ?? 'scoping');
    const stageIdx = STAGE_ORDER.indexOf(stage);
    if (stageIdx > currentIdx) return 'locked';
    return 'complete';
  };

  const currentMeta = currentStage ? STAGE_META[currentStage] : null;

  return (
    <div className={`app-shell ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Topbar */}
      <header className="app-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <NavLink to="/dashboard" className="topbar-brand">
            <AppLogo size={28} />
            {!engagementId && <span className="topbar-name" style={{ marginLeft: 6 }}>Stratum</span>}
          </NavLink>

          {engagementId && engagementName && (
            <div className="topbar-breadcrumb">
              <span>Stratum</span>
              <ChevronRight size={12} className="topbar-breadcrumb-sep" />
              <span>{engagementName}</span>
              {currentMeta && (
                <>
                  <ChevronRight size={12} className="topbar-breadcrumb-sep" />
                  <span className="topbar-breadcrumb-current">{currentMeta.label}</span>
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="hamburger-btn" style={{ margin: 0, padding: 6 }} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          
          <div className={`topbar-actions ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          {engagementId && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setAuditOpen(true)}
              style={{ color: 'var(--text-tertiary)', gap: 6, fontSize: '0.75rem' }}
              title="Audit Trail"
            >
              <Clock size={13} />
              Audit
            </button>
          )}
          <div className="topbar-user" style={{ gap: 12 }}>
            {tier === 'pro' ? (
              <div style={{ padding: '2px 8px', background: 'var(--gold-lo)', color: 'var(--gold)', borderRadius: '100px', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.05em', border: '1px solid var(--b-accent)' }} title="Pro Subscriber">
                PRO
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: '2px 8px', background: 'var(--bg-3)', color: 'var(--t3)', borderRadius: '100px', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.05em', border: '1px solid var(--b1)' }} title="Free Tier">
                  FREE
                </div>
                <button 
                  type="button"
                  className="btn btn-sm btn-outline" 
                  style={{ color: 'var(--gold)', borderColor: 'var(--gold)', padding: '4px 12px', fontSize: '0.75rem', height: '26px', borderRadius: '4px' }}
                  onClick={() => initializePayment({ onSuccess, onClose: () => {} })}
                >
                  Upgrade
                </button>
              </div>
            )}
            <span className="topbar-user-name">{user?.user_metadata?.full_name || user?.email}</span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-3)', border: '1px solid var(--border)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
              {initials}
            </div>
          </div>
          
          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: '6px', height: '32px', width: '32px' }}
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>

          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: '6px 12px', height: '32px' }}
            onClick={signOut}
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="app-sidebar">
        {/* Nav links */}
        <div className="sidebar-section" style={{ paddingTop: 16 }}>
          {!isCollapsed && <div className="sidebar-section-label">Platform</div>}
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            title="Dashboard"
          >
            <LayoutDashboard size={16} />
            {!isCollapsed && <span>Dashboard</span>}
          </NavLink>
          <button
            type="button"
            className="sidebar-link"
            onClick={() => navigate('/engagement/new')}
            title="New Engagement"
          >
            <Plus size={16} />
            {!isCollapsed && <span>New Engagement</span>}
          </button>
          <NavLink
            to="/platform/connectors"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            title="Connectors"
          >
            <Link2 size={16} />
            {!isCollapsed && <span>Connectors</span>}
          </NavLink>
          <NavLink
            to="/platform/data"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            title="Consolidated Data"
          >
            <Database size={16} />
            {!isCollapsed && <span>Consolidated Data</span>}
          </NavLink>
          <NavLink
            to="/platform/ask-ai"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            title="Ask AI"
          >
            <MessageSquare size={16} />
            {!isCollapsed && <span>Ask AI</span>}
          </NavLink>
          <NavLink
            to="/reviewer"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            title="Review Queue"
          >
            <CheckSquare size={16} />
            {!isCollapsed && <span>Review Queue</span>}
          </NavLink>
        </div>

        {/* Stage Nav */}
        {engagementId && currentStage && (
          <div className="sidebar-section" style={{ marginTop: 8 }}>
            <div className="sidebar-divider" />
            {!isCollapsed && <div className="sidebar-section-label">Engagement</div>}
            <div className="stage-nav">
              {STAGE_ORDER.filter(s => s !== 'in_review').map((stage) => {
                const meta = STAGE_META[stage];
                const status = getStageStatus(stage);
                const isClickable = status !== 'locked';

                return (
                  <div
                    key={stage}
                    className={`stage-nav-item ${status}`}
                    onClick={() => { if (isClickable) navigate(`/engagement/${engagementId}/${stage.replace('_', '-')}`); }}
                    style={{ cursor: isClickable ? 'pointer' : 'default' }}
                    title={`${meta.label}${meta.description ? ` — ${meta.description}` : ''}`}
                  >
                    <div className={`stage-marker ${status}`}>
                      {status === 'complete' ? (
                        <Check size={10} />
                      ) : status === 'locked' ? (
                        <Lock size={8} />
                      ) : (
                        <span style={{ fontSize: '0.625rem' }}>{meta.step}</span>
                      )}
                    </div>
                    {!isCollapsed && (
                      <>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="stage-nav-label">{meta.label}</div>
                          {status === 'active' && meta.description && (
                            <div className="stage-nav-sub">{meta.description}</div>
                          )}
                        </div>
                        {status === 'active' && (
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginLeft: 4 }} />
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              
              <div className="sidebar-divider" style={{ margin: '8px 0', opacity: 0.5 }} />
              
              <div
                className={`stage-nav-item ${currentStage === 'chat' ? 'done' : 'queued'}`}
                onClick={() => navigate(`/engagement/${engagementId}/chat`)}
                style={{ cursor: 'pointer', background: currentStage === 'chat' ? 'var(--darker)' : 'transparent' }}
                title="Engagement Chat Copilot"
              >
                <div className={`stage-marker ${currentStage === 'chat' ? 'done' : 'queued'}`}>
                  <MessageSquare size={10} style={{ position: 'relative', zIndex: 2 }} />
                </div>
                {!isCollapsed && (
                  <div className="stage-content">
                    <div className="stage-label" style={{ color: currentStage === 'chat' ? 'var(--gold)' : 'var(--off-white)' }}>Copilot Chat</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Collapse toggle at bottom */}
        <div style={{ marginTop: 'auto', padding: '16px 10px 12px', borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => setIsCollapsed(prev => !prev)}
            title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
          >
            {isCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            {!isCollapsed && <span className="sidebar-toggle-label">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className={`app-main${isTablet ? ' app-main-tablet' : ''}`}>{children}</main>

      {/* ── TABLET BOTTOM NAV BAR ─────────────────────────────────────────── */}
      {isTablet && (
        <nav className="bottom-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`} title="Dashboard">
            <Home size={20} />
            <span>Home</span>
          </NavLink>
          <button type="button" className="bottom-nav-item" onClick={() => navigate('/engagement/new')} title="New Engagement">
            <Plus size={20} />
            <span>New</span>
          </button>
          <NavLink to="/platform/connectors" className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`} title="Connectors">
            <Link2 size={20} />
            <span>Connectors</span>
          </NavLink>
          <NavLink to="/platform/data" className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`} title="Data">
            <Database size={20} />
            <span>Data</span>
          </NavLink>
          <NavLink to="/platform/ask-ai" className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`} title="Ask AI">
            <MessageSquare size={20} />
            <span>Ask AI</span>
          </NavLink>
          <NavLink to="/reviewer" className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`} title="Review">
            <CheckSquare size={20} />
            <span>Review</span>
          </NavLink>
        </nav>
      )}

      {engagementId && (
        <AuditTrailDrawer
          engagementId={engagementId}
          isOpen={auditOpen}
          onClose={() => setAuditOpen(false)}
        />
      )}
    </div>
  );
}
