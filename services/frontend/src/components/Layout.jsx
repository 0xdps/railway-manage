import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Database,
  Settings2,
  Clock,
  ScrollText,
  LogOut,
  BookOpen,
  Info,
} from 'lucide-react';
import api from '../api';
import BrandLogo from './BrandLogo';

const mainNavItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/services', label: 'Services', icon: Server },
  { path: '/managed', label: 'Manage', icon: Settings2 },
  { path: '/backups', label: 'Backups', icon: Database },
  { path: '/jobs', label: 'Jobs', icon: Clock },
  { path: '/audit', label: 'Audit Log', icon: ScrollText },
];

const footerNavItems = [
  { path: '/docs', label: 'Docs', icon: BookOpen },
  { path: '/about', label: 'About', icon: Info },
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

  const allNavItems = [...mainNavItems, ...footerNavItems];
  const activeItem = allNavItems.find((item) => item.path === location.pathname);

  return (
    <>
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <BrandLogo size="sm" />
        </div>

        <div className="sidebar-section-label">Navigation</div>

        <nav>
          {mainNavItems.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`nav-link${location.pathname === path ? ' active' : ''}`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-footer">
          {footerNavItems.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`nav-link${location.pathname === path ? ' active' : ''}`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
          <button onClick={handleLogout} className="nav-link danger">
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        <header className="page-header">
          <div className="page-header-left">
            <h1>{activeItem?.label ?? 'Dashboard'}</h1>
          </div>
          <div id="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }} />
        </header>

        <main className="page-body">{children}</main>
      </div>
    </div>

    <footer className="site-footer">
      <span className="site-footer-credit">
        Made with <span className="footer-heart">&#9829;</span> by{' '}
        <a
          href="https://github.com/0xdps"
          className="footer-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          Devendra Pratap Singh
        </a>
      </span>
      <nav className="site-footer-nav">
        <a href="/about" className="footer-link" onClick={e => { e.preventDefault(); navigate('/about'); }}>About</a>
        <a href="https://github.com/0xdps/railway-manage" className="footer-link" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
        <a href="https://github.com/0xdps/railway-manage/issues" className="footer-link" target="_blank" rel="noopener noreferrer">Issues ↗</a>
      </nav>
    </footer>
    </>
  );
}
