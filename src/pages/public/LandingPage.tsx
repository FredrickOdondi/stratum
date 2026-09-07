import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Bot, Zap, Network, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { AppLogo } from '../../components/layout/AppLogo';
import './LandingPage.css';

export function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Hover effect for bento cards
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      for (const card of document.querySelectorAll('.bento-card')) {
        const rect = (card as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        (card as HTMLElement).style.setProperty('--mouse-x', `${x}px`);
        (card as HTMLElement).style.setProperty('--mouse-y', `${y}px`);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  if (loading) return null;

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <Link to="/" className="landing-nav-brand">
          <AppLogo size={32} />
          <span className="landing-nav-title">Stratum</span>
        </Link>
        <div className="landing-nav-links">
          <Link to="/pricing" style={{ color: 'var(--t2)', textDecoration: 'none', fontSize: '0.9375rem', fontWeight: 500, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--t1)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--t2)'}>
            Pricing
          </Link>
          {user ? (
            <button className="btn-hero-primary" style={{ height: '40px', padding: '0 20px', fontSize: '0.9375rem' }} onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </button>
          ) : (
            <button className="btn-hero-primary" style={{ height: '40px', padding: '0 20px', fontSize: '0.9375rem' }} onClick={() => navigate('/auth')}>
              Sign In
            </button>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-pill">
            <Zap size={14} fill="currentColor" />
            The future of consulting is here
          </div>
          <h1 className="hero-title">
            AI-Native <br />
            <span>Strategy Consulting</span>
          </h1>
          <p className="hero-subtitle">
            From intake to polished deliverable in hours. Stratum accelerates your workflow using specialized AI agents, ensuring every claim is backed by irrefutable evidence.
          </p>
          <div className="hero-ctas">
            {user ? (
              <button className="btn-hero-primary" onClick={() => navigate('/dashboard')}>
                Open Workspace <ArrowRight size={18} />
              </button>
            ) : (
              <>
                <button className="btn-hero-primary" onClick={() => navigate('/auth')}>
                  Get Started <ArrowRight size={18} />
                </button>
                <button className="btn-hero-secondary" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
                  Explore Features
                </button>
              </>
            )}
          </div>
        </div>
        <div className="hero-image-wrapper">
          <img src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1200&q=80" alt="Consulting Team collaborating" />
        </div>
      </section>

      {/* Bento Grid */}
      <section id="features" className="bento-section">
        <div className="bento-grid">
          
          {/* Agentic Workforce (Large) */}
          <div className="bento-card bento-large">
            <div className="bento-icon"><Bot size={24} /></div>
            <h3 className="bento-title">Your Private AI Consulting Team</h3>
            <p className="bento-desc">
              Stratum doesn't just use one model. It deploys an entire suite of specialized agents—from the <strong>Scoping Agent</strong> to the <strong>Red-Team QA Critic</strong>—who collaborate seamlessly to structure, analyze, and synthesize your engagement.
            </p>
            <div className="bento-visual" style={{ background: 'var(--bg-3)', padding: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {['Alice Scopes', 'Marcus Tree', 'Elena Data', 'David Quant', 'Sarah Slides', 'Victor Critique'].map(name => (
                <div key={name} style={{ padding: '8px 16px', background: 'var(--bg)', borderRadius: '100px', border: '1px solid var(--b1)', fontSize: '0.8125rem', color: 'var(--t1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold)' }} />
                  {name}
                </div>
              ))}
            </div>
          </div>

          {/* Automated Issue Trees (Medium) */}
          <div className="bento-card bento-medium" style={{ padding: 0 }}>
            <div style={{ padding: '40px 40px 0' }}>
              <div className="bento-icon"><Network size={24} /></div>
              <h3 className="bento-title">MECE Issue Trees</h3>
              <p className="bento-desc">
                Instantly break down complex client problems into Mutually Exclusive, Collectively Exhaustive sub-questions. Stratum builds the logical framework before diving into the data.
              </p>
            </div>
            <div style={{ marginTop: '32px', height: '240px', background: 'var(--bg-3)', borderTop: '1px solid var(--b1)' }}>
              <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80" alt="Issue Tree Network Visualization" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>

          {/* Real-time Evidence Synthesis (Half) */}
          <div className="bento-card bento-half">
            <div className="bento-icon"><ShieldCheck size={24} /></div>
            <h3 className="bento-title">Evidence-Grounded Research</h3>
            <p className="bento-desc">
              Say goodbye to AI hallucinations. Every insight and finding generated by Stratum is strictly mapped and cited to your connected data sources. Click any claim to see the exact document it came from.
            </p>
            <div style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-3)', borderRadius: '8px', marginBottom: '8px' }}>
                <CheckCircle2 size={16} color="var(--success)" />
                <span style={{ fontSize: '0.875rem' }}>Verified: Churn rate decreased by 14%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-3)', borderRadius: '8px' }}>
                <CheckCircle2 size={16} color="var(--success)" />
                <span style={{ fontSize: '0.875rem' }}>Verified: Q3 Customer Acquisition Cost</span>
              </div>
            </div>
          </div>

          {/* Presentation Generation (Half) */}
          <div className="bento-card bento-half bento-half-split" style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div className="bento-icon"><FileText size={24} /></div>
              <h3 className="bento-title">Pyramid Principle Synthesis</h3>
              <p className="bento-desc">
                Stratum uses top-tier consulting frameworks to structure your final deliverable. It builds governing thoughts, solid arguments, and irrefutable proof—ready to export directly to PowerPoint.
              </p>
              <button className="btn-hero-secondary" style={{ marginTop: '32px', height: '40px', padding: '0 20px', fontSize: '0.875rem' }}>
                Export as .pptx
              </button>
            </div>
            <div style={{ flex: 1, height: '100%', minHeight: '300px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--b1)' }}>
              <img src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=800&q=80" alt="Data Synthesis and Slide Generation" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>&copy; {new Date().getFullYear()} Stratum Advisory. All rights reserved.</p>
      </footer>
    </div>
  );
}
