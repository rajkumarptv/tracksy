import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useLangStore = create(
  persist(
    (set) => ({
      lang: 'en',
      setLang: (lang) => set({ lang }),
    }),
    { name: 'tracksy_lang' }
  )
);

export default useLangStore;
