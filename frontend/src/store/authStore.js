import { create } from 'zustand';
import queryClient from '../lib/queryClient';

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('tracksy_user') || 'null'),
  token: localStorage.getItem('tracksy_token') || null,
  isAuthenticated: !!localStorage.getItem('tracksy_token'),

  setAuth: (user, token) => {
    queryClient.clear();   // never show a previous user's cached data
    localStorage.setItem('tracksy_token', token);
    localStorage.setItem('tracksy_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  updateUser: (user) => {
    localStorage.setItem('tracksy_user', JSON.stringify(user));
    set({ user });
  },

  logout: () => {
    localStorage.removeItem('tracksy_token');
    localStorage.removeItem('tracksy_user');
    localStorage.removeItem('tracksy-cache');   // drop persisted query cache
    queryClient.clear();                        // and the in-memory one
    set({ user: null, token: null, isAuthenticated: false });
  },
}));

export default useAuthStore;
