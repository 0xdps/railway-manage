import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  LayoutDashboard,
  Server,
  Database,
  Clock,
  ScrollText,
  LogOut,
} from 'lucide-react';
import api from '../api';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/services', label: 'Services', icon: Server },
  { path: '/backups', label: 'Backups', icon: Database },
  { path: '/jobs', label: 'Jobs', icon: Clock },
  { path: '/audit', label: 'Audit Log', icon: ScrollText },
];

export default function Layout({ children, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  async function handleLogout() {
    try {
      await api.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      onLogout();
      navigate('/login');
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gradient-to-b from-railway-900 to-railway-800 text-white transition-all duration-300 flex flex-col
        `}
      >
        {/* Logo */}
        <div className="p-6 border-b border-railway-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-railway-500 rounded-lg flex items-center justify-center font-bold">
              RM
            </div>
            {sidebarOpen && <span className="font-bold text-lg">Railway Manage</span>}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map(({ path, label, icon: Icon }) => (
            <a
              key={path}
              href={path}
              onClick={(e) => {
                e.preventDefault();
                navigate(path);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                location.pathname === path
                  ? 'bg-railway-500 text-white'
                  : 'text-railway-100 hover:bg-railway-700'
              }`}
            >
              <Icon className="w-5 h-5" />
              {sidebarOpen && <span>{label}</span>}
            </a>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-railway-700 space-y-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-railway-100 hover:bg-railway-700 transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            {sidebarOpen && <span>Collapse</span>}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-railway-100 hover:bg-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {navItems.find((item) => item.path === location.pathname)?.label || 'Dashboard'}
            </h2>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-railway-600 to-railway-800 rounded-full flex items-center justify-center text-white font-bold">
                A
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  );
}
