import { Link, useNavigate } from 'react-router-dom';
import { AppLogo } from '../../components/layout/AppLogo';
import { SEO } from '../../components/seo/SEO';
import { useAuth } from '../../hooks/useAuth';
import './LandingPage.css';

export function ContactPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <SEO 
        title="Contact Us — Stratum Advisory" 
        description="Get in touch with the Stratum Advisory team for support, enterprise inquiries, or general questions."
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

      <main style={{ paddingTop: 120, paddingBottom: 100, maxWidth: 600, margin: '0 auto', paddingLeft: 24, paddingRight: 24 }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--t1)', marginBottom: 24 }}>
          Get in touch
        </h1>
        <p style={{ fontSize: '1.125rem', color: 'var(--t2)', lineHeight: 1.6, marginBottom: 40 }}>
          Have questions about our platform or need support? We're here to help. Reach out to our team.
        </p>

        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--b1)', borderRadius: '16px', padding: '32px', marginBottom: 40 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--t1)', marginBottom: 16 }}>Contact Information</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '0.875rem', color: 'var(--t2)', marginBottom: '4px' }}>Email Support</div>
              <a href="mailto:hello@stratumsys.online" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 500 }}>hello@stratumsys.online</a>
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', color: 'var(--t2)', marginBottom: '4px' }}>Business Hours</div>
              <div style={{ color: 'var(--t1)', fontWeight: 500 }}>Monday - Friday, 9am - 5pm EST</div>
            </div>
          </div>
        </div>

        <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--t1)', marginBottom: '8px' }}>Name</label>
            <input type="text" style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--b2)', background: 'var(--bg)', color: 'var(--t1)', fontSize: '1rem', outline: 'none' }} placeholder="Jane Doe" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--t1)', marginBottom: '8px' }}>Email</label>
            <input type="email" style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--b2)', background: 'var(--bg)', color: 'var(--t1)', fontSize: '1rem', outline: 'none' }} placeholder="jane@company.com" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--t1)', marginBottom: '8px' }}>Message</label>
            <textarea rows={5} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--b2)', background: 'var(--bg)', color: 'var(--t1)', fontSize: '1rem', outline: 'none', resize: 'vertical' }} placeholder="How can we help you?" />
          </div>
          <button type="button" className="btn-hero-primary" style={{ marginTop: '8px', justifyContent: 'center' }}>
            Send Message
          </button>
        </form>

      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <p>&copy; {new Date().getFullYear()} Stratum Advisory. All rights reserved.</p>
      </footer>
    </div>
  );
}
