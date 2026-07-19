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
  salary:        { Icon: FaUniversity,   grad: 'linear-gradient(135deg,#0C2B1F,#145230)',   color: '#22C55E' },
  /* Cards */
  visa:          { Icon: FaCreditCard,   grad: 'linear-gradient(135deg,#1A1035,#2D1B69)',   color: '#A29BFE' },
  mastercard:    { Icon: FaCreditCard,   grad: 'linear-gradient(135deg,#1A1035,#2D1B69)',   color: '#A29BFE' },
  credit:        { Icon: FaCreditCard,   grad: 'linear-gradient(135deg,#1A1035,#2D1B69)',   color: '#A29BFE' },
  /* Investments */
  mutual_fund:   { Icon: FaChartLine,    grad: 'linear-gradient(135deg,#0C3322,#145230)',   color: '#22C55E' },
  stocks:        { Icon: FaBriefcase,    grad: 'linear-gradient(135deg,#1A1035,#2D1B69)',   color: '#A29BFE' },
  etf:           { Icon: FaBriefcase,    grad: 'linear-gradient(135deg,#1A1035,#2D1B69)',   color: '#A29BFE' },
  fd:            { Icon: FaLock,         grad: 'linear-gradient(135deg,#F59E0B,#FF8C00)',   color: '#fff' },
  ppf:           { Icon: FaShieldAlt,    grad: 'linear-gradient(135deg,#3D9EFF,#3B82F6)',   color: '#fff' },
  nps:           { Icon: FaShieldAlt,    grad: 'linear-gradient(135deg,#3D9EFF,#3B82F6)',   color: '#fff' },
  gold:          { Icon: FaStar,         grad: 'linear-gradient(135deg,#FFD700,#F59E0B)',   color: '#fff' },
  real_estate:   { Icon: FaHome,         grad: 'linear-gradient(135deg,#F59E0B,#FF8C00)',   color: '#fff' },
  /* Loans */
  home_loan:     { Icon: FaHome,         grad: 'linear-gradient(135deg,#EC4899,#C0392B)',   color: '#fff' },
  personal_loan: { Icon: FaHome,         grad: 'linear-gradient(135deg,#EC4899,#FF79A8)',   color: '#fff' },
  vehicle_loan:  { Icon: FaCar,          grad: 'linear-gradient(135deg,#F59E0B,#E67E22)',   color: '#fff' },
  education_loan:{ Icon: FaGraduationCap,grad: 'linear-gradient(135deg,#3B82F6,#3D9EFF)',   color: '#fff' },
  gold_loan:     { Icon: FaStar,         grad: 'linear-gradient(135deg,#FFD700,#F59E0B)',   color: '#fff' },
  loan:          { Icon: FaHome,         grad: 'linear-gradient(135deg,#EC4899,#FF79A8)',   color: '#fff' },
  bnpl:          { Icon: FaShoppingBag,  grad: 'linear-gradient(135deg,#FF79A8,#EC4899)',   color: '#fff' },
  family_borrow: { Icon: FaMoneyBillAlt, grad: 'linear-gradient(135deg,#F59E0B,#FF8C00)',   color: '#fff' },
  emi:           { Icon: FaCreditCard,   grad: 'linear-gradient(135deg,#8B5CF6,#A29BFE)',   color: '#fff' },
  /* Wallet */
  wallet:        { Icon: FaWallet,       grad: 'linear-gradient(135deg,#22C55E,#00CEC9)',   color: '#fff' },
  cash:          { Icon: FaMoneyBillAlt, grad: 'linear-gradient(135deg,#22C55E,#00CEC9)',   color: '#fff' },
};

const DEFAULT = { Icon: FaWallet, grad: 'linear-gradient(135deg,#8B5CF6,#A29BFE)', color: '#fff' };

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
