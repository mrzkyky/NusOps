import React, { useState } from 'react';
import { Search, Bell, Menu, X, AlertTriangle, Server, TicketCheck } from 'lucide-react';
import { UserProfile, InfrastructureDevice, Ticket } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface TopHeaderProps {
  currentTabTitle: string;
  currentUser: UserProfile;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  alertDevices: InfrastructureDevice[];
  openTickets: Ticket[];
  onOpenMobileMenu: () => void;
  onJumpToTab: (tab: string) => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentTabTitle,
  currentUser,
  searchTerm,
  setSearchTerm,
  alertDevices,
  openTickets,
  onOpenMobileMenu,
  onJumpToTab,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const unreadCount = alertDevices.length + openTickets.length;
  const initials = currentUser.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 pt-[env(safe-area-inset-top)] shrink-0 sticky top-0 z-30 transition-colors">
      <div className="h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition shrink-0"
            aria-label="Buka Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
            {currentTabTitle}
          </h2>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Desktop Search */}
          <div className="relative hidden md:block w-60 lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari perangkat, tiket, cabang..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Search Toggle */}
          <button
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="md:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            aria-label="Cari"
          >
            {mobileSearchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>

          <div className="lg:hidden">
            <PWAInstallButton compact />
          </div>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              aria-label="Notifikasi"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-24px)] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Pusat Peringatan ({unreadCount})</span>
                    <button onClick={() => setNotifOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {unreadCount === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">Semua perangkat online dan tidak ada tiket terbuka.</p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto space-y-2">
                      {alertDevices.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => { setNotifOpen(false); onJumpToTab('infrastructure'); }}
                          className="w-full text-left p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/50 flex items-start gap-2.5 hover:bg-rose-100/70 transition"
                        >
                          <Server className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{d.name}</p>
                            <p className="text-[11px] text-rose-700 dark:text-rose-300 truncate">{d.status.toUpperCase()} · {d.branchUnit}</p>
                          </div>
                        </button>
                      ))}
                      {openTickets.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => { setNotifOpen(false); onJumpToTab('ticketing'); }}
                          className="w-full text-left p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 flex items-start gap-2.5 hover:bg-amber-100/70 transition"
                        >
                          <TicketCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{t.code}: {t.title}</p>
                            <p className="text-[11px] text-amber-700 dark:text-amber-300 truncate">{t.priority} · {t.branchUnit}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Profile button */}
          <button
            onClick={() => onJumpToTab('accounts')}
            className="hidden sm:flex items-center gap-2.5 pl-2.5 border-l border-slate-200 dark:border-slate-800 text-left"
          >
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{currentUser.name}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {currentUser.position ? `${currentUser.position} · ` : `${currentUser.role} · `}{currentUser.branch}
              </p>
            </div>
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                {initials}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Expandable Search Row */}
      {mobileSearchOpen && (
        <div className="md:hidden pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari perangkat, tiket, atau unit cabang..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
