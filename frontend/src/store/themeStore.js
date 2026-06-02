import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useThemeStore = create(persist(
  (set, get) => ({
    theme: 'light',
    toggleTheme: () => {
      const next = get().theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      set({ theme: next });
    },
    initTheme: () => {
      document.documentElement.setAttribute('data-theme', get().theme);
    },
  }),
  { name: 'tracksy-theme' }
));

export default useThemeStore;
