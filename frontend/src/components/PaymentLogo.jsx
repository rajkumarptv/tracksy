/**
 * PaymentLogo — brand-accurate logo chips for payment methods & wallet types.
 * Returns a rounded-square SVG with the brand's colours and identity.
 */

/* ── Brand config ──────────────────────────────────────────────────────── */
const BRANDS = {
  /* UPI apps */
  gpay:         { type:'gpay'     },
  phonepe:      { type:'phonepe'  },
  paytm:        { type:'paytm'    },
  amazon_pay:   { type:'amazon'   },
  mobikwik:     { type:'badge',   bg:'#2563eb', text:'Mb', fw:800 },
  jio_money:    { type:'badge',   bg:'#dc2626', text:'Jio',fw:800 },
  airtel_money: { type:'airtel'   },
  upi:          { type:'upi'      },
  irctc:        { type:'irctc'    },
  irctc_refund: { type:'irctc'    },

  /* Bank / cash */
  bank:         { type:'badge',   bg:'#1d4ed8', text:'🏦', fw:700 },
  bank_transfer:{ type:'badge',   bg:'#1d4ed8', text:'🏦', fw:700 },
  netbanking:   { type:'badge',   bg:'#1d4ed8', text:'NB', fw:800 },
  cash:         { type:'badge',   bg:'#16a34a', text:'₹',  fw:700 },

  /* Cards */
  credit:       { type:'badge',   bg:'#6d28d9', text:'CC', fw:800 },
  visa:         { type:'visa'     },
  mastercard:   { type:'mastercard' },
  paypal:       { type:'badge',   bg:'#003087', text:'PP', fw:800 },

  /* Other */
  crypto:       { type:'badge',   bg:'#d97706', text:'₿',  fw:700 },
  asset:        { type:'badge',   bg:'#0891b2', text:'📈', fw:700 },
  loan:         { type:'badge',   bg:'#d97706', text:'📋', fw:700 },
  lending:      { type:'badge',   bg:'#7c3aed', text:'🤝', fw:700 },
  other:        { type:'badge',   bg:'#6b7280', text:'···',fw:700 },
};

/* ── Individual logo renderers ─────────────────────────────────────────── */

/** Google Pay — white card with multicolor G */
function GPay({ s, r }) {
  return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx={r} fill="white"/>
      <rect width="40" height="40" rx={r} fill="none" stroke="#dadce0" strokeWidth="1.5"/>
      {/* Outer arc — blue */}
      <path d="M20 11a9 9 0 1 0 7.794 4.5" stroke="#4285F4" strokeWidth="3.5" strokeLinecap="round" fill="none"
        strokeDasharray="28 100"/>
      {/* Red arc */}
      <path d="M27.794 15.5A9 9 0 0 0 22 11.18" stroke="#EA4335" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      {/* Yellow arc — bottom */}
      <path d="M11 20a9 9 0 0 0 5.5 8.28" stroke="#FBBC04" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      {/* Green arc — lower left */}
      <path d="M16.5 28.28A9 9 0 0 0 20 29" stroke="#34A853" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      {/* Horizontal bar */}
      <line x1="20" y1="20" x2="29" y2="20" stroke="#4285F4" strokeWidth="3.5" strokeLinecap="round"/>
    </svg>
  );
}

/** PhonePe — purple with white "Pe" */
function PhonePe({ s, r }) {
  return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx={r} fill="#5f259f"/>
      {/* Stylised "Pe" */}
      <text x="20" y="26.5" textAnchor="middle" fill="white"
        fontSize="17" fontWeight="800"
        fontFamily="'Inter','Helvetica Neue',Arial,sans-serif">
        Pe
      </text>
      {/* Accent dot */}
      <circle cx="30" cy="13" r="3.5" fill="#CBACF9"/>
    </svg>
  );
}

/** Paytm — sky-blue with white wordmark */
function Paytm({ s, r }) {
  return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx={r} fill="#00B9F1"/>
      <text x="20" y="23" textAnchor="middle" fill="white"
        fontSize="12" fontWeight="800"
        fontFamily="'Inter','Helvetica Neue',Arial,sans-serif"
        letterSpacing="-0.3">
        paytm
      </text>
      {/* Underline stripe */}
      <rect x="9" y="26" width="22" height="2.5" rx="1.25" fill="rgba(255,255,255,.55)"/>
    </svg>
  );
}

/** Amazon Pay — orange with "a" + smile */
function Amazon({ s, r }) {
  return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx={r} fill="#FF9900"/>
      {/* lowercase "a" */}
      <text x="19" y="24" textAnchor="middle" fill="white"
        fontSize="20" fontWeight="900"
        fontFamily="'Georgia','Times New Roman',serif">
        a
      </text>
      {/* Amazon smile arc */}
      <path d="M11 29 Q20 35 29 29" stroke="white" strokeWidth="2.2"
        strokeLinecap="round" fill="none"/>
    </svg>
  );
}

/** IRCTC — national rail blue */
function IRCTC({ s, r }) {
  return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx={r} fill="#1e3a8a"/>
      {/* Train body */}
      <rect x="8" y="17" width="24" height="11" rx="3" fill="white" opacity=".92"/>
      {/* Windows */}
      <rect x="11" y="20" width="5" height="4" rx="1" fill="#1e3a8a"/>
      <rect x="18" y="20" width="5" height="4" rx="1" fill="#1e3a8a"/>
      <rect x="25" y="20" width="4" height="4" rx="1" fill="#1e3a8a"/>
      {/* Wheels */}
      <circle cx="13" cy="30" r="3" fill="white" opacity=".92"/>
      <circle cx="27" cy="30" r="3" fill="white" opacity=".92"/>
      {/* Rail line */}
      <line x1="6" y1="33" x2="34" y2="33" stroke="white" strokeWidth="2" opacity=".5" strokeLinecap="round"/>
      {/* "IC" text */}
      <text x="20" y="14" textAnchor="middle" fill="white"
        fontSize="7" fontWeight="800"
        fontFamily="'Inter',Arial,sans-serif" letterSpacing="1">
        IRCTC
      </text>
    </svg>
  );
}

/** Airtel — red with signal waves */
function Airtel({ s, r }) {
  return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx={r} fill="#ED1C24"/>
      {/* Signal arcs */}
      <path d="M14 24 Q20 14 26 24" stroke="white" strokeWidth="2.8" strokeLinecap="round" fill="none"/>
      <path d="M10 28 Q20 10 30 28" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".6"/>
      {/* Center dot */}
      <circle cx="20" cy="26" r="2.8" fill="white"/>
    </svg>
  );
}

/** UPI generic — NPCI colors */
function UPI({ s, r }) {
  return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
      <defs>
        <linearGradient id="upiGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5c3bfe"/>
          <stop offset="1" stopColor="#0A8D79"/>
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx={r} fill="url(#upiGrad)"/>
      <text x="20" y="25" textAnchor="middle" fill="white"
        fontSize="13" fontWeight="900"
        fontFamily="'Inter',Arial,sans-serif" letterSpacing="1">
        UPI
      </text>
    </svg>
  );
}

/** Visa — classic dark blue */
function Visa({ s, r }) {
  return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx={r} fill="#1a1f71"/>
      <text x="20" y="25" textAnchor="middle" fill="white"
        fontSize="14" fontWeight="900"
        fontFamily="'Arial Black','Arial',sans-serif" letterSpacing="1">
        VISA
      </text>
    </svg>
  );
}

/** Mastercard — iconic overlapping circles */
function Mastercard({ s, r }) {
  return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx={r} fill="#252525"/>
      <circle cx="15" cy="20" r="9" fill="#EB001B"/>
      <circle cx="25" cy="20" r="9" fill="#F79E1B"/>
      {/* Overlap blended */}
      <path d="M20 13.15A9 9 0 0 1 20 26.85A9 9 0 0 1 20 13.15Z" fill="#FF5F00"/>
    </svg>
  );
}

/** Generic badge — coloured square with text */
function Badge({ s, r, bg, text, fw }) {
  const isEmoji = /\p{Emoji}/u.test(text) && text.length <= 2;
  const fs = isEmoji ? s * 0.44
           : text.length === 1 ? s * 0.50
           : text.length === 2 ? s * 0.40
           : text.length === 3 ? s * 0.32
           : s * 0.27;
  return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx={r} fill={bg}/>
      <text x="20" y="26" textAnchor="middle" fill="white"
        fontSize={fs * (40 / s)} fontWeight={fw}
        fontFamily="'Inter','Helvetica Neue',Arial,sans-serif"
        dominantBaseline="middle" dy="0">
        {text}
      </text>
    </svg>
  );
}

/* ── Main export ───────────────────────────────────────────────────────── */
export default function PaymentLogo({ method, size = 36, style = {} }) {
  const s = 40;                        // internal viewBox size, always 40
  const r = 9;                         // corner radius
  const cfg = BRANDS[method];

  let Logo;
  if (!cfg) {
    Logo = <Badge s={s} r={r} bg="#6b7280" text={String(method||'?').slice(0,2).toUpperCase()} fw={800}/>;
  } else {
    switch (cfg.type) {
      case 'gpay':       Logo = <GPay      s={s} r={r} />; break;
      case 'phonepe':    Logo = <PhonePe   s={s} r={r} />; break;
      case 'paytm':      Logo = <Paytm     s={s} r={r} />; break;
      case 'amazon':     Logo = <Amazon    s={s} r={r} />; break;
      case 'irctc':      Logo = <IRCTC     s={s} r={r} />; break;
      case 'airtel':     Logo = <Airtel    s={s} r={r} />; break;
      case 'upi':        Logo = <UPI       s={s} r={r} />; break;
      case 'visa':       Logo = <Visa      s={s} r={r} />; break;
      case 'mastercard': Logo = <Mastercard s={s} r={r} />; break;
      default:           Logo = <Badge s={s} r={r} bg={cfg.bg} text={cfg.text} fw={cfg.fw}/>; break;
    }
  }

  return (
    <div style={{
      width: size, height: size,
      borderRadius: Math.round(size * 0.225),
      overflow: 'hidden', flexShrink: 0, display: 'flex',
      ...style,
    }}>
      {/* Scale the 40×40 SVG to whatever size was requested */}
      <div style={{ width: size, height: size, transform:`scale(${size/40})`, transformOrigin:'top left', flexShrink:0 }}>
        {Logo}
      </div>
    </div>
  );
}
