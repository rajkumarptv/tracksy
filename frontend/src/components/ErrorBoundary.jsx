import { Component } from 'react';

/* Catches render-time crashes so the app never shows a blank white screen.
   Stale-chunk errors (after a redeploy) trigger one automatic reload; anything
   else shows a friendly retry card. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error) {
    const msg = error?.message || '';
    if (/Loading chunk|dynamically imported module|Failed to fetch|import\(/i.test(msg)) {
      const KEY = 'eb-reload-at';
      const last = parseInt(sessionStorage.getItem(KEY) || '0', 10);
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
      }
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'var(--bg, #FEFEFE)' }}>
        <div style={{ textAlign:'center', maxWidth:360 }}>
          <div style={{ fontSize:44, marginBottom:12 }}>😵‍💫</div>
          <div style={{ fontSize:18, fontWeight:800, color:'var(--text, #101828)', marginBottom:6 }}>Something went wrong</div>
          <div style={{ fontSize:13.5, color:'var(--text3, #667085)', marginBottom:20 }}>
            The app hit an unexpected error. Reloading usually fixes it.
          </div>
          <button onClick={() => window.location.reload()}
            style={{ padding:'12px 26px', borderRadius:14, border:'none', cursor:'pointer', fontSize:14, fontWeight:700,
              background:'linear-gradient(135deg,#8B5CF6,#3B82F6)', color:'#fff', boxShadow:'0 8px 24px rgba(139,92,246,.35)' }}>
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
