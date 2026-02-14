const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const defaultApiBase = isLocalHost
  ? 'http://localhost:3001'
  : 'https://my-storyhub-8inf.onrender.com';

const envApiBase = process.env.REACT_APP_API_BASE || '';
const envLooksLocal =
  envApiBase.includes('localhost') || envApiBase.includes('127.0.0.1');

export const API_BASE =
  !isLocalHost && envLooksLocal ? defaultApiBase : envApiBase || defaultApiBase;
const envWsBase = process.env.REACT_APP_WS_BASE || '';
const envWsLooksLocal = envWsBase.includes('localhost') || envWsBase.includes('127.0.0.1');

export const WS_BASE =
  !isLocalHost && envWsLooksLocal ? API_BASE : envWsBase || API_BASE;
