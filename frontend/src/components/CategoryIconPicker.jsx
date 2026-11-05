import { ICON_REGISTRY } from './icons/CategoryIcon';

/* Grid of choosable category icons. Selecting one calls onChange(key);
   selecting the active one again clears it (falls back to name/emoji). */
export default function CategoryIconPicker({ value, onChange, color = '#4F46E5' }) {
  const keys = Object.keys(ICON_REGISTRY);
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(46px,1fr))', gap:8 }}>
      {keys.map(key => {
        const { Icon, color: ic } = ICON_REGISTRY[key];
        const sel = value === key;
        return (
          <button key={key} type="button" onClick={() => onChange(sel ? '' : key)}
            title={key}
            style={{
              aspectRatio:'1 / 1', display:'flex', alignItems:'center', justifyContent:'center',
              borderRadius:12, cursor:'pointer',
              border: sel ? `2px solid ${color}` : '1.5px solid var(--border)',
              background: sel ? `${color}18` : 'var(--surface2)',
              transition:'all .12s',
            }}>
            <Icon size={19} color={sel ? color : ic} />
          </button>
        );
      })}
    </div>
  );
}
