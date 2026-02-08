import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // ✅ Importe ton fichier CSS avec Tailwind
import App from './App';
import Admin from './Admin';
import Login from './Login';
import Profile from './Profile';
const root = ReactDOM.createRoot(document.getElementById('root'));
const isAdminRoute = window.location.pathname.startsWith('/admin') || window.__ADMIN_PAGE__ === true;
const isLoginRoute = window.location.pathname.startsWith('/login');
const isProfileRoute = window.location.pathname.startsWith('/profile');
root.render(
  <React.StrictMode>
    {isAdminRoute ? <Admin /> : isLoginRoute ? <Login /> : isProfileRoute ? <Profile /> : <App />}
  </React.StrictMode>
);
