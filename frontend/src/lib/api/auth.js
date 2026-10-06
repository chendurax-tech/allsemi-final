import { api } from './client.js';

// Sign-in state lives in the backend session (an HttpOnly cookie).
export const authApi = {
  login: (email, password) => api.post('/api/auth/login', { email, password }).then((r) => r.data.user),
  logout: () => api.post('/api/auth/logout').then((r) => r.data),
  me: () => api.get('/api/auth/me').then((r) => r.data.user),
  changePassword: (currentPassword, newPassword) => api.post('/api/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),
};
