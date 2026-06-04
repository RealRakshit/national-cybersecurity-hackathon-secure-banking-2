import axios from 'axios';

const api = axios.create({
  baseURL: '/api/auth',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

export const signup = (payload) => api.post('/signup', payload);
export const login = (payload) => api.post('/login', payload);
export const getCaptcha = () => api.get('/captcha');
export const recordActivity = () => api.post('/activity');
export const logout = () => api.post('/logout');
