import { create } from 'zustand';

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('tracksy_user') || 'null'),
  token: localStorage.getItem('tracksy_token') || null,
  isAuthenticated: !!localStorage.getItem('tracksy_token'),

  setAuth: (user, token) => {
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
    set({ user: null, token: null, isAuthenticated: false });
  },
}));

export default useAuthStore;
