// ─── Settings ────────────────────────────────────────────────────────────────
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useState as useState2 } from 'react';
import { useMutation as useMutation2, useQuery as useQuery2 } from '@tanstack/react-query';
import { useNavigate as useNavigate3 } from 'react-router-dom';
import { authAPI, dataAPI } from '../services/api';
import { track, trackThen, isEnabled, setOptOut } from '../lib/analytics';
import { Topbar as Topbar3 } from '../components/ui';
import useAuthStore2 from '../store/authStore';
import useCurrencyStore2, { CURRENCIES as ALL_CURRENCIES } from '../store/currencyStore';
import useLangStore2 from '../store/langStore';
import { useFmt as useFmtHook } from '../i18n';
import { useT as useT2 } from '../i18n';
import { User, Globe, Bell, Shield, ChevronRight as Chevron, Download, Trash2, Check, AlertTriangle, Eye, EyeOff, Key, Tag, Sparkles } from 'lucide-react';
import usePrivacyStore from '../store/privacyStore';
import ThemedSelect from '../components/ThemedSelect';

function PrivacySection() {
  const { hidden, passwordHash, setHidden, setPassword, verify } = usePrivacyStore();
  const [pw, setPw]   = useState2('');
  const [pw2, setPw2] = useState2('');
  const [cur, setCur] = useState2('');
  const [msg, setMsg] = useState2('');
  const hasPw = !!passwordHash;
  const [analyticsOn, setAnalyticsOn] = useState2(isEnabled());
  const toggleAnalytics = () => {
    const next = !analyticsOn;
    if (!next) track('analytics_opt_out_changed', { analytics_enabled: false }); // last event before switching off
    setOptOut(!next);
    if (next) track('analytics_opt_out_changed', { analytics_enabled: true });
    setAnalyticsOn(next);
  };
  const ok = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const save = () => {
    if (hasPw && !verify(cur)) return setMsg('Current password is incorrect');
    if (!pw) return setMsg('Enter a new password');
    if (pw !== pw2) return setMsg('Passwords do not match');
    setPassword(pw); setPw(''); setPw2(''); setCur(''); ok('Password saved ✓');
  };
  const remove = () => {
    if (hasPw && !verify(cur)) return setMsg('Current password is incorrect');
    setPassword(null); setHidden(false); setCur(''); ok('Password removed ✓');
  };
  const toggle = () => {
    if (hidden && passwordHash) {
      const p = window.prompt('Enter password to reveal amounts');
      if (p == null) return;
      if (!verify(p)) return window.alert('Incorrect password');
    }
    setHidden(!hidden);
  };

  return (
    <SectionCard icon={<Shield size={18} color="#047857"/>} title="Privacy — Hide Amounts">
      <div style={{ fontSize:13, color:'var(--text2)', marginBottom:14, lineHeight:1.6 }}>
        Hide every amount in the app behind <b>••••</b>. Tap the eye icon on the balance card any time — set a password below so only you can reveal them again.
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderRadius:12, background:'var(--surface2)', marginBottom:14 }}>
        <span style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>
          {hidden ? '🙈 Amounts are hidden' : '👁️ Amounts are visible'}
        </span>
        <button className="btn btn-ghost" onClick={toggle} style={{ padding:'7px 16px' }}>
          {hidden ? 'Show' : 'Hide'}
        </button>
      </div>

      {msg && (
        <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color: msg.includes('✓') ? '#047857' : '#DC2626' }}>{msg}</div>
      )}

      <div style={{ display:'grid', gap:12 }}>
        {hasPw && (
          <div className="form-group">
            <label className="form-label">Current password</label>
            <input type="password" className="form-input" value={cur} onChange={e=>setCur(e.target.value)} placeholder="••••••"/>
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="form-group">
            <label className="form-label">{hasPw ? 'New password' : 'Password'}</label>
            <input type="password" className="form-input" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••"/>
          </div>
          <div className="form-group">
            <label className="form-label">Confirm</label>
            <input type="password" className="form-input" value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="••••••"/>
          </div>
        </div>
      </div>

      <div style={{ display:'flex', gap:10, marginTop:4 }}>
        <button className="btn btn-primary" onClick={save} style={{ background:'#1D4ED8', border:'none', boxShadow:'0 4px 14px rgba(29,78,216,.35)' }}>
          {hasPw ? 'Update password' : 'Set password'}
        </button>
        {hasPw && <button className="btn btn-ghost" onClick={remove}>Remove password</button>}
      </div>

      {/* Usage analytics opt-out */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, marginTop:20, paddingTop:16, borderTop:'1px solid var(--border)' }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>Share anonymous usage data</div>
          <div style={{ fontSize:13, color:'var(--text3)', marginTop:2, lineHeight:1.5 }}>
            Helps us improve Tracksy. It never includes your name, email, amounts, account names or anything you type.
            {typeof navigator !== 'undefined' && navigator.globalPrivacyControl === true && ' Your browser\'s Global Privacy Control is on, so this is already off.'}
          </div>
        </div>
        <button className="btn btn-ghost" role="switch" aria-checked={analyticsOn} disabled={typeof navigator !== 'undefined' && navigator.globalPrivacyControl === true}
          onClick={toggleAnalytics} style={{ padding:'7px 16px', flexShrink:0 }}>
          {analyticsOn ? 'On' : 'Off'}
        </button>
      </div>
    </SectionCard>
  );
}
import { invalidateFinance } from '../lib/cache';

export function Settings() {
  const { user, updateUser } = useAuthStore2();
  const { currency, setCurrency } = useCurrencyStore2();
  const { lang, setLang } = useLangStore2();
  const t = useT2();
  const navigate3 = useNavigate3();
  const [form, setForm2] = useState2({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    currency:   user?.currency   || 'USD',
    language:   user?.language   || 'en',
  });
  const [saved, setSaved]           = useState2(false);
  const [resetModal, setResetModal] = useState2(false);
  const [exporting, setExporting]   = useState2(false);
  const [exportDone, setExportDone] = useState2(false);
  const [sampleLoaded, setSampleLoaded] = useState2(false);
  const [sampleBusy, setSampleBusy]     = useState2('');

  useEffect(() => { dataAPI.sampleStatus().then(r => setSampleLoaded(!!r.data.loaded)).catch(()=>{}); }, []);

  const loadSample = async () => {
    setSampleBusy('load');
    try {
      await dataAPI.sampleLoad();
      // fire the event before the hard redirect so it isn't lost with the page
      trackThen('sample_data_loaded', {}, () => { window.location.href = '/dashboard'; });
    } catch (e) { setSampleBusy(''); alert(e.response?.data?.message || 'Failed to load sample data'); }
  };
  const removeSample = async () => {
    setSampleBusy('remove');
    try {
      await dataAPI.sampleRemove();
      trackThen('sample_data_removed', {}, () => { window.location.href = '/dashboard'; });
    } catch (e) { setSampleBusy(''); alert(e.response?.data?.message || 'Failed to remove sample data'); }
  };

  const mutation = useMutation2({
    mutationFn: (data) => authAPI.updateProfile(data),
    onSuccess: (res) => { track('profile_updated'); updateUser(res.data.user); setSaved(true); setTimeout(()=>setSaved(false),2500); },
  });

  const initials = `${user?.first_name?.[0]||''}${user?.last_name?.[0]||''}`.toUpperCase();

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await dataAPI.export();
      const blob = new Blob([JSON.stringify(res.data.data, null, 2)], { type:'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `tracksy-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click(); URL.revokeObjectURL(url);
      track('data_exported');
      setExportDone(true); setTimeout(()=>setExportDone(false), 3000);
    } catch { }
    setExporting(false);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <Topbar3 title={t('settings_title')} subtitle={t('settings_subtitle')}/>
      <div style={{ padding:'28px 32px 40px', flex:1, overflow:'auto' }}>
        <div style={{ maxWidth:680 }}>

          {saved && (
            <div style={{ background:'rgba(4,120,87,.12)', color:'#047857', padding:'12px 16px', borderRadius:14, marginBottom:20, fontSize:13.5, fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
              {t('settings_saved')}
            </div>
          )}

          {/* Profile hero */}
          <div style={{ background:'#1D4ED8', borderRadius:14, padding:'28px 32px', marginBottom:20, color:'#fff', display:'flex', alignItems:'center', gap:20, boxShadow:'0 8px 32px rgba(29,78,216,.3)', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-30, right:-30, width:100, height:100, background:'rgba(255,255,255,.08)', borderRadius:'50%' }}/>
            <div style={{ position:'absolute', bottom:-20, right:80, width:60, height:60, background:'rgba(255,255,255,.05)', borderRadius:'50%' }}/>
            <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:22, fontWeight:700, flexShrink:0, backdropFilter:'blur(10px)', border:'2px solid rgba(255,255,255,.3)' }}>
              {initials}
            </div>
            <div style={{ position:'relative', zIndex:1, flex:1 }}>
              <div style={{ fontSize:20, fontWeight:800, letterSpacing:-0.3 }}>{user?.first_name} {user?.last_name}</div>
              <div style={{ fontSize:13, opacity:.8, marginTop:2 }}>{user?.email}</div>
            </div>
          </div>

          {/* Profile form */}
          <SectionCard icon={<User size={18} color="#1D4ED8"/>} title={t('settings_profile')}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">{t('settings_first_name')}</label>
                <input className="form-input" value={form.first_name} onChange={e=>setForm2(f=>({...f,first_name:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">{t('settings_last_name')}</label>
                <input className="form-input" value={form.last_name} onChange={e=>setForm2(f=>({...f,last_name:e.target.value}))}/>
              </div>
            </div>
            <button className="btn btn-primary" disabled={mutation.isPending} onClick={()=>mutation.mutate(form)}
              style={{ background:'#1D4ED8', border:'none', boxShadow:'0 4px 14px rgba(29,78,216,.35)' }}>
              {mutation.isPending ? t('modal_saving') : t('settings_save')}
            </button>
          </SectionCard>

          {/* Currency & Region */}
          <SectionCard icon={<Globe size={18} color="#3B82F6"/>} title={t('settings_currency_region')}>
            <div className="stack-mobile" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">{t('settings_currency')}</label>
                <ThemedSelect value={currency} onChange={(v) => { setCurrency(v); track('currency_changed', { currency: v }); }}
                  options={ALL_CURRENCIES.map(c => ({ value:c.code, label:`${c.code} — ${c.name}`, emoji:c.flag }))}/>
              </div>
              <div className="form-group">
                <label className="form-label">{t('settings_language')}</label>
                <ThemedSelect value={lang} onChange={(v) => { setLang(v); track('language_changed', { language: v }); }}
                  options={[
                    { value:'en', label:'English', emoji:'🇬🇧' },
                    { value:'ta', label:'தமிழ் (Tamil)', emoji:'🇮🇳' },
                  ]}/>
              </div>
            </div>
            <button className="btn btn-ghost" onClick={() => { setSaved(true); setTimeout(()=>setSaved(false),2500); }}>{t('settings_save_prefs')}</button>
          </SectionCard>

          {/* Privacy — hide amounts behind a password */}
          <PrivacySection />

          {/* Categories — moved out of main menu */}
          <SectionCard icon={<Tag size={18} color="#60A5FA"/>} title="Categories">
            <div
              onClick={() => navigate3('/categories')}
              style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:14, border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer', transition:'border-color .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor='#60A5FA'}
              onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
              <div style={{ width:40, height:40, borderRadius:12, background:'rgba(96,165,250,.14)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Tag size={18} color="#60A5FA"/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text)' }}>Manage Categories</div>
                <div style={{ fontSize:12.5, color:'var(--text3)', marginTop:2 }}>Add, edit or organise your income &amp; expense categories</div>
              </div>
              <Chevron size={18} color="var(--text3)" style={{ flexShrink:0 }}/>
            </div>
          </SectionCard>

          {/* Notifications */}
          <NotificationPrefsSection />

          {/* Security / Change Password */}
          <ChangePasswordSection user={user} />

          {/* Data Backup */}
          <SectionCard icon={<Download size={18} color="#3B82F6"/>} title="Data Backup & Export">
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13.5, color:'var(--text)', lineHeight:1.6, marginBottom:10 }}>
                  Download all your financial data — transactions, wallets, budgets, goals and categories — as a JSON file you can store safely or import elsewhere.
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {['Transactions','Wallets','Budgets','Goals','Categories'].map(t => (
                    <span key={t} style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:14, background:'var(--accent-light)', color:'var(--accent)' }}>{t}</span>
                  ))}
                </div>
              </div>
              <button onClick={handleExport} disabled={exporting}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:12, fontWeight:700, fontSize:13.5, cursor:'pointer', flexShrink:0, background: exportDone?'rgba(4,120,87,.15)':'var(--accent-light)', border: exportDone?'1.5px solid #047857':'1.5px solid var(--accent)', color: exportDone?'#047857':'var(--accent)', transition:'all .2s' }}>
                <Download size={15}/> {exporting ? 'Exporting…' : exportDone ? '✓ Downloaded!' : 'Export JSON'}
              </button>
            </div>
          </SectionCard>

          {/* Sample / Demo Data */}
          <SectionCard icon={<Sparkles size={18} color="#1D4ED8"/>} title="Sample Data">
            <div style={{ fontSize:13.5, color:'var(--text3)', marginBottom:16, lineHeight:1.6 }}>
              Load a full year of demo data — accounts, credit card, loan, assets, transactions, budgets & goals — to explore every feature. Your real data is never touched; remove the demo anytime to return to normal.
            </div>
            {sampleLoaded ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderRadius:14, background:'rgba(4,120,87,.1)', border:'1px solid #04785722', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)' }}>✓ Demo data is active</div>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>Remove it to return to your normal data</div>
                </div>
                <button onClick={removeSample} disabled={!!sampleBusy}
                  style={{ padding:'8px 18px', borderRadius:10, border:'1.5px solid #DC2626', background:'transparent', color:'#DC2626', fontSize:12.5, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                  {sampleBusy==='remove' ? 'Removing…' : 'Return to Normal'}
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderRadius:14, background:'rgba(29,78,216,.1)', border:'1px solid #1d4ed822', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)' }}>Load 1 year of demo data</div>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>See how Tracksy looks fully populated</div>
                </div>
                <button onClick={loadSample} disabled={!!sampleBusy}
                  style={{ padding:'8px 18px', borderRadius:10, border:'none', background:'#1D4ED8', color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                  {sampleBusy==='load' ? 'Loading…' : 'Load Sample Data'}
                </button>
              </div>
            )}
          </SectionCard>

          {/* Reset Data */}
          <SectionCard icon={<Trash2 size={18} color="#DC2626"/>} title="Reset Data">
            <div style={{ fontSize:13.5, color:'var(--text3)', marginBottom:16, lineHeight:1.6 }}>
              Permanently delete selected data. <strong style={{color:'var(--red)'}}>This cannot be undone.</strong> Export a backup first.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { scope:'transactions', label:'Clear All Transactions',      desc:'Remove every income & expense record',       color:'#D97706', bg:'rgba(217,119,6,.1)' },
                { scope:'budgets',      label:'Delete All Budgets',           desc:'Remove all monthly budget configurations',   color:'#3B82F6', bg:'rgba(59,130,246,.1)'  },
                { scope:'goals',        label:'Delete All Goals',             desc:'Remove all saving goals and progress',       color:'#047857', bg:'rgba(4,120,87,.1)'  },
                { scope:'all',          label:'⚠️ Reset Everything',           desc:'Wipe all data — wallets, transactions, budgets, goals & categories', color:'#DC2626', bg:'rgba(220,38,38,.1)'   },
              ].map(({ scope, label, desc, color, bg }) => (
                <div key={scope} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderRadius:14, background:bg, border:`1px solid ${color}22`, gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)' }}>{label}</div>
                    <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{desc}</div>
                  </div>
                  <button onClick={() => setResetModal(scope)}
                    style={{ padding:'7px 16px', borderRadius:10, border:`1.5px solid ${color}`, background:'transparent', color:color, fontSize:12.5, fontWeight:700, cursor:'pointer', flexShrink:0, transition:'all .15s' }}
                    onMouseEnter={e=>{ e.currentTarget.style.background=bg; }}
                    onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; }}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Admin panel button — only for admins */}
          {user?.is_admin && (
            <div onClick={() => navigate3('/admin')} style={{ cursor:'pointer', background:'linear-gradient(135deg,#0B1F4B 0%,#12306B 100%)', borderRadius:14, padding:'18px 24px', marginBottom:16, display:'flex', alignItems:'center', gap:16, boxShadow:'0 4px 24px rgba(29,78,216,.15)', border:'1px solid rgba(29,78,216,.4)', transition:'transform .2s' }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
              onMouseLeave={e=>e.currentTarget.style.transform=''}>
              <div style={{ width:46, height:46, borderRadius:14, background:'#1D4ED8', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M4 4h7v7H4V4zm0 9h7v7H4v-7zm9-9h7v7h-7V4zm0 9h7v7h-7v-7z"/></svg>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:3 }}>Admin Dashboard</div>
                <div style={{ fontSize:12.5, color:'rgba(255,255,255,.5)' }}>Users, stats, premium management & more</div>
              </div>
              <div style={{ background:'rgba(29,78,216,.25)', border:'1px solid rgba(29,78,216,.5)', borderRadius:12, padding:'8px 16px', color:'#60A5FA', fontSize:13, fontWeight:700, flexShrink:0 }}>
                Open →
              </div>
            </div>
          )}

        </div>
      </div>

      {resetModal && <ResetModal scope={resetModal} onClose={() => setResetModal(false)}/>}
    </div>
  );
}

/* ── Notification Preferences section ─────────────────────────── */
function NotificationPrefsSection() {
  const { data: prefs, isLoading } = useQuery2({
    queryKey: ['notification-prefs'],
    queryFn: () => authAPI.getNotificationPrefs().then(r => r.data.data),
  });
  const qcNotif = useQueryClient();
  const [local, setLocal] = useState2(null);
  const [saving, setSaving] = useState2(false);
  const [savedNotif, setSavedNotif] = useState2(false);

  // Sync local state when prefs load
  if (prefs && !local) setLocal({ ...prefs });

  const toggle = (key) => setLocal(p => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    if (!local) return;
    setSaving(true);
    try {
      await authAPI.updateNotificationPrefs({
        transaction_alerts: local.transaction_alerts,
        budget_warnings:    local.budget_warnings,
        weekly_summary:     local.weekly_summary,
        goal_milestones:    local.goal_milestones,
      });
      qcNotif.invalidateQueries({ queryKey: ['notification-prefs'] });
      track('notification_prefs_updated');
      setSavedNotif(true); setTimeout(() => setSavedNotif(false), 2500);
    } catch(e) {}
    setSaving(false);
  };

  const NOTIF_ITEMS = [
    { key:'transaction_alerts', label:'Transaction alerts',  desc:'Get notified for every transaction' },
    { key:'budget_warnings',    label:'Budget warnings',     desc:'Alert when you are near the limit' },
    { key:'weekly_summary',     label:'Weekly summary',      desc:'Weekly email digest of your activity' },
    { key:'goal_milestones',    label:'Goal milestones',     desc:'Celebrate when you hit savings goals' },
  ];

  const display = local || {};

  return (
    <SectionCard icon={<Bell size={18} color="#D97706"/>} title="Notifications">
      {isLoading ? (
        <div style={{ fontSize:13, color:'var(--text3)', padding:'12px 0' }}>Loading preferences…</div>
      ) : (
        <>
          {NOTIF_ITEMS.map(({ key, label, desc }) => (
            <label key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid var(--border-light)', cursor:'pointer' }}>
              <div>
                <div style={{ fontSize:13.5, fontWeight:600, color:'var(--text)' }}>{label}</div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{desc}</div>
              </div>
              <input type="checkbox" checked={!!display[key]} onChange={() => toggle(key)}
                style={{ accentColor:'var(--accent)', width:18, height:18, cursor:'pointer', flexShrink:0 }}/>
            </label>
          ))}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:14 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding:'9px 20px', borderRadius:11, background:'#1D4ED8', color:'#fff', border:'none', fontWeight:700, fontSize:13, cursor:'pointer', opacity: saving ? .7 : 1 }}>
              {saving ? 'Saving…' : 'Save Preferences'}
            </button>
            {savedNotif && <span style={{ fontSize:12.5, color:'#047857', fontWeight:600 }}>✅ Saved!</span>}
          </div>
        </>
      )}
    </SectionCard>
  );
}

/* ── Change Password section ───────────────────────────── */
function ChangePasswordSection({ user }) {
  const [open, setOpen] = useState2(false);
  const [showCurrent, setShowCurrent] = useState2(false);
  const [showNew, setShowNew] = useState2(false);
  const [showConfirm, setShowConfirm] = useState2(false);
  const [form, setFormPwd] = useState2({ current_password: '', new_password: '', confirm_password: '' });
  const [error, setError2] = useState2('');
  const [success, setSuccess2] = useState2('');
  const [saving, setSavingPwd] = useState2(false);

  const setF = (k, v) => setFormPwd(f => ({ ...f, [k]: v }));

  const handleChangePwd = async () => {
    setError2(''); setSuccess2('');
    if (!form.current_password || !form.new_password)
      return setError2('Please fill in all fields');
    if (form.new_password.length < 8)
      return setError2('New password must be at least 8 characters');
    if (form.new_password !== form.confirm_password)
      return setError2('New passwords do not match');
    setSavingPwd(true);
    try {
      await authAPI.changePassword({ current_password: form.current_password, new_password: form.new_password });
      track('password_changed');
      setSuccess2('Password changed successfully!');
      setFormPwd({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => { setOpen(false); setSuccess2(''); }, 2500);
    } catch(e) {
      setError2(e.response?.data?.message || 'Failed to change password');
    }
    setSavingPwd(false);
  };

  const inputWrap = { position: 'relative', display: 'flex', alignItems: 'center' };
  const eyeBtn = { position:'absolute', right:10, background:'none', border:'none', cursor:'pointer', color:'var(--text3)', display:'flex', padding:4 };

  return (
    <SectionCard icon={<Shield size={18} color="#047857"/>} title="Security">
      {/* Change Password */}
      <div style={{ borderBottom:'1px solid var(--border-light)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', cursor:'pointer' }}
          onClick={() => setOpen(o => !o)}>
          <div>
            <div style={{ fontSize:13.5, fontWeight:600, color:'var(--text)' }}>Change Password</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
              {user?.oauth_provider ? 'Not available for social login accounts' : 'Update your account password'}
            </div>
          </div>
          {!user?.oauth_provider && <Chevron size={16} color="var(--text3)" style={{ transition:'transform .2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}/>}
        </div>

        {open && !user?.oauth_provider && (
          <div style={{ paddingBottom:16 }}>
            {error && <div style={{ background:'rgba(220,38,38,.1)', border:'1px solid rgba(220,38,38,.3)', borderRadius:10, padding:'9px 13px', marginBottom:12, color:'#DC2626', fontSize:13 }}>{error}</div>}
            {success && <div style={{ background:'rgba(4,120,87,.1)', border:'1px solid rgba(4,120,87,.3)', borderRadius:10, padding:'9px 13px', marginBottom:12, color:'#047857', fontSize:13 }}>{success}</div>}

            {[
              { key:'current_password', label:'Current Password', show:showCurrent, toggle:()=>setShowCurrent(s=>!s) },
              { key:'new_password',     label:'New Password',     show:showNew,     toggle:()=>setShowNew(s=>!s) },
              { key:'confirm_password', label:'Confirm New Password', show:showConfirm, toggle:()=>setShowConfirm(s=>!s) },
            ].map(({ key, label, show, toggle }) => (
              <div key={key} className="form-group" style={{ marginBottom:10 }}>
                <label className="form-label">{label}</label>
                <div style={inputWrap}>
                  <input className="form-input" type={show ? 'text' : 'password'}
                    value={form[key]} onChange={e => setF(key, e.target.value)}
                    style={{ paddingRight:38 }} placeholder="••••••••"/>
                  <button style={eyeBtn} onClick={toggle} type="button" tabIndex={-1}>
                    {show ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>
            ))}

            <button onClick={handleChangePwd} disabled={saving}
              style={{ marginTop:4, padding:'9px 20px', borderRadius:11, background:'#047857', color:'#fff', border:'none', fontWeight:700, fontSize:13, cursor:'pointer', opacity: saving ? .7 : 1, display:'flex', alignItems:'center', gap:8 }}>
              <Key size={14}/> {saving ? 'Changing…' : 'Change Password'}
            </button>
          </div>
        )}
      </div>

      {/* Login history note */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0' }}>
        <div>
          <div style={{ fontSize:13.5, fontWeight:600, color:'var(--text)' }}>Login History</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>Review recent account activity</div>
        </div>
        <Chevron size={16} color="var(--text3)"/>
      </div>
    </SectionCard>
  );
}

/* ── Reset confirmation modal ──────────────────────────── */
function ResetModal({ scope, onClose }) {
  const [confirm, setConfirm] = useState2('');
  const [done, setDone]       = useState2(false);
  const labels = { transactions:'All Transactions', budgets:'All Budgets', goals:'All Goals', all:'ALL DATA' };

  const mutation = useMutation2({
    mutationFn: () => dataAPI.reset(scope),
    onSuccess: () => {
      track('data_reset', { scope });
      setDone(true);
      // Drop the persisted query cache too — otherwise the reload below restores
      // the deleted data straight back out of localStorage.
      try { window.localStorage.removeItem('tracksy-cache'); } catch {}
      setTimeout(() => { onClose(); window.location.reload(); }, 1800);
    },
  });

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:420 }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, marginBottom:20, textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:14, background:'rgba(220,38,38,.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <AlertTriangle size={28} color="#DC2626"/>
          </div>
          <div style={{ fontSize:18, fontWeight:800, color:'var(--text)' }}>Delete {labels[scope]}?</div>
          <div style={{ fontSize:13.5, color:'var(--text3)', lineHeight:1.6 }}>
            This will permanently remove {scope === 'all' ? 'all your data including wallets, transactions, budgets, goals and categories' : `all your ${labels[scope].toLowerCase()}`}. This action <strong>cannot be undone</strong>.
          </div>
        </div>

        {!done ? (
          <>
            <div className="form-group">
              <label className="form-label">Type <b>DELETE</b> to confirm</label>
              <input className="form-input" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="DELETE" autoFocus/>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn" disabled={confirm !== 'DELETE' || mutation.isPending} onClick={() => mutation.mutate()}
                style={{ background:'#DC2626', border:'none', boxShadow:'0 4px 14px rgba(220,38,38,.35)', color:'#fff', padding:'8px 20px', borderRadius:10, fontWeight:700, cursor: confirm==='DELETE'?'pointer':'not-allowed', opacity: confirm==='DELETE'?1:.5 }}>
                {mutation.isPending ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign:'center', padding:'12px 0', fontSize:15, fontWeight:700, color:'#047857' }}>
            ✅ Data deleted. Refreshing…
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({ icon, title, children }) {
  return (
    <div style={{ background:'var(--surface)', borderRadius:14, padding:'22px 24px', boxShadow:'0 4px 24px rgba(29,78,216,.08)', border:'1px solid var(--border-light)', marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <div style={{ width:34, height:34, borderRadius:10, background:'var(--accent-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {icon}
        </div>
        <div style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

