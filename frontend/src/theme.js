/* ═══════════════════════════════════════════════════════════════════════
   Tracksy shared theme for chart/inline-styled pages — mirrors the CSS
   variables in index.css (trust-blue brand, green = income, red = expense,
   amber = warning, slate neutrals). Flat surfaces, no gradients or glows.
   Rules: see frontend/DESIGN.md. Keep in sync with index.css.
   Usage:  import { THEME, ACCENT } from '../theme';
           const c = isDark ? THEME.dark : THEME.light;
═══════════════════════════════════════════════════════════════════════ */

export const ACCENT = '#1D4ED8';

// Categorical palette: deliberately excludes the semantic green (income) and red (expense)
const PIE_LIGHT = ['#1D4ED8', '#0EA5E9', '#14B8A6', '#F59E0B', '#64748B', '#8B5CF6', '#EC4899', '#84CC16'];
const PIE_DARK  = ['#60A5FA', '#38BDF8', '#2DD4BF', '#FBBF24', '#94A3B8', '#A78BFA', '#F472B6', '#A3E635'];

export const THEME = {
  light: {
    green:'#047857', red:'#DC2626', redText:'#B91C1C', blue:'#2563EB', orange:'#D97706', orangeText:'#B45309', purple:'#1D4ED8',
    text:'#0F172A', text2:'#334155', text3:'#5B6B7F',
    bg:'#F8FAFC',
    cardBg:'#FFFFFF',
    surface:'#F1F5F9',
    hover:'#E8EDF3',
    border:'#E2E8F0',
    divider:'#E2E8F0',
    cardShadow:'0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)',
    glowShadow:'0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)',
    balanceBorder:'1px solid #E2E8F0',
    balanceBg:'#FFFFFF',
    flowBorder:'1px solid #E2E8F0',
    flowBg:'#FFFFFF',
    salaryBg:'#FFFFFF', salaryBorder:'1px solid #E2E8F0',
    spendBg:'#FFFFFF', spendBorder:'1px solid #E2E8F0',
    tileBg:'#F1F5F9',
    viewDetailsBg:'#EFF6FF', viewDetailsBorder:'1px solid #BFDBFE',
    insightBg:'#EFF6FF',
    grid:'#E2E8F0', axis:'#5B6B7F',
    areaTop:'rgba(29,78,216,0.18)',
    stroke:'#1D4ED8', strokeW:2.5,
    barTrack:'#E8EDF3', track:'#E8EDF3',
    pie: PIE_LIGHT,
  },
  dark: {
    green:'#34D399', red:'#F87171', redText:'#FCA5A5', blue:'#60A5FA', orange:'#FBBF24', orangeText:'#FCD34D', purple:'#60A5FA',
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
    viewDetailsBg:'rgba(96,165,250,0.14)', viewDetailsBorder:'1px solid rgba(96,165,250,0.35)',
    insightBg:'rgba(96,165,250,0.14)',
    grid:'rgba(148,163,184,0.12)', axis:'rgba(203,213,225,0.55)',
    areaTop:'rgba(96,165,250,0.30)',
    stroke:'#60A5FA', strokeW:2.5,
    barTrack:'rgba(148,163,184,0.16)', track:'rgba(148,163,184,0.16)',
    pie: PIE_DARK,
  },
};
