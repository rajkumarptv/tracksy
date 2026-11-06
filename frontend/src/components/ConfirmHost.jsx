import { useEffect, useState } from 'react';
import { registerConfirmHost } from '../lib/confirm';

export default function ConfirmHost() {
  const [req, setReq] = useState(null);
  useEffect(() => registerConfirmHost(setReq), []);
  if (!req) return null;
  const done = (v) => { req.resolve(v); setReq(null); };
  return (
    <div role="presentation" onClick={() => done(false)}
      style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(15,23,42,.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div role="alertdialog" aria-modal="true" aria-label={req.message} onClick={e => e.stopPropagation()}
        style={{ background:'var(--surface)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:16, padding:20, width:'100%', maxWidth:360, boxShadow:'var(--shadow-lg)' }}>
        <p style={{ margin:'0 0 18px', fontSize:15, lineHeight:1.5 }}>{req.message}</p>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button type="button" autoFocus onClick={() => done(false)}
            style={{ minHeight:44, padding:'0 18px', borderRadius:10, border:'1px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:15, fontWeight:600, cursor:'pointer' }}>Cancel</button>
          <button type="button" onClick={() => done(true)}
            style={{ minHeight:44, padding:'0 18px', borderRadius:10, border:'none', background: req.danger ? 'var(--red)' : 'var(--accent)', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>{req.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
