import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './AppContext';
import { Home } from './pages/Home';
import { Practice } from './pages/Practice';
import { Parent } from './pages/Parent';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <AppProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/practice/:mode" element={<Practice />} />
          <Route path="/parent/*" element={<Parent />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </AppProvider>
    </HashRouter>
  </React.StrictMode>,
);
