import {
  FaUniversity, FaCreditCard, FaChartLine, FaBriefcase,
  FaHome, FaCar, FaGraduationCap, FaShoppingBag,
  FaLock, FaShieldAlt, FaStar, FaWallet, FaMoneyBillAlt,
} from 'react-icons/fa';

const TYPE_MAP = {
  /* Bank */
  bank:          { Icon: FaUniversity,   grad: 'linear-gradient(135deg,#3D9EFF,#3B82F6)',   color: '#fff' },
  savings:       { Icon: FaUniversity,   grad: 'linear-gradient(135deg,#3D9EFF,#3B82F6)',   color: '#fff' },
  current:       { Icon: FaUniversity,   grad: 'linear-gradient(135deg,#3D9EFF,#3B82F6)',   color: '#fff' },
  salary:        { Icon: FaUniversity,   grad: 'linear-gradient(135deg,#0C2B1F,#145230)',   color: '#059669' },
  /* Cards */
  visa:          { Icon: FaCreditCard,   grad: 'linear-gradient(135deg,#1A1035,#2D1B69)',   color: '#818CF8' },
  mastercard:    { Icon: FaCreditCard,   grad: 'linear-gradient(135deg,#1A1035,#2D1B69)',   color: '#818CF8' },
  credit:        { Icon: FaCreditCard,   grad: 'linear-gradient(135deg,#1A1035,#2D1B69)',   color: '#818CF8' },
  /* Investments */
  mutual_fund:   { Icon: FaChartLine,    grad: 'linear-gradient(135deg,#0C3322,#145230)',   color: '#059669' },
  stocks:        { Icon: FaBriefcase,    grad: 'linear-gradient(135deg,#1A1035,#2D1B69)',   color: '#818CF8' },
  etf:           { Icon: FaBriefcase,    grad: 'linear-gradient(135deg,#1A1035,#2D1B69)',   color: '#818CF8' },
  fd:            { Icon: FaLock,         grad: '#D97706',   color: '#fff' },
  ppf:           { Icon: FaShieldAlt,    grad: 'linear-gradient(135deg,#3D9EFF,#3B82F6)',   color: '#fff' },
  nps:           { Icon: FaShieldAlt,    grad: 'linear-gradient(135deg,#3D9EFF,#3B82F6)',   color: '#fff' },
  gold:          { Icon: FaStar,         grad: 'linear-gradient(135deg,#FFD700,#D97706)',   color: '#fff' },
  real_estate:   { Icon: FaHome,         grad: '#D97706',   color: '#fff' },
  /* Loans */
  home_loan:     { Icon: FaHome,         grad: '#DC2626',   color: '#fff' },
  personal_loan: { Icon: FaHome,         grad: '#DC2626',   color: '#fff' },
  vehicle_loan:  { Icon: FaCar,          grad: '#D97706',   color: '#fff' },
  education_loan:{ Icon: FaGraduationCap,grad: 'linear-gradient(135deg,#3B82F6,#3D9EFF)',   color: '#fff' },
  gold_loan:     { Icon: FaStar,         grad: 'linear-gradient(135deg,#FFD700,#D97706)',   color: '#fff' },
  loan:          { Icon: FaHome,         grad: '#DC2626',   color: '#fff' },
  bnpl:          { Icon: FaShoppingBag,  grad: '#F87171',   color: '#fff' },
  family_borrow: { Icon: FaMoneyBillAlt, grad: '#D97706',   color: '#fff' },
  emi:           { Icon: FaCreditCard,   grad: '#4F46E5',   color: '#fff' },
  /* Wallet */
  wallet:        { Icon: FaWallet,       grad: '#059669',   color: '#fff' },
  cash:          { Icon: FaMoneyBillAlt, grad: '#059669',   color: '#fff' },
};

const DEFAULT = { Icon: FaWallet, grad: '#4F46E5', color: '#fff' };

/**
 * AccountIcon — correct icon for any wallet/account type
 * Props:
 *   type   — wallet type string from DB (e.g. "savings", "visa", "mutual_fund")
 *   size   — px (default 48)
 *   style  — extra styles
 */
export default function AccountIcon({ type = '', size = 48, style }) {
  const key = type.toLowerCase().replace(/ /g, '_');
  const { Icon, grad, color } = TYPE_MAP[key] || DEFAULT;
  const iconSize = Math.round(size * 0.42);

  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.35,
      background: grad,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, ...style,
    }}>
      <Icon size={iconSize} color={color}/>
    </div>
  );
}
