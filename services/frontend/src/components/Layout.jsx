import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Database,
  HardDrive,
  Clock,
  ScrollText,
  LogOut,
} from 'lucide-react';
import api from '../api';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/services', label: 'Infrastructure', icon: Server },
  { path: '/managed', label: 'Managed Services', icon: HardDrive },
  { path: '/backups', label: 'Backups', icon: Database },
  { path: '/jobs', label: 'Jobs', icon: Clock },
  { path: '/audit', label: 'Audit Log', icon: ScrollText },
];

export default function Layout({ children, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // ignore
    } finally {
      onLogout();
      navigate('/login');
    }
  }

  const activeItem = navItems.find((item) => item.path === location.pathname);

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">RM</div>
          <span className="sidebar-name">Railway Manage</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`sidebar-nav-item${location.pathname === path ? ' active' : ''}`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="sidebar-nav-item" style={{ color: 'var(--danger)' }}>
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        <header className="page-header">
          <span className="page-title">
            {activeItem?.label ?? 'Dashboard'}
          </span>
          <div
            style={{
              width: 26,
              height: 26,
              background: 'var(--accent)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
            }}
          >
            A
          </div>
        </header>

        <main className="page-body">{children}</main>
      </div>
    </div>
  );
}
