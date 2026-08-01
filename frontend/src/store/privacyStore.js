import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* Lightweight non-cryptographic hash — enough to avoid storing the raw
   password in localStorage for a "hide from shoulder-surfers" feature. */
export const hashPw = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return String(h);
};

const usePrivacyStore = create(persist(
  (set, get) => ({
    hidden: false,
    passwordHash: null,

    setHidden: (v) => set({ hidden: !!v }),
    hasPassword: () => !!get().passwordHash,
    /** set (or clear when pw is falsy) the reveal password */
    setPassword: (pw) => set({ passwordHash: pw ? hashPw(pw) : null }),
    verify: (pw) => get().passwordHash === hashPw(pw || ''),
  }),
  { name: 'tracksy-privacy' }
));

export default usePrivacyStore;
