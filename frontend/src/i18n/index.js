import useLangStore from '../store/langStore';
import useCurrencyStore, { CURRENCIES } from '../store/currencyStore';
import usePrivacyStore from '../store/privacyStore';
import { translations } from './translations';

/** t('key') → translated string */
export function useT() {
  const { lang } = useLangStore();
  const dict = translations[lang] || translations.en;
  return (key) => dict[key] ?? translations.en[key] ?? key;
}

/** fmtAmt(1234.56) → "₹1,234.56" based on selected currency */
export function useFmt() {
  const { currency } = useCurrencyStore();
  const hidden = usePrivacyStore(s => s.hidden);
  const cur = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];

  return (amount, opts = {}) => {
    if (hidden) return `${cur.symbol}••••`;
    const n = Math.abs(parseFloat(amount) || 0);
    try {
      return new Intl.NumberFormat(cur.locale, {
        style: 'currency',
        currency: cur.code,
        minimumFractionDigits: opts.noDecimals ? 0 : 2,
        maximumFractionDigits: opts.noDecimals ? 0 : 2,
      }).format(n);
    } catch {
      return `${cur.symbol}${n.toLocaleString()}`;
    }
  };
}

/** Just the currency symbol */
export function useCurrencySymbol() {
  const { currency } = useCurrencyStore();
  const cur = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
  return cur.symbol;
}
