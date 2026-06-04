import axios from 'axios';

const api = axios.create({
  baseURL: '/api/banking',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

export const getBankingDashboard = () => api.get('/dashboard');
export const getSecurityCheck = () => api.get('/security-check');
export const flagSecuritySession = () => api.post('/security-check/flag-session');
export const createShapeChallenge = () => api.post('/shape-challenge');
export const sendTransaction = (payload) => api.post('/transactions', payload);
