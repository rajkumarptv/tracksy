import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

/* Shows an "Install App" button when the browser offers installation
   (captures the beforeinstallprompt event). Hidden once installed or when
   already running as an installed PWA. */
export default function InstallPWA({ onClick: onClose }) {
  const [deferred, setDeferred] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setHidden(true); return;
    }
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setHidden(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (hidden || !deferred) return null;

  const install = async () => {
    deferred.prompt();
    try { await deferred.userChoice; } catch {}
    setDeferred(null);
    onClose?.();
  };

  return (
    <button onClick={install}
      style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'11px 14px', marginBottom:10,
        borderRadius:12, border:'1.5px solid rgba(29,78,216,.35)', background:'rgba(29,78,216,.1)',
        color:'#1D4ED8', fontSize:13.5, fontWeight:700, cursor:'pointer' }}>
      <Download size={17} /> Install App
    </button>
  );
}
