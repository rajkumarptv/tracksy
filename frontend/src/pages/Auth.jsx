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
      {/* Left decorative panel */}
      <div className="hide-mobile" style={{
        width:'42%', flexShrink:0,
        background:'linear-gradient(160deg,#6C63FF 0%,#a29bfe 55%,#fd79a8 100%)',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        position:'relative', overflow:'hidden', padding:48,
      }}>
        <div style={{ position:'absolute', top:-80, left:-80, width:280, height:280, background:'rgba(255,255,255,.07)', borderRadius:'50%' }}/>
        <div style={{ position:'absolute', bottom:-60, right:-60, width:220, height:220, background:'rgba(255,255,255,.05)', borderRadius:'50%' }}/>
        <div style={{ fontSize:72, marginBottom:24 }}>💰</div>
        <div style={{ fontSize:28, fontWeight:800, color:'#fff', marginBottom:12, textAlign:'center', letterSpacing:-0.5 }}>
          Take Control of Your<br/>Financial Future
        </div>
        <div style={{ fontSize:15, color:'rgba(255,255,255,.75)', textAlign:'center', lineHeight:1.6 }}>
          Track, manage, and grow your money<br/>with confidence.
        </div>
        <div style={{ marginTop:40, display:'flex', gap:20 }}>
          {[['📊','Analytics'],['🎯','Goals'],['💳','Budgets']].map(([e,l]) => (
            <div key={l} style={{ background:'rgba(255,255,255,.15)', borderRadius:14, padding:'14px 18px', textAlign:'center', backdropFilter:'blur(8px)' }}>
              <div style={{ fontSize:24, marginBottom:4 }}>{e}</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,.85)', fontWeight:600 }}>{l}</div>
            </div>
          ))}
        </div>
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
          <img src="/icons/logo.png" alt="Tracksy" style={{ width:44, height:44, borderRadius:12, objectFit:'cover', boxShadow:'0 4px 14px rgba(108,99,255,.35)' }} />
          <span style={{ fontSize:22, fontWeight:800, letterSpacing:-0.5, background:'linear-gradient(135deg,var(--accent),#a29bfe)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Tracksy</span>
        </div>

        <div style={{ width:'100%', maxWidth:400 }}>{children}</div>
      </div>
    </div>
  );
}

/* ── Social OAuth buttons ──────────────────────────────────────────────────── */
function SocialButtons() {
  const handleGoogle = () => { window.location.href = '/api/auth/google'; };
  const handleFacebook = () => { window.location.href = '/api/auth/facebook'; };

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, margin:'20px 0' }}>
        <div style={{ flex:1, height:1, background:'var(--border)' }}/>
        <span style={{ fontSize:12, color:'var(--text3)', fontWeight:600, whiteSpace:'nowrap' }}>or continue with</span>
        <div style={{ flex:1, height:1, background:'var(--border)' }}/>
      </div>

      <div style={{ display:'flex', gap:10 }}>
        {/* Google */}
        <button onClick={handleGoogle} style={{
          flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          padding:'10px 16px', borderRadius:12, border:'1.5px solid var(--border)',
          background:'var(--surface)', cursor:'pointer', fontSize:13.5, fontWeight:600,
          color:'var(--text)', transition:'all .15s',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor='#4285F4'}
          onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google
        </button>

        {/* Facebook */}
        <button onClick={handleFacebook} style={{
          flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          padding:'10px 16px', borderRadius:12, border:'1.5px solid var(--border)',
          background:'var(--surface)', cursor:'pointer', fontSize:13.5, fontWeight:600,
          color:'var(--text)', transition:'all .15s',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor='#1877F2'}
          onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Facebook
        </button>
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

      <SocialButtons />
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

      <SocialButtons />
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
        <div style={{ background:'rgba(55,214,122,.1)', border:'1.5px solid rgba(55,214,122,.3)', borderRadius:14, padding:'20px', textAlign:'center' }}>
          <div style={{ fontSize:32, marginBottom:10 }}>✅</div>
          <div style={{ fontSize:15, fontWeight:700, color:'#37D67A', marginBottom:6 }}>Password reset successfully!</div>
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
