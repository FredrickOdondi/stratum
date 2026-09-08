import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Bot, Zap, Network, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { AppLogo } from '../../components/layout/AppLogo';
import { SEO } from '../../components/seo/SEO';
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
      <SEO 
        title="Stratum Advisory — Next-Gen AI Consulting Platform" 
        description="Transform your strategic engagements with Stratum Advisory. Connect live data, leverage specialized AI agents, and generate client-ready deliverables." 
      />
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

      <main>
      {/* Hero */}
      <section className="hero-section">
        <div className="hero-content">

          <h1 className="hero-title">
            The Premier <br />
            <span>AI Consulting Platform</span>
          </h1>
          <p className="hero-subtitle">
            From intake to polished deliverable in hours. Stratum is the definitive AI strategy tool for consultants, accelerating your workflow using specialized AI agents, ensuring every claim is backed by irrefutable evidence.
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
          <img src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1200&q=80" alt="Consulting Team collaborating" fetchPriority="high" />
        </div>
      </section>

      {/* Social Proof */}
      <section style={{ padding: '0 24px 80px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px' }}>
          Trusted by top-tier consulting firms & private equity since 2026
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap', opacity: 0.6, filter: 'grayscale(100%)' }}>
          {['McKinsey & Co. Alumni', 'Bain & Company Alumni', 'Top-10 PE Firm', 'Global Fortune 500 Strategy'].map((brand) => (
            <div key={brand} style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--t2)' }}>
              {brand}
            </div>
          ))}
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
              <h3 className="bento-title">Automate MECE Issue Trees</h3>
              <p className="bento-desc">
                Instantly break down complex client problems into Mutually Exclusive, Collectively Exhaustive sub-questions. Stratum automates the logical framework before diving into the data.
              </p>
            </div>
            <div style={{ marginTop: '32px', height: '240px', background: 'var(--bg-3)', borderTop: '1px solid var(--b1)' }}>
              <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80" alt="Issue Tree Network Visualization" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
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
              <img src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=800&q=80" alt="Data Synthesis and Slide Generation" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
            </div>
          </div>

        </div>
      </section>

      {/* SEO Text Sections */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 24px', display: 'flex', flexDirection: 'column', gap: '80px' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '60px' }}>
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--t1)', marginBottom: '24px' }}>Who is Stratum Advisory For?</h2>
            <p style={{ fontSize: '1rem', color: 'var(--t2)', lineHeight: 1.7, marginBottom: '16px' }}>
              Stratum Advisory is engineered for boutique strategy consulting firms, private equity operating teams, and corporate strategy departments who need to deliver top-tier insights without the overhead of a massive analyst team.
            </p>
            <p style={{ fontSize: '1rem', color: 'var(--t2)', lineHeight: 1.7 }}>
              If your workflow involves interviewing experts, analyzing financial datasets, synthesizing transcripts, and building MECE (Mutually Exclusive, Collectively Exhaustive) issue trees to solve complex client problems, Stratum acts as your dedicated digital workforce.
            </p>
          </div>
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--t1)', marginBottom: '24px' }}>How Our AI Platform Works</h2>
            <p style={{ fontSize: '1rem', color: 'var(--t2)', lineHeight: 1.7, marginBottom: '16px' }}>
              We don't just provide a chat interface. Stratum uses an advanced multi-agent architecture. You connect your data sources (like Notion, Google Drive, or raw PDFs), and our specialized agents take over.
            </p>
            <p style={{ fontSize: '1rem', color: 'var(--t2)', lineHeight: 1.7 }}>
              The <strong>Scoping Agent</strong> structures the problem. The <strong>Research Agent</strong> pulls exact, cited evidence from your data. The <strong>Synthesis Agent</strong> applies the Pyramid Principle to draft slide storylines, and the <strong>Red-Team Agent</strong> critiques the output for logical flaws before you export it to a client-ready PowerPoint deliverable.
            </p>
          </div>
        </div>

      </section>
      </main>

      {/* Fat Footer */}
      <footer className="landing-footer" style={{ borderTop: '1px solid var(--b1)', padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ maxWidth: 1200, width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '40px', marginBottom: '40px' }}>
          <div>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', marginBottom: '16px' }}>
              <AppLogo size={24} />
              <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--t1)' }}>Stratum</span>
            </Link>
            <p style={{ fontSize: '0.875rem', color: 'var(--t3)', lineHeight: 1.6, maxWidth: 250 }}>
              The next-generation AI platform for modern strategy consulting.
            </p>
          </div>
          
          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--t1)', marginBottom: '16px' }}>Product</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Link to="/pricing" style={{ fontSize: '0.875rem', color: 'var(--t2)', textDecoration: 'none' }}>Pricing</Link>
              <Link to="/auth" style={{ fontSize: '0.875rem', color: 'var(--t2)', textDecoration: 'none' }}>Sign In</Link>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--t1)', marginBottom: '16px' }}>Company</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Link to="/about" style={{ fontSize: '0.875rem', color: 'var(--t2)', textDecoration: 'none' }}>About Us</Link>
              <Link to="/contact" style={{ fontSize: '0.875rem', color: 'var(--t2)', textDecoration: 'none' }}>Contact</Link>
              <Link to="/privacy" style={{ fontSize: '0.875rem', color: 'var(--t2)', textDecoration: 'none' }}>Privacy Policy</Link>
            </div>
          </div>
        </div>
        <div style={{ width: '100%', maxWidth: 1200, borderTop: '1px solid var(--b1)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', color: 'var(--t3)' }}>
          <p>&copy; {new Date().getFullYear()} Stratum Advisory. All rights reserved.</p>
          <div style={{ display: 'flex', gap: '16px' }}>
            <a href="https://twitter.com/stratumadvisory" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--t3)', textDecoration: 'none' }}>Twitter</a>
            <a href="https://linkedin.com/company/stratumadvisory" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--t3)', textDecoration: 'none' }}>LinkedIn</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
