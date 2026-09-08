import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getWw360LogoPath, WW360_LOGO_SIZE } from '@/utils/brandHost';
import { ww360NavGroups, navItemTo, navGroupsForRoles } from './navConfig';
import { Button } from '@/components/ui/button';
import { StateSwitcher } from './StateSwitcher';
import { NotificationBell } from './NotificationBell';

function ensureWw360Fonts() {
  if (typeof document === 'undefined') return;
  const id = 'ww360-google-fonts';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap';
  document.head.appendChild(link);
}

export const AppShell: React.FC = () => {
  const { user, logout, userRoles } = useAuth();
  const navGroups = navGroupsForRoles(userRoles, user?.districts ?? []);
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    ensureWw360Fonts();
    document.body.classList.add('ww360-app');
    return () => document.body.classList.remove('ww360-app');
  }, []);

  const logo = getWw360LogoPath('dark');
  const sidebarLogoH = collapsed ? WW360_LOGO_SIZE.navMinPx : WW360_LOGO_SIZE.navPx;

  return (
    <div className="ww360-app-shell min-h-screen flex bg-[#EEF3F9]">
      <aside
        className={`${
          collapsed ? 'w-[196px]' : 'w-80'
        } hidden md:flex flex-col bg-[#07111f] text-white transition-all duration-200`}
      >
        <div className="px-3 py-4 border-b border-white/10 flex flex-col items-center justify-center">
          <Link to="/dashboard" className="block w-full">
            <img
              src={logo}
              alt="Water Workforce 360"
              className="mx-auto w-auto max-w-full object-contain"
              style={{ height: sidebarLogoH, minHeight: sidebarLogoH }}
            />
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <div className="space-y-6">
            <StateSwitcher />
            {navGroups.map(group => (
              <div key={group.id}>
                {!collapsed && (
                  <p className="px-3 mb-2 text-[10px] uppercase tracking-wider text-slate-400">
                    {group.label}
                  </p>
                )}
                <ul className="space-y-1">
                  {group.items.map(item => {
                    const to = navItemTo(item);
                    const active =
                      location.pathname === item.path ||
                      (item.path !== '/dashboard' &&
                        item.path !== '/continuity' &&
                        location.pathname.startsWith(item.path)) ||
                      (item.path === '/continuity' && location.pathname === '/continuity');
                    return (
                      <li key={`${group.id}-${item.label}`}>
                        <NavLink
                          to={to}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-base ${
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
          </div>

          {/* Keep account actions directly under the last nav item (not viewport-bottom). */}
          <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
            <div className="flex justify-end md:justify-start px-1">
              <NotificationBell />
            </div>
            {!collapsed && user && (
              <p className="px-3 text-sm text-slate-400 truncate">{user.username}</p>
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
          </div>
        </nav>
        <div className="p-3 border-t border-white/10">
          <button
            type="button"
            className="w-full flex justify-center text-slate-500 hover:text-white"
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between gap-3 px-4 py-3 bg-[#07111f] text-white">
          <Link to="/dashboard" className="min-w-0 flex-1 flex items-center">
            <img
              src={logo}
              alt="Water Workforce 360"
              className="w-auto max-w-full object-contain"
              style={{
                height: WW360_LOGO_SIZE.navMinPx,
                minHeight: WW360_LOGO_SIZE.navMinPx,
              }}
            />
          </Link>
          <button type="button" onClick={() => setMobileOpen(o => !o)} aria-label="Menu" className="p-2 -mr-1">
            <Menu className="h-8 w-8" />
          </button>
        </header>
        {mobileOpen && (
          <div className="md:hidden bg-[#07111f] text-white px-4 pb-4 space-y-2">
            {navGroups.flatMap(g => g.items).map(item => (
              <Link
                key={item.label}
                to={navItemTo(item)}
                className="block py-2 text-base min-h-[44px]"
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
