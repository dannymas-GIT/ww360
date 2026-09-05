import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getWw360LogoPath } from '@/utils/brandHost';
import { ww360NavGroups } from './navConfig';
import { Button } from '@/components/ui/button';

export const AppShell: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const logo = getWw360LogoPath('dark');

  return (
    <div className="ww360-app-shell min-h-screen flex bg-[#EEF3F9]">
      <aside
        className={`${
          collapsed ? 'w-[72px]' : 'w-64'
        } hidden md:flex flex-col bg-[#07111f] text-white transition-all duration-200`}
      >
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <img src={logo} alt="Workforce 360" className="h-8 w-auto" />
          {!collapsed && <span className="font-semibold text-sm tracking-wide">Workforce 360</span>}
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
          {ww360NavGroups.map(group => (
            <div key={group.id}>
              {!collapsed && (
                <p className="px-3 mb-2 text-[10px] uppercase tracking-wider text-slate-400">
                  {group.label}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map(item => {
                  const to = item.hash ? `${item.path}#${item.hash}` : item.path;
                  const active =
                    location.pathname === item.path ||
                    (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                  return (
                    <li key={`${group.id}-${item.label}`}>
                      <NavLink
                        to={to}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                          active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'
                        }`}
                        title={item.label}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          {!collapsed && user && (
            <p className="text-xs text-slate-400 truncate mb-2">{user.username}</p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-white/5"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {!collapsed && 'Sign out'}
          </Button>
          <button
            type="button"
            className="mt-2 w-full flex justify-center text-slate-500 hover:text-white"
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#07111f] text-white">
          <Link to="/dashboard">
            <img src={logo} alt="Workforce 360" className="h-7" />
          </Link>
          <button type="button" onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
            <Menu className="h-6 w-6" />
          </button>
        </header>
        {mobileOpen && (
          <div className="md:hidden bg-[#07111f] text-white px-4 pb-4 space-y-2">
            {ww360NavGroups.flatMap(g => g.items).map(item => (
              <Link
                key={item.label}
                to={item.hash ? `${item.path}#${item.hash}` : item.path}
                className="block py-2 text-sm"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
