import {
  FaUtensils, FaShoppingBag, FaCar, FaBolt, FaFilm, FaHeartbeat,
  FaShoppingCart, FaPlane, FaGraduationCap, FaChartLine, FaUniversity,
  FaHome, FaShieldAlt, FaRedo, FaSpa, FaPiggyBank, FaCreditCard,
  FaEllipsisH, FaTag, FaMoneyBillAlt, FaLaptop, FaDumbbell,
  FaGift, FaGamepad, FaBriefcase, FaWifi, FaCoffee,
} from 'react-icons/fa';

/* category name → { Icon, bg, color } */
const MAP = {
  'food & dining':   { Icon: FaUtensils,    bg: 'rgba(34,197,94,.2)',   color: '#22C55E' },
  'food':            { Icon: FaUtensils,    bg: 'rgba(34,197,94,.2)',   color: '#22C55E' },
  'dining':          { Icon: FaUtensils,    bg: 'rgba(34,197,94,.2)',   color: '#22C55E' },
  'restaurant':      { Icon: FaCoffee,      bg: 'rgba(34,197,94,.2)',   color: '#22C55E' },
  'coffee':          { Icon: FaCoffee,      bg: 'rgba(245,158,11,.2)',   color: '#F59E0B' },
  'groceries':       { Icon: FaShoppingCart,bg: 'rgba(0,206,201,.2)',    color: '#00CEC9' },
  'grocery':         { Icon: FaShoppingCart,bg: 'rgba(0,206,201,.2)',    color: '#00CEC9' },
  'shopping':        { Icon: FaShoppingBag, bg: 'rgba(59,130,246,.2)',   color: '#3B82F6' },
  'transport':       { Icon: FaCar,         bg: 'rgba(139,92,246,.2)',   color: '#8B5CF6' },
  'transportation':  { Icon: FaCar,         bg: 'rgba(139,92,246,.2)',   color: '#8B5CF6' },
  'travel':          { Icon: FaPlane,       bg: 'rgba(59,130,246,.2)',   color: '#3B82F6' },
  'bills & utilities':{ Icon: FaBolt,       bg: 'rgba(245,158,11,.2)',   color: '#F59E0B' },
  'utilities':       { Icon: FaBolt,        bg: 'rgba(245,158,11,.2)',   color: '#F59E0B' },
  'electricity':     { Icon: FaBolt,        bg: 'rgba(245,158,11,.2)',   color: '#F59E0B' },
  'entertainment':   { Icon: FaFilm,        bg: 'rgba(236,72,153,.2)',    color: '#EC4899' },
  'movies':          { Icon: FaFilm,        bg: 'rgba(236,72,153,.2)',    color: '#EC4899' },
  'gaming':          { Icon: FaGamepad,     bg: 'rgba(162,155,254,.2)',  color: '#A29BFE' },
  'health':          { Icon: FaHeartbeat,   bg: 'rgba(255,121,168,.2)',  color: '#FF79A8' },
  'medical':         { Icon: FaHeartbeat,   bg: 'rgba(255,121,168,.2)',  color: '#FF79A8' },
  'fitness':         { Icon: FaDumbbell,    bg: 'rgba(255,121,168,.2)',  color: '#FF79A8' },
  'education':       { Icon: FaGraduationCap,bg:'rgba(59,130,246,.2)',   color: '#3B82F6' },
  'investment':      { Icon: FaChartLine,   bg: 'rgba(34,197,94,.2)',   color: '#22C55E' },
  'investments':     { Icon: FaChartLine,   bg: 'rgba(34,197,94,.2)',   color: '#22C55E' },
  'salary':          { Icon: FaUniversity,  bg: 'rgba(34,197,94,.2)',   color: '#22C55E' },
  'income':          { Icon: FaMoneyBillAlt,bg: 'rgba(34,197,94,.2)',   color: '#22C55E' },
  'rent':            { Icon: FaHome,        bg: 'rgba(245,158,11,.2)',   color: '#F59E0B' },
  'housing':         { Icon: FaHome,        bg: 'rgba(245,158,11,.2)',   color: '#F59E0B' },
  'insurance':       { Icon: FaShieldAlt,   bg: 'rgba(59,130,246,.2)',   color: '#3B82F6' },
  'subscriptions':   { Icon: FaRedo,        bg: 'rgba(162,155,254,.2)',  color: '#A29BFE' },
  'personal care':   { Icon: FaSpa,         bg: 'rgba(255,121,168,.2)',  color: '#FF79A8' },
  'savings':         { Icon: FaPiggyBank,   bg: 'rgba(162,155,254,.2)',  color: '#A29BFE' },
  'debt':            { Icon: FaCreditCard,  bg: 'rgba(236,72,153,.2)',    color: '#EC4899' },
  'loan':            { Icon: FaCreditCard,  bg: 'rgba(236,72,153,.2)',    color: '#EC4899' },
  'wifi':            { Icon: FaWifi,        bg: 'rgba(59,130,246,.2)',   color: '#3B82F6' },
  'internet':        { Icon: FaWifi,        bg: 'rgba(59,130,246,.2)',   color: '#3B82F6' },
  'electronics':     { Icon: FaLaptop,      bg: 'rgba(139,92,246,.2)',   color: '#8B5CF6' },
  'gifts':           { Icon: FaGift,        bg: 'rgba(255,121,168,.2)',  color: '#FF79A8' },
  'business':        { Icon: FaBriefcase,   bg: 'rgba(139,92,246,.2)',   color: '#8B5CF6' },
  'uncategorized':   { Icon: FaTag,         bg: 'rgba(150,150,150,.2)',  color: '#9896B2' },
  'others':          { Icon: FaEllipsisH,   bg: 'rgba(236,72,153,.2)',    color: '#EC4899' },
};

const DEFAULT = { Icon: FaTag, bg: 'rgba(150,150,150,.2)', color: '#9896B2' };

/* Pickable icon library — key → { Icon, color }. Used by the category icon
   picker and to render a category's explicitly chosen `icon` key. */
export const ICON_REGISTRY = {
  utensils:   { Icon: FaUtensils,     color: '#22C55E' },
  coffee:     { Icon: FaCoffee,       color: '#F59E0B' },
  groceries:  { Icon: FaShoppingCart, color: '#00CEC9' },
  shopping:   { Icon: FaShoppingBag,  color: '#3B82F6' },
  transport:  { Icon: FaCar,          color: '#8B5CF6' },
  travel:     { Icon: FaPlane,        color: '#3B82F6' },
  bills:      { Icon: FaBolt,         color: '#F59E0B' },
  entertainment:{ Icon: FaFilm,       color: '#EC4899' },
  gaming:     { Icon: FaGamepad,      color: '#A29BFE' },
  health:     { Icon: FaHeartbeat,    color: '#FF79A8' },
  fitness:    { Icon: FaDumbbell,     color: '#FF79A8' },
  education:  { Icon: FaGraduationCap,color: '#3B82F6' },
  investment: { Icon: FaChartLine,    color: '#22C55E' },
  salary:     { Icon: FaUniversity,   color: '#22C55E' },
  income:     { Icon: FaMoneyBillAlt, color: '#22C55E' },
  home:       { Icon: FaHome,         color: '#F59E0B' },
  insurance:  { Icon: FaShieldAlt,    color: '#3B82F6' },
  subscriptions:{ Icon: FaRedo,       color: '#A29BFE' },
  personalcare:{ Icon: FaSpa,         color: '#FF79A8' },
  savings:    { Icon: FaPiggyBank,    color: '#A29BFE' },
  debt:       { Icon: FaCreditCard,   color: '#EC4899' },
  wifi:       { Icon: FaWifi,         color: '#3B82F6' },
  electronics:{ Icon: FaLaptop,       color: '#8B5CF6' },
  gifts:      { Icon: FaGift,         color: '#FF79A8' },
  business:   { Icon: FaBriefcase,    color: '#8B5CF6' },
  tag:        { Icon: FaTag,          color: '#9896B2' },
  others:     { Icon: FaEllipsisH,    color: '#EC4899' },
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
