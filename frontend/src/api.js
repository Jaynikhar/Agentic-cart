import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const sendChatMessage = async ({ message, sessionId, history }) => {
  const res = await api.post('/chat', { message, sessionId, history });
  return res.data;
};

export const createRazorpayOrder = async ({ internalOrderId, amount, currency, receipt }) => {
  const res = await api.post('/razorpay/order', { internalOrderId, amount, currency, receipt });
  return res.data;
};

export const verifyRazorpayPayment = async (payload) => {
  const res = await api.post('/razorpay/verify', payload);
  return res.data;
};

export default api;