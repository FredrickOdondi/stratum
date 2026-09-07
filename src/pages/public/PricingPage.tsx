import { Link, useNavigate } from 'react-router-dom';
import { AppLogo } from '../../components/layout/AppLogo';
import { useAuth } from '../../hooks/useAuth';
import { CheckCircle2, Zap } from 'lucide-react';
import './PricingPage.css';

export function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <Link to="/" className="landing-nav-brand">
          <AppLogo size={32} />
          <span className="landing-nav-title">Stratum</span>
        </Link>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
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

      {/* Pricing Section */}
      <div className="pricing-page">
        <div className="pricing-header">
          <div className="hero-pill" style={{ justifyContent: 'center', margin: '0 auto 24px' }}>
            <Zap size={14} fill="currentColor" />
            Simple, Transparent Pricing
          </div>
          <h1 className="pricing-title">Scale your consulting workflow</h1>
          <p className="pricing-subtitle">
            Whether you're scoping your first client or running a high-volume agency, we have a plan for you.
          </p>
        </div>

        <div className="pricing-grid">
          
          {/* Free Tier */}
          <div className="pricing-card">
            <div className="pricing-plan">Free</div>
            <div className="pricing-price">$0 <span className="pricing-period">/ month</span></div>
            <p className="pricing-desc">Perfect for testing the waters and scoping small projects.</p>
            
            <ul className="pricing-features">
              <li className="pricing-feature">
                <CheckCircle2 size={18} className="pricing-feature-icon" />
                <span className="pricing-feature-text">Up to 3 active engagements</span>
              </li>
              <li className="pricing-feature">
                <CheckCircle2 size={18} className="pricing-feature-icon" />
                <span className="pricing-feature-text">Access to core AI Team</span>
              </li>
              <li className="pricing-feature">
                <CheckCircle2 size={18} className="pricing-feature-icon" />
                <span className="pricing-feature-text">1 data connector maximum</span>
              </li>
              <li className="pricing-feature">
                <CheckCircle2 size={18} className="pricing-feature-icon" />
                <span className="pricing-feature-text">Standard agents</span>
              </li>
              <li className="pricing-feature">
                <CheckCircle2 size={18} className="pricing-feature-icon" />
                <span className="pricing-feature-text">Basic presentation export</span>
              </li>
            </ul>

            <button className="btn-pricing btn-pricing-outline" onClick={() => navigate(user ? '/dashboard' : '/auth')}>
              {user ? 'Go to Dashboard' : 'Get Started for Free'}
            </button>
          </div>

          {/* Pro Tier */}
          <div className="pricing-card pro">
            <div className="pricing-plan">Pro Subscriber</div>
            <div className="pricing-price">KES 10 <span className="pricing-period" style={{ color: 'rgba(255,255,255,0.5)' }}>/ month</span></div>
            <p className="pricing-desc">For serious consultants who need unlimited power and scale.</p>
            
            <ul className="pricing-features">
              <li className="pricing-feature">
                <CheckCircle2 size={18} className="pricing-feature-icon" />
                <span className="pricing-feature-text">Unlimited engagements</span>
              </li>
              <li className="pricing-feature">
                <CheckCircle2 size={18} className="pricing-feature-icon" />
                <span className="pricing-feature-text">Priority AI processing</span>
              </li>
              <li className="pricing-feature">
                <CheckCircle2 size={18} className="pricing-feature-icon" />
                <span className="pricing-feature-text">Advanced Red-Team QA agent access</span>
              </li>
              <li className="pricing-feature">
                <CheckCircle2 size={18} className="pricing-feature-icon" />
                <span className="pricing-feature-text">Custom branding on deliverables</span>
              </li>
              <li className="pricing-feature">
                <CheckCircle2 size={18} className="pricing-feature-icon" />
                <span className="pricing-feature-text">Premium support</span>
              </li>
            </ul>

            <button className="btn-pricing btn-pricing-solid" onClick={() => navigate(user ? '/dashboard' : '/auth')}>
              {user ? 'Upgrade to Pro' : 'Subscribe Now'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
