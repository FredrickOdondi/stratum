import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Check, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { AppLogo } from '../../components/layout/AppLogo';

type View = 'sign_in' | 'sign_up' | 'forgot';

const CAPABILITIES = [
  { label: 'Issue tree generation', desc: 'MECE hypothesis structures built in seconds' },
  { label: 'Evidence-grounded research', desc: 'Every finding tied to a real source or document' },
  { label: 'Pyramid principle synthesis', desc: 'Governing thought → argument → proof' },
  { label: 'Red-team quality check', desc: 'AI critic challenges every claim before delivery' },
];

const INTEGRATIONS = [
  { name: 'Shopify',          abbr: 'SH', color: '#96BF48', text: '#fff' },
  { name: 'Stripe',           abbr: 'ST', color: '#635BFF', text: '#fff' },
  { name: 'Google Analytics', abbr: 'GA', color: '#E8710A', text: '#fff' },
  { name: 'Meta Ads',         abbr: 'ME', color: '#1877F2', text: '#fff' },
  { name: 'Klaviyo',          abbr: 'KL', color: '#2C2C2C', text: '#fff' },
  { name: 'TikTok',           abbr: 'TK', color: '#010101', text: '#fff' },
  { name: 'WooCommerce',      abbr: 'WC', color: '#7F54B3', text: '#fff' },
  { name: 'Google Ads',       abbr: 'GG', color: '#4285F4', text: '#fff' },
  { name: 'Amazon',           abbr: 'AM', color: '#FF9900', text: '#111' },
  { name: 'Mailchimp',        abbr: 'MC', color: '#FFE01B', text: '#111' },
  { name: 'Recharge',         abbr: 'RC', color: '#7C3B82', text: '#fff' },
  { name: 'Gorgias',          abbr: 'GO', color: '#0B9AF0', text: '#fff' },
  { name: 'Triple Whale',     abbr: 'TW', color: '#4B2AAD', text: '#fff' },
  { name: 'BigCommerce',      abbr: 'BC', color: '#34313F', text: '#fff' },
  { name: 'Supabase',         abbr: 'SB', color: '#3ECF8E', text: '#111' },
  { name: 'Postscript',       abbr: 'PS', color: '#FF4C3B', text: '#fff' },
];

export function AuthPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/dashboard', { replace: true });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate('/dashboard', { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('');
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (error) { setError(error.message); } else { setSuccess('Check your email to confirm your account, then sign in.'); setView('sign_in'); }
    setLoading(false);
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth` });
    if (error) { setError(error.message); } else { setSuccess('Password reset link sent — check your email.'); }
    setLoading(false);
  }

  function switchView(next: View) { setView(next); setError(''); setSuccess(''); }

  const pwStrength = password.length < 8 ? { label: 'Too short', color: 'var(--error)', w: '25%' } : password.length < 12 ? { label: 'Good', color: 'var(--warn)', w: '60%' } : { label: 'Strong', color: 'var(--success)', w: '100%' };

  return (
    <div className="auth-page">
      {/* Left branding panel */}
      <div className="auth-panel-left">
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'auto' }}>
            <AppLogo size={40} />
            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginLeft: 8 }}>
              Stratum
            </span>
          </div>

          {/* Main copy */}
          <div style={{ paddingBottom: 64 }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 20 }}>
              AI-native strategy consulting
            </p>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, color: 'var(--text-primary)', marginBottom: 20 }}>
              From intake to<br />deliverable in hours.
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--text-tertiary)', lineHeight: 1.65, marginBottom: 28, maxWidth: 380 }}>
              A pipeline of specialised agents handles research, analysis, and synthesis — grounded in your data, structured by the frameworks you already know.
            </p>

            {/* Niche tagline */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 'var(--r6)',
              border: '1px solid rgba(62, 207, 142, 0.25)',
              background: 'rgba(62, 207, 142, 0.06)',
              marginBottom: 32,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--gold)', flexShrink: 0,
                boxShadow: '0 0 6px rgba(62,207,142,0.6)',
              }} />
              <span style={{ fontSize: '0.8125rem', color: 'var(--gold)', fontWeight: 600, letterSpacing: '0.01em' }}>
                Stratum works exclusively with DTC / e-commerce brands.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {CAPABILITIES.map(cap => (
                <div key={cap.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(200,169,110,0.15)', border: '1px solid rgba(200,169,110,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <Check size={11} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{cap.label}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>{cap.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Integration strip */}
            <div style={{ marginTop: 'auto', paddingTop: 40 }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 14, opacity: 0.7 }}>
                Works with your stack
              </p>
              <div style={{ overflow: 'hidden', mask: 'linear-gradient(90deg, transparent 0%, black 12%, black 88%, transparent 100%)', WebkitMask: 'linear-gradient(90deg, transparent 0%, black 12%, black 88%, transparent 100%)' }}>
                <div style={{ display: 'flex', gap: 10, animation: 'marquee 28s linear infinite', width: 'max-content' }}>
                  {[...INTEGRATIONS, ...INTEGRATIONS].map((app, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 11px 5px 6px', borderRadius: 'var(--r6)',
                      border: '1px solid var(--b1)',
                      background: 'var(--bg-2)',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}>
                      {/* Colored brand badge */}
                      <div style={{
                        width: 20, height: 20, borderRadius: 4,
                        background: app.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <span style={{ fontSize: '0.5rem', fontWeight: 800, color: app.text, letterSpacing: '-0.02em', lineHeight: 1 }}>
                          {app.abbr}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--t2)' }}>{app.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>{/* end paddingBottom wrapper */}
        </div>{/* end position:relative inner wrapper */}
      </div>{/* end auth-panel-left */}

      {/* Right auth panel */}
      <div className="auth-panel-right">
        <div className="auth-form-container">
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-primary)', marginBottom: 6 }}>
              {view === 'sign_in' && 'Welcome back'}
              {view === 'sign_up' && 'Create account'}
              {view === 'forgot' && 'Reset password'}
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
              {view === 'sign_in' && 'Sign in to access your engagements.'}
              {view === 'sign_up' && 'Set up your account to get started.'}
              {view === 'forgot' && "We'll email you a link to reset your password."}
            </p>
          </div>

          {success && <div className="alert alert-success" style={{ marginBottom: 20 }}><Check size={14} /> {success}</div>}
          {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

          {/* Sign in */}
          {view === 'sign_in' && (
            <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="si-email">Email</label>
                <input id="si-email" type="email" className="form-input" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" htmlFor="si-pw" style={{ margin: 0 }}>Password</label>
                  <button type="button" onClick={() => switchView('forgot')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--accent)', fontFamily: 'inherit' }}>Forgot?</button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input id="si-pw" type={showPassword ? 'text' : 'password'} className="form-input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" style={{ paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 4 }}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn btn-gold btn-lg" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
                {loading ? <span className="spinner spinner-sm spinner-gold" /> : <ArrowRight size={15} />}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}

          {/* Sign up */}
          {view === 'sign_up' && (
            <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="su-name">Full name</label>
                <input id="su-name" type="text" className="form-input" placeholder="Jane Smith" value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="su-email">Email</label>
                <input id="su-email" type="email" className="form-input" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="su-pw">Password</label>
                <div style={{ position: 'relative' }}>
                  <input id="su-pw" type={showPassword ? 'text' : 'password'} className="form-input" placeholder="Minimum 8 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" style={{ paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 4 }}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pwStrength.w, background: pwStrength.color, transition: 'width 0.3s ease, background 0.3s ease', borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: pwStrength.color, marginTop: 4, display: 'block' }}>{pwStrength.label}</span>
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-gold btn-lg" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
                {loading ? <span className="spinner spinner-sm spinner-gold" /> : <ArrowRight size={15} />}
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}

          {/* Forgot */}
          {view === 'forgot' && (
            <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="fp-email">Email</label>
                <input id="fp-email" type="email" className="form-input" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <button type="submit" className="btn btn-gold btn-lg" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? <span className="spinner spinner-sm spinner-gold" /> : null}
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
              <button type="button" onClick={() => switchView('sign_in')} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
                ← Back to sign in
              </button>
            </form>
          )}

          {/* Toggle */}
          {view !== 'forgot' && (
            <div style={{ marginTop: 28, textAlign: 'center' }}>
              <div className="divider" style={{ margin: '0 0 20px' }} />
              <button onClick={() => switchView(view === 'sign_in' ? 'sign_up' : 'sign_in')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '0.875rem', fontFamily: 'inherit' }}>
                {view === 'sign_in' ? <>Don't have an account? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Create one</span></> : <>Already have an account? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</span></>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
