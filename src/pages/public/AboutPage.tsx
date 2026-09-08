import { Link, useNavigate } from 'react-router-dom';
import { AppLogo } from '../../components/layout/AppLogo';
import { SEO } from '../../components/seo/SEO';
import { useAuth } from '../../hooks/useAuth';
import './LandingPage.css'; // Reuse landing page styles for consistency

export function AboutPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <SEO 
        title="About Us — Stratum Advisory" 
        description="Learn about Stratum Advisory and our mission to revolutionize strategy consulting with AI-native workflows."
      />
      {/* Navigation */}
      <nav className="landing-nav">
        <Link to="/" className="landing-nav-brand">
          <AppLogo size={32} />
          <span className="landing-nav-title">Stratum</span>
        </Link>
        <div className="landing-nav-links">
          <Link to="/about" style={{ color: 'var(--t1)', textDecoration: 'none', fontSize: '0.9375rem', fontWeight: 500 }}>
            About
          </Link>
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

      <main style={{ paddingTop: 120, paddingBottom: 100, maxWidth: 800, margin: '0 auto', paddingLeft: 24, paddingRight: 24 }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--t1)', marginBottom: 24 }}>
          Redefining Consulting
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--t2)', lineHeight: 1.6, marginBottom: 40 }}>
          Stratum Advisory is built for modern strategy professionals. Our platform bridges the gap between raw data and polished insight using purpose-built AI agents.
        </p>

        <section style={{ marginBottom: 60 }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--t1)', marginBottom: 16 }}>Our Mission</h2>
          <p style={{ fontSize: '1rem', color: 'var(--t2)', lineHeight: 1.7, marginBottom: 16 }}>
            Traditional consulting is slow, expensive, and often bottlenecked by manual data synthesis and slide creation. 
            We believe that the next generation of consulting firms will be lean, agile, and heavily augmented by AI.
          </p>
          <p style={{ fontSize: '1rem', color: 'var(--t2)', lineHeight: 1.7 }}>
            Our mission is to empower consultants, private equity firms, and corporate strategy teams with an "always-on" 
            digital workforce. By automating the grunt work of structuring issue trees, synthesizing transcripts, and formatting PowerPoint decks, 
            Stratum frees you to focus on what actually matters: client relationships and high-level strategic thinking.
          </p>
        </section>

        <section style={{ marginBottom: 60 }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--t1)', marginBottom: 16 }}>The Agentic Approach</h2>
          <p style={{ fontSize: '1rem', color: 'var(--t2)', lineHeight: 1.7 }}>
            Unlike generic chatbots, Stratum utilizes a multi-agent architecture. Our system deploys distinct digital personas—each 
            trained on specific consulting frameworks (like the Pyramid Principle or MECE structuring)—to collaboratively solve 
            your engagement challenges. They challenge each other, verify facts against your connected data sources, and synthesize 
            findings into client-ready deliverables.
          </p>
        </section>

      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <p>&copy; {new Date().getFullYear()} Stratum Advisory. All rights reserved.</p>
      </footer>
    </div>
  );
}
