import { Link, useNavigate } from 'react-router-dom';
import { AppLogo } from '../../components/layout/AppLogo';
import { SEO } from '../../components/seo/SEO';
import { useAuth } from '../../hooks/useAuth';
import './LandingPage.css';

export function PrivacyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <SEO 
        title="Privacy Policy — Stratum Advisory" 
        description="Learn how Stratum Advisory collects, uses, and protects your data."
      />
      {/* Navigation */}
      <nav className="landing-nav">
        <Link to="/" className="landing-nav-brand">
          <AppLogo size={32} />
          <span className="landing-nav-title">Stratum</span>
        </Link>
        <div className="landing-nav-links">
          <Link to="/about" style={{ color: 'var(--t2)', textDecoration: 'none', fontSize: '0.9375rem', fontWeight: 500, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--t1)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--t2)'}>
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
        <h1 style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--t1)', marginBottom: 16 }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--t3)', marginBottom: 40 }}>Last Updated: September 2026</p>

        <div style={{ color: 'var(--t2)', lineHeight: 1.7 }}>
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--t1)', marginBottom: 16 }}>1. Introduction</h2>
            <p style={{ marginBottom: 16 }}>
              Stratum Advisory ("we," "our," or "us") respects your privacy and is committed to protecting your personal data. 
              This privacy policy will inform you as to how we look after your personal data when you visit our website (regardless of where you visit it from) 
              and tell you about your privacy rights and how the law protects you.
            </p>
          </section>

          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--t1)', marginBottom: 16 }}>2. Data We Collect</h2>
            <p style={{ marginBottom: 16 }}>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
            <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
              <li style={{ marginBottom: 8 }}><strong>Identity Data</strong> includes first name, last name, username or similar identifier.</li>
              <li style={{ marginBottom: 8 }}><strong>Contact Data</strong> includes email address and telephone numbers.</li>
              <li style={{ marginBottom: 8 }}><strong>Technical Data</strong> includes internet protocol (IP) address, your login data, browser type and version.</li>
              <li style={{ marginBottom: 8 }}><strong>Usage Data</strong> includes information about how you use our website and services.</li>
            </ul>
          </section>

          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--t1)', marginBottom: 16 }}>3. How We Use Your Data</h2>
            <p style={{ marginBottom: 16 }}>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
            <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
              <li style={{ marginBottom: 8 }}>Where we need to perform the contract we are about to enter into or have entered into with you.</li>
              <li style={{ marginBottom: 8 }}>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
              <li style={{ marginBottom: 8 }}>Where we need to comply with a legal obligation.</li>
            </ul>
          </section>
          
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--t1)', marginBottom: 16 }}>4. Contact Us</h2>
            <p style={{ marginBottom: 16 }}>
              If you have any questions about this privacy policy or our privacy practices, please contact us at: <br/>
              <a href="mailto:fredrickodondi95@gmail.com" style={{ color: 'var(--gold)', textDecoration: 'none' }}>fredrickodondi95@gmail.com</a>
            </p>
          </section>
        </div>

      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <p>&copy; {new Date().getFullYear()} Stratum Advisory. All rights reserved.</p>
      </footer>
    </div>
  );
}
