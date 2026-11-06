import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';

const API_BASE = import.meta.env.VITE_API_URL || '';

/* ── Shared shell ─────────────────────────────────────────────────────────── */
function AuthShell({ children }) {
  const { theme, toggleTheme } = useThemeStore();
  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'var(--bg)' }}>
      {/* Left brand panel */}
      <div className="hide-mobile" style={{
        width:'42%', flexShrink:0,
        background:'linear-gradient(180deg,#1E1B4B 0%,#312E81 100%)',
        display:'flex', flexDirection:'column', justifyContent:'center',
        position:'relative', overflow:'hidden', padding:'64px 56px',
      }}>
        <div style={{ fontSize:30, fontWeight:700, color:'#fff', marginBottom:12, letterSpacing:-0.6, lineHeight:1.2 }}>
          Know where your money<br/>goes — and where it's headed.
        </div>
        <div style={{ fontSize:15, color:'rgba(255,255,255,.7)', lineHeight:1.6, maxWidth:380 }}>
          Track spending, plan budgets and goals, and stay on top of debts — all in one place.
        </div>
        <ul style={{ listStyle:'none', marginTop:36, display:'flex', flexDirection:'column', gap:14 }}>
          {['Every account, card and loan in one view','Budgets and goals that update as you spend','Clear insights, not spreadsheets'].map(t => (
            <li key={t} style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'rgba(255,255,255,.85)' }}>
              <span style={{ width:20, height:20, borderRadius:'50%', background:'rgba(255,255,255,.14)', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      {/* Right form panel */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 20px', position:'relative', overflowY:'auto' }}>
        <button onClick={toggleTheme} style={{ position:'absolute', top:20, right:20, width:38, height:38, borderRadius:10, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          {theme === 'light'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          }
        </button>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:32 }}>
          <img src="/icons/logo.png" alt="Tracksy" style={{ width:40, height:40, borderRadius:10, objectFit:'cover', }} />
          <span style={{ fontSize:22, fontWeight:700, letterSpacing:-0.5, color:'var(--text)' }}>Tracksy</span>
        </div>

        <div style={{ width:'100%', maxWidth:400 }}>{children}</div>
      </div>
    </div>
  );
}

/* ── Trust badges under the form ── */
function TrustBadges() {

  return (
    <div>
      {/* Trust / feature icons — visible on mobile too (left panel is hidden there) */}
      <div style={{ display:'flex', justifyContent:'center', gap:22, marginTop:26 }}>
        {[
          { c:'#059669', label:'Bank-grade\nencryption', icon:(
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
          )},
          { c:'#3B82F6', label:'Real-time\ninsights', icon:(
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>
          )},
          { c:'#D97706', label:'Goals &\nbudgets', icon:(
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>
          )},
        ].map(({ c, label, icon }) => (
          <div key={label} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:7, flex:1, maxWidth:96 }}>
            <div style={{ width:42, height:42, borderRadius:13, background:`${c}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {icon}
            </div>
            <span style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textAlign:'center', lineHeight:1.35, whiteSpace:'pre-line' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Login ─────────────────────────────────────────────────────────────────── */
export function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Show error if OAuth failed
  useEffect(() => {
    if (searchParams.get('error') === 'oauth') setError('Social login failed. Please try again.');
  }, [searchParams]);

  const handleSubmit = async () => {
    if (!form.email || !form.password) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    try {
      const res = await authAPI.login(form);
      setAuth(res.data.user, res.data.token);
      navigate('/');
    } catch (e) {
      setError(e.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell>
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:24, fontWeight:800, letterSpacing:-0.5, marginBottom:6 }}>Welcome back!</div>
        <div style={{ fontSize:14, color:'var(--text3)' }}>Sign in to manage your finances</div>
      </div>

      {error && (
        <div style={{ background:'var(--red-light)', color:'var(--red)', padding:'10px 14px', borderRadius:10, marginBottom:18, fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:8 }}>
          ⚠️ {error}
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Email address</label>
        <input className="form-input" type="email" value={form.email}
          onChange={e => setForm(f => ({...f, email: e.target.value}))}
          placeholder="you@example.com"
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}/>
      </div>
      <div className="form-group">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
          <label className="form-label" style={{ marginBottom:0 }}>Password</label>
          <Link to="/forgot-password" style={{ fontSize:12.5, color:'var(--accent)', fontWeight:600 }}>Forgot password?</Link>
        </div>
        <input className="form-input" type="password" value={form.password}
          onChange={e => setForm(f => ({...f, password: e.target.value}))}
          placeholder="••••••••"
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}/>
      </div>

      <button className="btn btn-primary btn-lg" style={{ width:'100%', justifyContent:'center', marginTop:6 }}
        disabled={loading} onClick={handleSubmit}>
        {loading ? 'Signing in…' : 'Sign in →'}
      </button>

      <div style={{ marginTop:16, textAlign:'center', fontSize:13.5, color:'var(--text3)' }}>
        Don't have an account?{' '}
        <Link to="/register" style={{ color:'var(--accent)', fontWeight:700 }}>Create one free</Link>
      </div>

      <TrustBadges />
    </AuthShell>
  );
}

/* ── Register ──────────────────────────────────────────────────────────────── */
export function Register() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ first_name:'', last_name:'', email:'', password:'', confirm_password:'' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name || !form.email || !form.password) { setError('Please fill in all fields'); return; }
    if (form.password !== form.confirm_password) { setError('Passwords do not match'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true); setError('');
    try {
      const res = await authAPI.register({ first_name:form.first_name, last_name:form.last_name, email:form.email, password:form.password });
      setAuth(res.data.user, res.data.token);
      navigate('/');
    } catch (e) {
      setError(e.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell>
      <div style={{ marginBottom:26 }}>
        <div style={{ fontSize:24, fontWeight:800, letterSpacing:-0.5, marginBottom:6 }}>Create account</div>
        <div style={{ fontSize:14, color:'var(--text3)' }}>Start managing your finances today — it's free</div>
      </div>

      {error && (
        <div style={{ background:'var(--red-light)', color:'var(--red)', padding:'10px 14px', borderRadius:10, marginBottom:18, fontSize:13, fontWeight:500 }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div className="form-group">
          <label className="form-label">First name</label>
          <input className="form-input" value={form.first_name} onChange={e => setForm(f => ({...f, first_name:e.target.value}))} placeholder="John"/>
        </div>
        <div className="form-group">
          <label className="form-label">Last name</label>
          <input className="form-input" value={form.last_name} onChange={e => setForm(f => ({...f, last_name:e.target.value}))} placeholder="Doe"/>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Email address</label>
        <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({...f, email:e.target.value}))} placeholder="you@example.com"/>
      </div>
      <div className="form-group">
        <label className="form-label">Password</label>
        <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({...f, password:e.target.value}))} placeholder="Min. 6 characters"/>
      </div>
      <div className="form-group">
        <label className="form-label">Confirm password</label>
        <input className="form-input" type="password" value={form.confirm_password} onChange={e => setForm(f => ({...f, confirm_password:e.target.value}))} placeholder="••••••••"/>
      </div>

      <button className="btn btn-primary btn-lg" style={{ width:'100%', justifyContent:'center', marginTop:6 }}
        disabled={loading} onClick={handleSubmit}>
        {loading ? 'Creating account…' : 'Create account →'}
      </button>

      <div style={{ marginTop:16, textAlign:'center', fontSize:13.5, color:'var(--text3)' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color:'var(--accent)', fontWeight:700 }}>Sign in</Link>
      </div>

      <TrustBadges />
    </AuthShell>
  );
}

/* ── Forgot Password ───────────────────────────────────────────────────────── */
export function ForgotPassword() {
  const [email,   setEmail]   = useState('');
  const [token,   setToken]   = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) { setError('Please enter your email'); return; }
    setLoading(true); setError('');
    try {
      const res = await authAPI.forgotPassword({ email: email.trim() });
      if (res.data.token) setToken(res.data.token);
      else setError('No account found with that email.');
    } catch (e) {
      setError(e.response?.data?.message || 'Something went wrong. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:24, fontWeight:800, letterSpacing:-0.5, marginBottom:6 }}>Reset Password</div>
        <div style={{ fontSize:14, color:'var(--text3)' }}>Enter your email to get a reset link</div>
      </div>

      {error && (
        <div style={{ background:'var(--red-light)', color:'var(--red)', padding:'10px 14px', borderRadius:10, marginBottom:18, fontSize:13, fontWeight:500 }}>
          ⚠️ {error}
        </div>
      )}

      {token ? (
        /* ── Reset token generated ── */
        <div style={{ background:'var(--surface2)', borderRadius:14, padding:'20px', border:'1.5px solid var(--accent)' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)', marginBottom:10 }}>✅ Reset token generated!</div>
          <div style={{ fontSize:12.5, color:'var(--text3)', marginBottom:14 }}>
            Click the link below to set your new password. Valid for <strong>1 hour</strong>.
          </div>
          <Link
            to={`/reset-password?token=${token}`}
            style={{ display:'block', wordBreak:'break-all', padding:'10px 14px', borderRadius:10, background:'var(--accent-light)', color:'var(--accent)', fontWeight:700, fontSize:13, textDecoration:'none' }}>
            🔑 Click here to set new password →
          </Link>
        </div>
      ) : (
        <>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input className="form-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}/>
          </div>
          <button className="btn btn-primary btn-lg" style={{ width:'100%', justifyContent:'center', marginTop:6 }}
            disabled={loading} onClick={handleSubmit}>
            {loading ? 'Checking…' : 'Send reset link →'}
          </button>
        </>
      )}

      <div style={{ marginTop:20, textAlign:'center', fontSize:13.5, color:'var(--text3)' }}>
        <Link to="/login" style={{ color:'var(--accent)', fontWeight:700 }}>← Back to login</Link>
      </div>
    </AuthShell>
  );
}

/* ── Reset Password ────────────────────────────────────────────────────────── */
export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password,  setPassword]  = useState('');
  const [password2, setPassword2] = useState('');
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [show,    setShow]    = useState(false);

  const handleSubmit = async () => {
    if (!password) { setError('Enter a new password'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== password2) { setError('Passwords do not match'); return; }
    setLoading(true); setError('');
    try {
      await authAPI.resetPassword({ token, new_password: password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (e) {
      setError(e.response?.data?.message || 'Reset failed. Token may have expired.');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:24, fontWeight:800, letterSpacing:-0.5, marginBottom:6 }}>Set New Password</div>
        <div style={{ fontSize:14, color:'var(--text3)' }}>Choose a strong new password</div>
      </div>

      {error && (
        <div style={{ background:'var(--red-light)', color:'var(--red)', padding:'10px 14px', borderRadius:10, marginBottom:18, fontSize:13 }}>
          ⚠️ {error}
        </div>
      )}

      {success ? (
        <div style={{ background:'rgba(5,150,105,.1)', border:'1.5px solid rgba(5,150,105,.3)', borderRadius:14, padding:'20px', textAlign:'center' }}>
          <div style={{ fontSize:32, marginBottom:10 }}>✅</div>
          <div style={{ fontSize:15, fontWeight:700, color:'#059669', marginBottom:6 }}>Password reset successfully!</div>
          <div style={{ fontSize:13, color:'var(--text3)' }}>Redirecting to login in 3 seconds…</div>
        </div>
      ) : (
        <>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <div style={{ position:'relative' }}>
              <input className="form-input" type={show ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters"
                style={{ paddingRight:40 }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}/>
              <button type="button" onClick={() => setShow(s => !s)}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:13 }}>
                {show ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input className="form-input" type="password" value={password2}
              onChange={e => setPassword2(e.target.value)} placeholder="Re-enter password"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}/>
          </div>
          <button className="btn btn-primary btn-lg" style={{ width:'100%', justifyContent:'center', marginTop:6 }}
            disabled={loading} onClick={handleSubmit}>
            {loading ? 'Resetting…' : '🔑 Reset Password →'}
          </button>
        </>
      )}
    </AuthShell>
  );
}

/* ── OAuth Callback — reads ?token= from URL, stores it, redirects ─────────── */
export function OAuthCallback() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { setError('Authentication failed — no token received.'); return; }

    // Fetch user info using the token from URL (before it's stored in Zustand)
    import('../services/api').then(({ default: api }) => {
      api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          setAuth(res.data.user, token);
          navigate('/', { replace: true });
        })
        .catch(() => setError('Failed to fetch account details. Please try again.'));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return (
    <AuthShell>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:36, marginBottom:16 }}>⚠️</div>
        <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>Login failed</div>
        <div style={{ fontSize:13.5, color:'var(--text3)', marginBottom:20 }}>{error}</div>
        <Link to="/login" style={{ color:'var(--accent)', fontWeight:700 }}>← Back to login</Link>
      </div>
    </AuthShell>
  );

  return (
    <AuthShell>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:48, height:48, borderRadius:'50%', background:'var(--accent-light)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', animation:'spin 1s linear infinite' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        </div>
        <div style={{ fontSize:15, fontWeight:600, color:'var(--text2)' }}>Signing you in…</div>
      </div>
    </AuthShell>
  );
}
