/* ═══════════════════════════════════════════════════════════════════════
   Tracksy shared theme for chart/inline-styled pages — mirrors the CSS
   variables in index.css (single palette: indigo brand, green income,
   red expense, slate neutrals). Flat surfaces, no gradients or glows.
   Usage:  import { THEME, ACCENT } from '../theme';
           const c = isDark ? THEME.dark : THEME.light;
═══════════════════════════════════════════════════════════════════════ */

export const ACCENT = '#4F46E5';

const PIE_LIGHT = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6', '#64748B'];
const PIE_DARK  = ['#818CF8', '#38BDF8', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#2DD4BF', '#94A3B8'];

export const THEME = {
  light: {
    green:'#059669', red:'#DC2626', blue:'#2563EB', orange:'#D97706', purple:'#4F46E5',
    text:'#0F172A', text2:'#475569', text3:'#64748B',
    bg:'#F6F7F9',
    cardBg:'#FFFFFF',
    surface:'#F4F6F8',
    hover:'#EDF0F3',
    border:'#E3E7EC',
    divider:'#E3E7EC',
    cardShadow:'0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)',
    glowShadow:'0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)',
    balanceBorder:'1px solid #E3E7EC',
    balanceBg:'#FFFFFF',
    flowBorder:'1px solid #E3E7EC',
    flowBg:'#FFFFFF',
    salaryBg:'#FFFFFF', salaryBorder:'1px solid #E3E7EC',
    spendBg:'#FFFFFF', spendBorder:'1px solid #E3E7EC',
    tileBg:'#F4F6F8',
    viewDetailsBg:'#EEF0FF', viewDetailsBorder:'1px solid #C7CCFA',
    insightBg:'#EEF0FF',
    grid:'#E3E7EC', axis:'#64748B',
    areaTop:'rgba(79,70,229,0.18)',
    stroke:'#4F46E5', strokeW:2.5,
    barTrack:'#EDF0F3', track:'#EDF0F3',
    pie: PIE_LIGHT,
  },
  dark: {
    green:'#34D399', red:'#F87171', blue:'#60A5FA', orange:'#FBBF24', purple:'#818CF8',
    text:'#F1F5F9', text2:'#CBD5E1', text3:'#94A3B8',
    bg:'#0B1220',
    cardBg:'#111A2B',
    surface:'#162036',
    hover:'#1B2740',
    border:'rgba(148,163,184,0.18)',
    divider:'rgba(148,163,184,0.18)',
    cardShadow:'0 1px 3px rgba(0,0,0,0.45)',
    glowShadow:'0 1px 3px rgba(0,0,0,0.45)',
    balanceBorder:'1px solid rgba(148,163,184,0.18)',
    balanceBg:'#111A2B',
    flowBorder:'1px solid rgba(148,163,184,0.18)',
    flowBg:'#111A2B',
    salaryBg:'#111A2B', salaryBorder:'1px solid rgba(148,163,184,0.18)',
    spendBg:'#111A2B', spendBorder:'1px solid rgba(148,163,184,0.18)',
    tileBg:'#162036',
    viewDetailsBg:'rgba(129,140,248,0.14)', viewDetailsBorder:'1px solid rgba(129,140,248,0.35)',
    insightBg:'rgba(129,140,248,0.14)',
    grid:'rgba(148,163,184,0.12)', axis:'rgba(203,213,225,0.55)',
    areaTop:'rgba(129,140,248,0.30)',
    stroke:'#818CF8', strokeW:2.5,
    barTrack:'rgba(148,163,184,0.16)', track:'rgba(148,163,184,0.16)',
    pie: PIE_DARK,
  },
};
