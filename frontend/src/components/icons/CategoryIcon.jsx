import {
  FaUtensils, FaShoppingBag, FaCar, FaBolt, FaFilm, FaHeartbeat,
  FaShoppingCart, FaPlane, FaGraduationCap, FaChartLine, FaUniversity,
  FaHome, FaShieldAlt, FaRedo, FaSpa, FaPiggyBank, FaCreditCard,
  FaEllipsisH, FaTag, FaMoneyBillAlt, FaLaptop, FaDumbbell,
  FaGift, FaGamepad, FaBriefcase, FaWifi, FaCoffee,
} from 'react-icons/fa';

/* category name → { Icon, bg, color } */
const MAP = {
  'food & dining':   { Icon: FaUtensils,    bg: 'rgba(5,150,105,.2)',   color: '#059669' },
  'food':            { Icon: FaUtensils,    bg: 'rgba(5,150,105,.2)',   color: '#059669' },
  'dining':          { Icon: FaUtensils,    bg: 'rgba(5,150,105,.2)',   color: '#059669' },
  'restaurant':      { Icon: FaCoffee,      bg: 'rgba(5,150,105,.2)',   color: '#059669' },
  'coffee':          { Icon: FaCoffee,      bg: 'rgba(217,119,6,.2)',   color: '#D97706' },
  'groceries':       { Icon: FaShoppingCart,bg: 'rgba(0,206,201,.2)',    color: '#00CEC9' },
  'grocery':         { Icon: FaShoppingCart,bg: 'rgba(0,206,201,.2)',    color: '#00CEC9' },
  'shopping':        { Icon: FaShoppingBag, bg: 'rgba(59,130,246,.2)',   color: '#3B82F6' },
  'transport':       { Icon: FaCar,         bg: 'rgba(79,70,229,.2)',   color: '#4F46E5' },
  'transportation':  { Icon: FaCar,         bg: 'rgba(79,70,229,.2)',   color: '#4F46E5' },
  'travel':          { Icon: FaPlane,       bg: 'rgba(59,130,246,.2)',   color: '#3B82F6' },
  'bills & utilities':{ Icon: FaBolt,       bg: 'rgba(217,119,6,.2)',   color: '#D97706' },
  'utilities':       { Icon: FaBolt,        bg: 'rgba(217,119,6,.2)',   color: '#D97706' },
  'electricity':     { Icon: FaBolt,        bg: 'rgba(217,119,6,.2)',   color: '#D97706' },
  'entertainment':   { Icon: FaFilm,        bg: 'rgba(220,38,38,.2)',    color: '#DC2626' },
  'movies':          { Icon: FaFilm,        bg: 'rgba(220,38,38,.2)',    color: '#DC2626' },
  'gaming':          { Icon: FaGamepad,     bg: 'rgba(162,155,254,.2)',  color: '#818CF8' },
  'health':          { Icon: FaHeartbeat,   bg: 'rgba(255,121,168,.2)',  color: '#F87171' },
  'medical':         { Icon: FaHeartbeat,   bg: 'rgba(255,121,168,.2)',  color: '#F87171' },
  'fitness':         { Icon: FaDumbbell,    bg: 'rgba(255,121,168,.2)',  color: '#F87171' },
  'education':       { Icon: FaGraduationCap,bg:'rgba(59,130,246,.2)',   color: '#3B82F6' },
  'investment':      { Icon: FaChartLine,   bg: 'rgba(5,150,105,.2)',   color: '#059669' },
  'investments':     { Icon: FaChartLine,   bg: 'rgba(5,150,105,.2)',   color: '#059669' },
  'salary':          { Icon: FaUniversity,  bg: 'rgba(5,150,105,.2)',   color: '#059669' },
  'income':          { Icon: FaMoneyBillAlt,bg: 'rgba(5,150,105,.2)',   color: '#059669' },
  'rent':            { Icon: FaHome,        bg: 'rgba(217,119,6,.2)',   color: '#D97706' },
  'housing':         { Icon: FaHome,        bg: 'rgba(217,119,6,.2)',   color: '#D97706' },
  'insurance':       { Icon: FaShieldAlt,   bg: 'rgba(59,130,246,.2)',   color: '#3B82F6' },
  'subscriptions':   { Icon: FaRedo,        bg: 'rgba(162,155,254,.2)',  color: '#818CF8' },
  'personal care':   { Icon: FaSpa,         bg: 'rgba(255,121,168,.2)',  color: '#F87171' },
  'savings':         { Icon: FaPiggyBank,   bg: 'rgba(162,155,254,.2)',  color: '#818CF8' },
  'debt':            { Icon: FaCreditCard,  bg: 'rgba(220,38,38,.2)',    color: '#DC2626' },
  'loan':            { Icon: FaCreditCard,  bg: 'rgba(220,38,38,.2)',    color: '#DC2626' },
  'wifi':            { Icon: FaWifi,        bg: 'rgba(59,130,246,.2)',   color: '#3B82F6' },
  'internet':        { Icon: FaWifi,        bg: 'rgba(59,130,246,.2)',   color: '#3B82F6' },
  'electronics':     { Icon: FaLaptop,      bg: 'rgba(79,70,229,.2)',   color: '#4F46E5' },
  'gifts':           { Icon: FaGift,        bg: 'rgba(255,121,168,.2)',  color: '#F87171' },
  'business':        { Icon: FaBriefcase,   bg: 'rgba(79,70,229,.2)',   color: '#4F46E5' },
  'uncategorized':   { Icon: FaTag,         bg: 'rgba(150,150,150,.2)',  color: '#9896B2' },
  'others':          { Icon: FaEllipsisH,   bg: 'rgba(220,38,38,.2)',    color: '#DC2626' },
};

const DEFAULT = { Icon: FaTag, bg: 'rgba(150,150,150,.2)', color: '#9896B2' };

/* Pickable icon library — key → { Icon, color }. Used by the category icon
   picker and to render a category's explicitly chosen `icon` key. */
export const ICON_REGISTRY = {
  utensils:   { Icon: FaUtensils,     color: '#059669' },
  coffee:     { Icon: FaCoffee,       color: '#D97706' },
  groceries:  { Icon: FaShoppingCart, color: '#00CEC9' },
  shopping:   { Icon: FaShoppingBag,  color: '#3B82F6' },
  transport:  { Icon: FaCar,          color: '#4F46E5' },
  travel:     { Icon: FaPlane,        color: '#3B82F6' },
  bills:      { Icon: FaBolt,         color: '#D97706' },
  entertainment:{ Icon: FaFilm,       color: '#DC2626' },
  gaming:     { Icon: FaGamepad,      color: '#818CF8' },
  health:     { Icon: FaHeartbeat,    color: '#F87171' },
  fitness:    { Icon: FaDumbbell,     color: '#F87171' },
  education:  { Icon: FaGraduationCap,color: '#3B82F6' },
  investment: { Icon: FaChartLine,    color: '#059669' },
  salary:     { Icon: FaUniversity,   color: '#059669' },
  income:     { Icon: FaMoneyBillAlt, color: '#059669' },
  home:       { Icon: FaHome,         color: '#D97706' },
  insurance:  { Icon: FaShieldAlt,    color: '#3B82F6' },
  subscriptions:{ Icon: FaRedo,       color: '#818CF8' },
  personalcare:{ Icon: FaSpa,         color: '#F87171' },
  savings:    { Icon: FaPiggyBank,    color: '#818CF8' },
  debt:       { Icon: FaCreditCard,   color: '#DC2626' },
  wifi:       { Icon: FaWifi,         color: '#3B82F6' },
  electronics:{ Icon: FaLaptop,       color: '#4F46E5' },
  gifts:      { Icon: FaGift,         color: '#F87171' },
  business:   { Icon: FaBriefcase,    color: '#4F46E5' },
  tag:        { Icon: FaTag,          color: '#9896B2' },
  others:     { Icon: FaEllipsisH,    color: '#DC2626' },
};

/* Returns the matched icon-pack entry, or null when the category name isn't
   recognised (so callers can fall back to a custom emoji). */
function match(name = '') {
  const key = name.toLowerCase().trim();
  if (MAP[key]) return MAP[key];
  for (const [k, v] of Object.entries(MAP)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

function resolve(name = '') {
  return match(name) || DEFAULT;
}

/* Bare icon glyph (no container) for inline use — e.g. dropdown rows.
   Recognised categories → icon pack; unknown categories with a custom emoji
   keep the emoji; otherwise a neutral tag icon. */
export function CategoryGlyph({ name = '', emoji, icon, size = 16, color }) {
  if (icon && ICON_REGISTRY[icon]) { const { Icon, color: c } = ICON_REGISTRY[icon]; return <Icon size={size} color={color || c} />; }
  const m = match(name);
  if (m) { const { Icon, color: c } = m; return <Icon size={size} color={color || c} />; }
  if (emoji && emoji !== '📌') return <span style={{ fontSize: size + 1 }}>{emoji}</span>;
  return <FaTag size={size} color={color || DEFAULT.color} />;
}

/**
 * CategoryIcon — shows the right icon for any category
 * Props:
 *   name     — category name string
 *   emoji    — optional emoji override from DB
 *   size     — container px (default 36)
 *   iconSize — icon px (default 16)
 *   style    — extra container styles
 */
export default function CategoryIcon({ name = '', emoji, icon, size = 36, iconSize = 16, style }) {
  const explicit = icon && ICON_REGISTRY[icon] ? { ...ICON_REGISTRY[icon], bg: `${ICON_REGISTRY[icon].color}22` } : null;
  const matched = explicit || match(name);

  /* Recognised categories → budgeting icon pack (consistent app-wide) */
  if (matched) {
    const { Icon, bg, color } = matched;
    return (
      <div style={{
        width: size, height: size, borderRadius: size * 0.35, background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, ...style,
      }}>
        <Icon size={iconSize} color={color}/>
      </div>
    );
  }

  /* Unknown/custom category → keep its DB emoji if it has one */
  if (emoji && emoji !== '📌') {
    return (
      <div style={{
        width: size, height: size, borderRadius: size * 0.35, background: DEFAULT.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: iconSize + 2, flexShrink: 0, ...style,
      }}>
        {emoji}
      </div>
    );
  }

  const { Icon, bg, color } = DEFAULT;
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.35, background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, ...style,
    }}>
      <Icon size={iconSize} color={color}/>
    </div>
  );
}
