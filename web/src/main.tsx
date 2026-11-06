import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/lib/theme';
import { App } from './App';
import './index.css';

// set the theme before the first paint so dark mode doesn't flash
try { const t = localStorage.getItem('isoteh-theme'); if (t === 'dark' || ((!t || t === 'system') && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark'); } catch { /* private mode */ }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ThemeProvider><BrowserRouter><App /></BrowserRouter></ThemeProvider></React.StrictMode>,
);
