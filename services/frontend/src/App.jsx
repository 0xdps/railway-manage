import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import api from './api';
import { ToastProvider } from './components/Toast';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import ServiceDetail from './pages/ServiceDetail';
import ManagedServices from './pages/ManagedServices';
import Backups from './pages/Backups';
import Jobs from './pages/Jobs';
import Audit from './pages/Audit';
import Docs from './pages/Docs';
import About from './pages/About';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      await api.getMe();
      setIsAuthenticated(true);
    } catch {
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-base)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
          <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 13 }}>Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <Router>
        {isAuthenticated ? (
          <Layout onLogout={() => setIsAuthenticated(false)}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/services" element={<Services />} />
              <Route path="/services/:serviceId" element={<ServiceDetail />} />
              <Route path="/managed" element={<ManagedServices />} />
              <Route path="/backups" element={<Backups />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/about" element={<About />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
        ) : (
          <Routes>
            <Route path="/login" element={<Login onSuccess={() => setIsAuthenticated(true)} />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        )}
      </Router>
    </ToastProvider>
  );
}

export default App;
