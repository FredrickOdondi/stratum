import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { AI_TEAM } from '../../lib/agents';
import { ArrowLeft, CheckCircle2, Wrench, ShieldCheck, Briefcase } from 'lucide-react';

export function AgentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const agent = AI_TEAM.find(a => a.id === id);

  if (!agent) {
    return (
      <AppShell>
        <div style={{ padding: 40, textAlign: 'center' }}>
          <p>Agent not found.</p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Go Back</button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page" style={{ padding: '40px 24px', maxWidth: 900, margin: '0 auto' }}>
        
        {/* Header / Back Button */}
        <button 
          onClick={() => navigate('/dashboard')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--t3)', fontSize: '0.875rem', marginBottom: 32 }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        {/* Profile Header */}
        <div className="agent-profile-header">
          <div style={{ width: 140, height: 140, borderRadius: '24px', overflow: 'hidden', border: '2px solid var(--b1)', flexShrink: 0, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
            <img src={agent.avatar} alt={agent.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="agent-profile-title">
              <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--t1)', margin: 0, letterSpacing: '-0.03em' }}>{agent.name}</h1>
              <div style={{ padding: '4px 12px', background: 'var(--green-dim)', color: 'var(--green)', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
                Online
              </div>
            </div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--gold)', fontWeight: 500, margin: '0 0 24px 0' }}>{agent.role}</h2>
            <p style={{ fontSize: '1.0625rem', color: 'var(--t2)', lineHeight: 1.6, margin: 0, maxWidth: 600 }}>
              {agent.description}
            </p>
          </div>
        </div>

        {/* Capabilities & Tools Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
          
          {/* Capabilities */}
          <div className="card" style={{ padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--b1)', paddingBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--gold-lo)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Briefcase size={20} />
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'var(--t1)' }}>Core Capabilities</h3>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {agent.capabilities.map((cap, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <ShieldCheck size={18} color="var(--success)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.9375rem', color: 'var(--t2)', lineHeight: 1.5 }}>{cap}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tools */}
          <div className="card" style={{ padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--b1)', paddingBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--bg-3)', color: 'var(--t2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wrench size={20} />
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'var(--t1)' }}>Tool Stack</h3>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {agent.tools.map((tool, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <CheckCircle2 size={18} color="var(--t3)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.9375rem', color: 'var(--t2)', lineHeight: 1.5 }}>{tool}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>

      </div>
    </AppShell>
  );
}
