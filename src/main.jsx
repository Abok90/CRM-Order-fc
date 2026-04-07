import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Inject Vercel Speed Insights natively using the package if we wanted to,
// but for now we'll just render the app. Vercel automatically injects it in Prod if enabled in dashboard.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
