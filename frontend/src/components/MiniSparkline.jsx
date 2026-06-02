/**
 * Reusable mini SVG sparkline — used by Budget, Goals, Wallet summary cards.
 * Props:
 *   data[]  - array of numbers (6 months, oldest → newest)
 *   color   - stroke/fill colour
 *   height  - SVG height in px (default 32)
 */
export default function MiniSparkline({ data = [], color = '#6C63FF', height = 32 }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:9, color:'var(--text3)' }}>—</span>
      </div>
    );
  }
  const W = 100;
  const H = height;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pad = 3;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = pad + (H - pad * 2) - ((v - min) / range) * (H - pad * 2);
    return [x, y];
  });
  const polyPts = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const areaPts = [
    `${pts[0][0]},${H}`,
    ...pts.map(([x, y]) => `${x},${y}`),
    `${pts[pts.length - 1][0]},${H}`,
  ].join(' ');
  const gradId  = `sg${color.replace(/[^a-zA-Z0-9]/g, '')}`;
  const lastPt  = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`}
      style={{ width:'100%', height, overflow:'visible', display:'block' }}
      preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.28"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={areaPts} fill={`url(#${gradId})`}/>
      <polyline points={polyPts} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
      <circle cx={lastPt[0]} cy={lastPt[1]} r="3" fill={color} vectorEffect="non-scaling-stroke"/>
    </svg>
  );
}
