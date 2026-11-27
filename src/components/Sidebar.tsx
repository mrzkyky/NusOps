import React from 'react';
import {
  LayoutDashboard,
  Server,
  TicketCheck,
  ClipboardCheck,
  Users,
  ShieldCheck,
  Clock,
  Sun,
  Moon,
  LogOut,
  Building2,
  X,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { UserProfile } from '../types';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  currentUser: UserProfile;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  darkMode,
  setDarkMode,
  currentUser,
  mobileOpen,
  onCloseMobile,
  onLogout,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard Nasional', icon: LayoutDashboard },
    { id: 'infrastructure', label: 'Perangkat & Server', icon: Server },
    { id: 'ticketing', label: 'Tiketing Insiden', icon: TicketCheck },
    { id: 'visits', label: 'Kunjungan & Daily Report', icon: ClipboardCheck },
    { id: 'maintenance', label: 'Maintenance Rutin', icon: Clock },
    { id: 'accounts', label: 'Profil & Akun', icon: Users },
    ...(currentUser.role === 'Super Admin'
      ? [{ id: 'audit', label: 'Audit Log & Sistem', icon: ShieldCheck }]
      : []),
  ];

  const handleSelect = (id: string) => {
    setCurrentTab(id);
    onCloseMobile();
  };

  const initials = currentUser.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 dark:bg-slate-950 text-slate-100 flex flex-col h-screen border-r border-slate-800 shrink-0 select-none transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-white leading-tight">NusantaraOps</h1>
              <p className="text-[11px] text-slate-400">Infrastruktur Nasional</p>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3 bg-slate-950/50">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-xl object-cover border border-slate-700 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">
                  {initials}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">{currentUser.name}</p>
                <p className="text-[11px] text-slate-400 truncate">
                  {currentUser.position ? `${currentUser.position} · ${currentUser.role}` : currentUser.role}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                title="Ganti Tema"
              >
                {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
              </button>
              <button
                onClick={onLogout}
                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-rose-400 hover:bg-slate-700 transition"
                title="Keluar"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <PWAInstallButton />
        </div>
      </aside>
    </>
  );
};
