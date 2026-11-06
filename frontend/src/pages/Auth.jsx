import { useState, useEffect, useId } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Lock, Moon, Sun, Loader2, Wallet, TrendingUp, Target, ArrowUpRight } from 'lucide-react';
import { authAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import styles from './Auth.module.css';

/* ── Small building blocks ────────────────────────────────────────────────── */
// After a failed submit, move keyboard/screen-reader focus to the first invalid field.
const focusFirstError = () => setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0);

function Logo() {
  return (
    <span className={styles.logoRow}>
      <img className={styles.logoMark} src="/icons/icon.svg" alt="" width="36" height="36" />
      <span className={styles.wordmark}>Tracksy</span>
    </span>
  );
}

function Alert({ children }) {
  if (!children) return null;
  return (
    <div className={styles.alert} role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function Notice({ children }) {
  return (
    <div className={styles.notice} role="status">
      <CheckCircle2 size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </div>
  );
}

function FieldError({ id, children }) {
  if (!children) return null;
  return <div id={id} className={styles.error}><AlertCircle size={14} aria-hidden="true" />{children}</div>;
}

function TextField({ label, error, hint, ...input }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <input id={id} className={styles.input} aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} {...input} />
      {hint && !error && <div id={`${id}-hint`} className={styles.help}>{hint}</div>}
      <FieldError id={`${id}-err`}>{error}</FieldError>
    </div>
  );
}

function PasswordField({ label, error, hint, aside, ...input }) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>{label}</label>
        {aside}
      </div>
      <div className={styles.inputWrap}>
        <input id={id} className={`${styles.input} ${styles.hasToggle}`} type={show ? 'text' : 'password'}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} {...input} />
        <button type="button" className={styles.toggle} onClick={() => setShow(s => !s)}
          aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {hint && !error && <div id={`${id}-hint`} className={styles.help}>{hint}</div>}
      <FieldError id={`${id}-err`}>{error}</FieldError>
    </div>
  );
}

function SubmitButton({ loading, loadingText, children }) {
  return (
    <button type="submit" className={styles.submit} disabled={loading}>
      {loading && <Loader2 size={18} className={styles.spin} aria-hidden="true" />}
      {loading ? loadingText : children}
    </button>
  );
}

/* Static preview of the product. Figures are sample data and labelled as such. */
function ProductPreview() {
  return (
    <div className={styles.preview} aria-hidden="true">
      <div className={styles.previewLabel}><span>Available balance</span><span>Sample preview</span></div>
      <div className={styles.previewAmount}>₹3,48,250</div>
      <div className={styles.previewDelta}><ArrowUpRight size={14} />+₹18,163 this month</div>
      <svg className={styles.spark} viewBox="0 0 400 56" preserveAspectRatio="none">
        <defs>
          <linearGradient id="authSpark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#93C5FD" stopOpacity=".35" />
            <stop offset="100%" stopColor="#93C5FD" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 44 L50 40 L100 46 L150 32 L200 36 L250 22 L300 26 L350 12 L400 8 L400 56 L0 56 Z" fill="url(#authSpark)" />
        <path d="M0 44 L50 40 L100 46 L150 32 L200 36 L250 22 L300 26 L350 12 L400 8" fill="none" stroke="#93C5FD" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className={styles.previewRows}>
        <div className={styles.previewRow}><span>Monthly salary</span><span className={styles.in}>+₹65,000</span></div>
        <div className={styles.previewRow}><span>House rent</span><span className={styles.out}>−₹18,000</span></div>
      </div>
    </div>
  );
}

const BENEFITS = [
  { Icon: Wallet, text: 'Every account, card and loan in one view' },
  { Icon: TrendingUp, text: 'A cash-flow forecast that warns you before a shortfall' },
  { Icon: Target, text: 'Budgets and goals that update as you spend' },
];

/* ── Shared shell: brand panel on desktop, single column on phones ────────── */
function AuthShell({ children }) {
  const { theme, toggleTheme } = useThemeStore();
  return (
    <div className={styles.root}>
      <aside className={styles.brand}>
        <Logo />
        <div>
          <h2 className={styles.headline}>Know where your money goes, and where it's headed.</h2>
          <p className={styles.lede}>Track spending, plan budgets and goals, and stay on top of debts, all in one place.</p>
          <ProductPreview />
          <ul className={styles.benefits}>
            {BENEFITS.map(({ Icon, text }) => (
              <li key={text} className={styles.benefit}>
                <span className={styles.benefitIcon}><Icon size={17} aria-hidden="true" /></span>{text}
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.brandFoot}>© {new Date().getFullYear()} Tracksy</div>
      </aside>

      <main className={styles.formSide}>
        <div className={styles.formTop}>
          <span className={styles.mobileLogo}><Logo /></span>
          <button type="button" className={styles.themeBtn} onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
        <div className={styles.formWrap}><div className={styles.card}>{children}</div></div>
        <p className={styles.trust}>
          <Lock size={16} aria-hidden="true" />
          <span>Your data is private to your account, and every connection is encrypted.</span>
        </p>
      </main>
    </div>
  );
}

/* ── Login ─────────────────────────────────────────────────────────────────── */
export function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.email.trim()) errs.email = 'Enter your email address';
    if (!form.password) errs.password = 'Enter your password';
    setErrors(errs);
    if (Object.keys(errs).length) { setError(''); focusFirstError(); return; }
    setLoading(true); setError('');
    try {
      const res = await authAPI.login({ email: form.email.trim(), password: form.password });
      setAuth(res.data.user, res.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell>
      <h1 className={styles.title}>Sign in</h1>
      <p className={styles.subtitle}>Welcome back. Enter your details to continue.</p>
      <Alert>{error}</Alert>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField label="Email address" type="email" name="email" autoComplete="email" inputMode="email"
          placeholder="you@example.com" value={form.email} error={errors.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <PasswordField label="Password" name="password" autoComplete="current-password"
          placeholder="Enter your password" value={form.password} error={errors.password}
          aside={<Link to="/forgot-password" className={styles.link}>Forgot password?</Link>}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        <SubmitButton loading={loading} loadingText="Signing in…">Sign in</SubmitButton>
      </form>
      <p className={styles.switch}>New to Tracksy? <Link to="/register">Create an account</Link></p>
    </AuthShell>
  );
}

/* ── Register ──────────────────────────────────────────────────────────────── */
export function Register() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', confirm_password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.first_name.trim()) errs.first_name = 'Enter your first name';
    if (!form.last_name.trim()) errs.last_name = 'Enter your last name';
    if (!form.email.trim()) errs.email = 'Enter your email address';
    if (!form.password) errs.password = 'Choose a password';
    else if (form.password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (form.password && form.password !== form.confirm_password) errs.confirm_password = 'Passwords do not match';
    setErrors(errs);
    if (Object.keys(errs).length) { setError(''); focusFirstError(); return; }
    setLoading(true); setError('');
    try {
      const res = await authAPI.register({ first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim(), password: form.password });
      setAuth(res.data.user, res.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell>
      <h1 className={styles.title}>Create your account</h1>
      <p className={styles.subtitle}>Start tracking your money in a couple of minutes. It's free.</p>
      <Alert>{error}</Alert>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.row2}>
          <TextField label="First name" name="given-name" autoComplete="given-name" placeholder="First name"
            value={form.first_name} error={errors.first_name} onChange={set('first_name')} />
          <TextField label="Last name" name="family-name" autoComplete="family-name" placeholder="Last name"
            value={form.last_name} error={errors.last_name} onChange={set('last_name')} />
        </div>
        <TextField label="Email address" type="email" name="email" autoComplete="email" inputMode="email"
          placeholder="you@example.com" value={form.email} error={errors.email} onChange={set('email')} />
        <PasswordField label="Password" name="new-password" autoComplete="new-password"
          placeholder="At least 6 characters" hint="Use at least 6 characters."
          value={form.password} error={errors.password} onChange={set('password')} />
        <PasswordField label="Confirm password" name="confirm-password" autoComplete="new-password"
          placeholder="Re-enter your password" value={form.confirm_password} error={errors.confirm_password}
          onChange={set('confirm_password')} />
        <SubmitButton loading={loading} loadingText="Creating account…">Create account</SubmitButton>
      </form>
      <p className={styles.switch}>Already have an account? <Link to="/login">Sign in</Link></p>
    </AuthShell>
  );
}

/* ── Forgot Password (behaviour unchanged; restyled only) ──────────────────── */
export function ForgotPassword() {
  const [email,   setEmail]   = useState('');
  const [token,   setToken]   = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email'); return; }
    setLoading(true); setError('');
    try {
      const res = await authAPI.forgotPassword({ email: email.trim() });
      if (res.data.token) setToken(res.data.token);
      else setError('No account found with that email.');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell>
      <h1 className={styles.title}>Reset your password</h1>
      <p className={styles.subtitle}>Enter your email to get a reset link.</p>
      <Alert>{error}</Alert>

      {token ? (
        <>
          <Notice>Your reset link is ready and valid for 1 hour.</Notice>
          <div className={styles.form}>
            <Link to={`/reset-password?token=${token}`} className={styles.submit} style={{ textDecoration: 'none' }}>
              Set a new password
            </Link>
          </div>
        </>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <TextField label="Email address" type="email" name="email" autoComplete="email" inputMode="email"
            placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          <SubmitButton loading={loading} loadingText="Checking…">Send reset link</SubmitButton>
        </form>
      )}
      <p className={styles.switch}><Link to="/login">Back to sign in</Link></p>
    </AuthShell>
  );
}

/* ── Reset Password (behaviour unchanged; restyled only) ───────────────────── */
export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password,  setPassword]  = useState('');
  const [password2, setPassword2] = useState('');
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) { setError('Enter a new password'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== password2) { setError('Passwords do not match'); return; }
    setLoading(true); setError('');
    try {
      await authAPI.resetPassword({ token, new_password: password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. Token may have expired.');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell>
      <h1 className={styles.title}>Set a new password</h1>
      <p className={styles.subtitle}>Choose a strong new password.</p>
      <Alert>{error}</Alert>

      {success ? (
        <Notice>Your password has been reset. Taking you to sign in…</Notice>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <PasswordField label="New password" name="new-password" autoComplete="new-password"
            placeholder="At least 6 characters" value={password} onChange={e => setPassword(e.target.value)} />
          <PasswordField label="Confirm password" name="confirm-password" autoComplete="new-password"
            placeholder="Re-enter your password" value={password2} onChange={e => setPassword2(e.target.value)} />
          <SubmitButton loading={loading} loadingText="Resetting…">Reset password</SubmitButton>
        </form>
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
      <h1 className={styles.title}>Sign-in failed</h1>
      <Alert>{error}</Alert>
      <p className={styles.switch}><Link to="/login">Back to sign in</Link></p>
    </AuthShell>
  );

  return (
    <AuthShell>
      <h1 className={styles.title}>Signing you in…</h1>
      <p className={styles.subtitle}><Loader2 size={18} className={styles.spin} aria-hidden="true" style={{ verticalAlign: 'text-bottom' }} /> One moment.</p>
    </AuthShell>
  );
}
