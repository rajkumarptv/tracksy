import { create } from 'zustand';

const usePremiumStore = create((set) => ({
  open: false,
  openPremium:  () => set({ open: true }),
  closePremium: () => set({ open: false }),
}));

export default usePremiumStore;
