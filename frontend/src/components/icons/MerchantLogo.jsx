import { useState } from 'react';

/* Known merchant → domain map */
const DOMAIN_MAP = {
  swiggy: 'swiggy.com', zomato: 'zomato.com', amazon: 'amazon.in',
  flipkart: 'flipkart.com', netflix: 'netflix.com', spotify: 'spotify.com',
  uber: 'uber.com', ola: 'olacabs.com', rapido: 'rapido.bike',
  bigbasket: 'bigbasket.com', blinkit: 'blinkit.com', dunzo: 'dunzo.in',
  zepto: 'zepto.app', phonepe: 'phonepe.com', paytm: 'paytm.com',
  gpay: 'pay.google.com', 'google pay': 'pay.google.com',
  hdfc: 'hdfcbank.com', 'hdfc bank': 'hdfcbank.com',
  sbi: 'sbi.co.in', icici: 'icicibank.com', axis: 'axisbank.com',
  kotak: 'kotak.com', airtel: 'airtel.in', jio: 'jio.com',
  makemytrip: 'makemytrip.com', irctc: 'irctc.co.in',
  bookmyshow: 'bookmyshow.com', myntra: 'myntra.com',
  ajio: 'ajio.com', nykaa: 'nykaa.com', starbucks: 'starbucks.com',
  "mcdonald's": 'mcdonalds.com', mcdonalds: 'mcdonalds.com',
  dominos: 'dominos.co.in', kfc: 'kfc.co.in', apple: 'apple.com',
  hotstar: 'hotstar.com', youtube: 'youtube.com', instagram: 'instagram.com',
  reliance: 'reliancedigital.in', tata: 'tatadigital.com',
  adidas: 'adidas.com', nike: 'nike.com', puma: 'puma.com',
  'reliance smart': 'reliancesmart.in', dmart: 'dmartindia.com',
  'salary credit': 'hdfcbank.com', salary: 'hdfcbank.com',
};

/* Consistent color from name */
const COLORS = ['#4F46E5','#059669','#DC2626','#D97706','#3B82F6','#F87171','#00CEC9','#818CF8'];
function colorFor(name = '') {
  return COLORS[name.charCodeAt(0) % COLORS.length];
}

function getDomain(name = '') {
  const key = name.toLowerCase().trim();
  if (DOMAIN_MAP[key]) return DOMAIN_MAP[key];
  for (const [k, v] of Object.entries(DOMAIN_MAP)) {
    if (key.includes(k) || k.includes(key.split(' ')[0])) return v;
  }
  return null;
}

/**
 * MerchantLogo — 3-tier fallback logo for any merchant
 * Props:
 *   name    — merchant/transaction name (string)
 *   size    — px (default 48)
 *   style   — extra styles
 */
export default function MerchantLogo({ name = '', size = 48, style }) {
  const domain = getDomain(name);
  const clearbit = domain ? `https://logo.clearbit.com/${domain}` : null;
  const favicon  = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;

  const [tier, setTier] = useState(clearbit ? 1 : favicon ? 2 : 3);

  const radius = size * 0.4;
  const fontSize = size * 0.38;
  const initial = (name[0] || '?').toUpperCase();
  const bg = colorFor(name);

  const imgStyle = {
    width: size, height: size,
    borderRadius: radius,
    objectFit: 'contain',
    background: '#fff',
    ...style,
  };

  const circleStyle = {
    width: size, height: size,
    borderRadius: radius,
    background: bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize, fontWeight: 800, color: '#fff',
    flexShrink: 0,
    ...style,
  };

  if (tier === 1 && clearbit) {
    return (
      <img
        src={clearbit}
        alt={name}
        style={imgStyle}
        onError={() => setTier(favicon ? 2 : 3)}
      />
    );
  }
  if (tier === 2 && favicon) {
    return (
      <img
        src={favicon}
        alt={name}
        style={{ ...imgStyle, background: bg }}
        onError={() => setTier(3)}
      />
    );
  }
  return <div style={circleStyle}>{initial}</div>;
}
