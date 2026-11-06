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
  {
    name: 'tracksy-theme',
    // Apply the saved theme as soon as it's restored, so pre-login pages (sign in, register) match too.
    onRehydrateStorage: () => (state) => {
      if (state) document.documentElement.setAttribute('data-theme', state.theme);
    },
  }
));

export default useThemeStore;
