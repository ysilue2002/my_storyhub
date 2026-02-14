const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const defaultApiBase = isLocalHost
  ? 'http://localhost:3001'
  : 'https://my-storyhub-8inf.onrender.com';

export const API_BASE = process.env.REACT_APP_API_BASE || defaultApiBase;
export const WS_BASE = process.env.REACT_APP_WS_BASE || API_BASE;
