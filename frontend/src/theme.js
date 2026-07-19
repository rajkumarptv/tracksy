/* ═══════════════════════════════════════════════════════════════════════
   Tracksy shared theme — SINGLE SOURCE OF TRUTH for all pages.
   Values come from the Dashboard page design (the app-wide standard).
   Usage:  import { THEME, ACCENT } from '../theme';
           const c = isDark ? THEME.dark : THEME.light;
═══════════════════════════════════════════════════════════════════════ */

export const ACCENT = '#8B5CF6';

export const THEME = {
  light: {
    /* semantic */
    green:'#22C55E', red:'#EC4899', blue:'#3B82F6', orange:'#F59E0B', purple:'#8B5CF6',
    /* text */
    text:'#101828', text2:'#667085', text3:'#9896B2',
    /* surfaces */
    bg:'#FEFEFE',
    cardBg:'#FFFFFF',
    surface:'#F7F8FF',
    hover:'#EAECF0',
    border:'#EAECF0',
    divider:'#EAECF0',
    cardShadow:'0 10px 40px rgba(16,24,40,0.06)',
    glowShadow:'0 10px 40px rgba(16,24,40,0.06)',
    /* special cards */
    balanceBorder:'2px solid #BBF7D0',
    balanceBg:'#FFFFFF',
    flowBorder:'1px solid #E9D5FF',
    flowBg:'#FFFFFF',
    salaryBg:'#FFFFFF', salaryBorder:'1px solid transparent',
    spendBg:'#FFFFFF', spendBorder:'1px solid transparent',
    tileBg:'#F7F8FF',
    viewDetailsBg:'#F0FDF4', viewDetailsBorder:'1.5px solid #BBF7D0',
    insightBg:'#F5F3FF',
    /* charts */
    grid:'#EAECF0', axis:'#667085',
    areaTop:'rgba(34,197,94,0.22)',
    stroke:'#22C55E', strokeW:3,
    barTrack:'#EEF0F6', track:'#EEF0F6',
    pie:['#7CFF6B','#3B82F6','#8B5CF6','#F59E0B','#EC4899','#22C55E','#A78BFA','#00CEC9'],
  },
  dark: {
    /* semantic */
    green:'#2BFF88', red:'#FF4D8D', blue:'#4F8DFF', orange:'#FF9D00', purple:'#8B5CF6',
    /* text */
    text:'#FFFFFF', text2:'#B8C2D1', text3:'#A7B1C2',
    /* surfaces */
    bg:'#020617',
    cardBg:'#071730',
    surface:'rgba(255,255,255,0.05)',
    hover:'rgba(255,255,255,0.08)',
    border:'rgba(255,255,255,0.08)',
    divider:'rgba(255,255,255,0.08)',
    cardShadow:'0 20px 40px rgba(0,0,0,0.45)',
    glowShadow:'0 20px 40px rgba(0,0,0,0.45), 0 0 40px rgba(139,92,246,0.1)',
    /* special cards */
    balanceBorder:'1px solid rgba(43,255,136,0.4)',
    balanceBg:'linear-gradient(135deg, #08222D 0%, #061B38 100%)',
    flowBorder:'1px solid rgba(139,92,246,0.25)',
    flowBg:'linear-gradient(135deg, #0B1136 0%, #09152B 100%)',
    salaryBg:'linear-gradient(135deg, #08263A 0%, #081A42 100%)', salaryBorder:'1px solid rgba(79,141,255,0.2)',
    spendBg:'#071730', spendBorder:'1px solid rgba(255,255,255,0.08)',
    tileBg:'rgba(255,255,255,0.05)',
    viewDetailsBg:'rgba(43,255,136,0.1)', viewDetailsBorder:'1.5px solid rgba(43,255,136,0.35)',
    insightBg:'rgba(124,58,237,.14)',
    /* charts */
    grid:'rgba(255,255,255,0.05)', axis:'rgba(255,255,255,0.4)',
    areaTop:'rgba(43,255,136,0.4)',
    stroke:'#2BFF88', strokeW:2.5,
    barTrack:'rgba(255,255,255,0.08)', track:'rgba(255,255,255,0.08)',
    pie:['#7CFF6B','#4F8DFF','#8B5CF6','#FF9D00','#FF4D8D','#2BFF88','#A78BFA','#00CEC9'],
  },
};
