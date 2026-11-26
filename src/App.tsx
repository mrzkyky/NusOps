import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BellRing, X } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { MobileBottomNav } from './components/MobileBottomNav';
import { DashboardOverview } from './components/DashboardOverview';
import { InfrastructureView } from './components/InfrastructureView';
import { TicketingView } from './components/TicketingView';
import { FieldVisitsView } from './components/FieldVisitsView';
import { AccountView } from './components/AccountView';
import { MasterPromptView } from './components/MasterPromptView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AuthGate } from './components/AuthGate';
import { apiFetch, getAuthToken, getSessionExpiresAt, setAuthToken, setUnauthorizedHandler } from './lib/api';
import { canCreateOrManageTickets, canManageDevices } from './lib/permissions';
import { InfrastructureDevice, Ticket, FieldVisitReport, UserProfile, AppNotification } from './types';

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 400);
  } catch {
    // Ignore audio context errors when autoplay is blocked
  }
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('nusantara_theme');
    return saved ? saved === 'dark' : true;
  });
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Auth & Boot State
  const [bootLoading, setBootLoading] = useState(true);
  const [hasUsers, setHasUsers] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [authNotice, setAuthNotice] = useState<string>('');

  // Real SQLite Data State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [devices, setDevices] = useState<InfrastructureDevice[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [visits, setVisits] = useState<FieldVisitReport[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [liveToast, setLiveToast] = useState<AppNotification | null>(null);
  const [focusedTicketId, setFocusedTicketId] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Quick-open modals
  const [isCreateDeviceModalOpen, setIsCreateDeviceModalOpen] = useState(false);
  const [isCreateTicketModalOpen, setIsCreateTicketModalOpen] = useState(false);
  const [isCreateVisitModalOpen, setIsCreateVisitModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('nusantara_theme', darkMode ? 'dark' : 'light');
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const loadWorkspaceData = useCallback(async () => {
    const [uRes, dRes, tRes, vRes, nRes] = await Promise.all([
      apiFetch<{ users: UserProfile[] }>('/api/users'),
      apiFetch<{ devices: InfrastructureDevice[] }>('/api/devices'),
      apiFetch<{ tickets: Ticket[] }>('/api/tickets'),
      apiFetch<{ visits: FieldVisitReport[] }>('/api/visits'),
      apiFetch<{ notifications: AppNotification[] }>('/api/notifications'),
    ]);
    setUsers(uRes.users);
    setDevices(dRes.devices);
    setTickets(tRes.tickets);
    setVisits(vRes.visits);
    setNotifications(nRes.notifications);
  }, []);

  const handleSessionExpired = useCallback(
    (message = 'Sesi JWT 30 menit telah berakhir. Silakan masuk kembali.') => {
      setAuthToken(null);
      setCurrentUser(null);
      setSessionExpiresAt(null);
      setUsers([]);
      setDevices([]);
      setTickets([]);
      setVisits([]);
      setNotifications([]);
      setLiveToast(null);
      setFocusedTicketId(null);
      setMobileMenuOpen(false);
      setAuthNotice(message);
    },
    []
  );

  useEffect(() => {
    setUnauthorizedHandler(() => {
      handleSessionExpired('Sesi JWT 30 menit telah berakhir atau tidak valid. Silakan masuk kembali.');
    });
    return () => setUnauthorizedHandler(null);
  }, [handleSessionExpired]);

  useEffect(() => {
    if (!currentUser || !sessionExpiresAt) return;
    const msRemaining = sessionExpiresAt - Date.now();
    if (msRemaining <= 0) {
      handleSessionExpired();
      return;
    }

    const timeout = setTimeout(() => {
      handleSessionExpired();
    }, msRemaining);

    const interval = setInterval(() => {
      if (Date.now() >= sessionExpiresAt) {
        handleSessionExpired();
      }
    }, 15000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() >= sessionExpiresAt) {
        handleSessionExpired();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentUser, sessionExpiresAt, handleSessionExpired]);

  // Real-time WebSocket subscription for instant task & ticket notifications
  useEffect(() => {
    if (!currentUser) return;

    let disposed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let backoffMs = 2000;
    let hasConnectedOnce = false;

    const showToast = (notif: AppNotification) => {
      setLiveToast(notif);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => {
        setLiveToast(null);
      }, 9000);
    };

    const resyncAfterReconnect = async () => {
      try {
        const [nRes, tRes] = await Promise.all([
          apiFetch<{ notifications: AppNotification[] }>('/api/notifications'),
          apiFetch<{ tickets: Ticket[] }>('/api/tickets'),
        ]);
        if (!disposed) {
          setNotifications(nRes.notifications);
          setTickets(tRes.tickets);
        }
      } catch {
        // Ignore transient resync failure
      }
    };

    const connect = () => {
      if (disposed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = getAuthToken();
      const wsUrl = `${proto}//${window.location.host}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        backoffMs = 2000;
        if (hasConnectedOnce) {
          void resyncAfterReconnect();
        }
        hasConnectedOnce = true;
      };

      ws.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(String(evt.data || '{}')) as {
            event?: string;
            data?: Record<string, unknown>;
          };

          if (parsed.event === 'notification:created' && parsed.data?.notification) {
            const incoming = parsed.data.notification as AppNotification;
            setNotifications((prev) =>
              prev.some((n) => n.id === incoming.id) ? prev : [incoming, ...prev].slice(0, 40)
            );
            showToast(incoming);
            playNotificationChime();

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(incoming.title, {
                  body: incoming.message,
                  icon: '/pwa-192x192.png',
                });
              } catch {
                // Ignore browser Notification fallback errors
              }
            }
          } else if (parsed.event === 'ticket:created' && parsed.data?.ticket) {
            const incoming = parsed.data.ticket as Ticket;
            setTickets((prev) => (prev.some((t) => t.id === incoming.id) ? prev : [incoming, ...prev]));
          } else if (parsed.event === 'ticket:updated' && parsed.data?.ticket) {
            const incoming = parsed.data.ticket as Ticket;
            setTickets((prev) =>
              prev.some((t) => t.id === incoming.id)
                ? prev.map((t) => (t.id === incoming.id ? incoming : t))
                : [incoming, ...prev]
            );
          } else if (parsed.event === 'ticket:deleted' && typeof parsed.data?.id === 'string') {
            const deletedId = parsed.data.id;
            setTickets((prev) => prev.filter((t) => t.id !== deletedId));
          }
        } catch {
          // Ignore malformed WS payloads
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        reconnectTimer = window.setTimeout(() => {
          backoffMs = Math.min(15000, backoffMs * 2);
          connect();
        }, backoffMs);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      ws?.close();
    };
  }, [currentUser?.id]);

  useEffect(() => {
    (async () => {
      try {
        const session = await apiFetch<{
          hasUsers: boolean;
          currentUser: UserProfile | null;
          expiresAt?: number | null;
          smtpConfigured: boolean;
        }>('/api/auth/session', { cache: 'no-store' });
        setHasUsers(session.hasUsers);
        setSmtpConfigured(session.smtpConfigured);
        if (session.currentUser) {
          const resolvedExpiry = session.expiresAt ?? getSessionExpiresAt();
          if (resolvedExpiry && resolvedExpiry <= Date.now()) {
            handleSessionExpired();
          } else {
            setCurrentUser(session.currentUser);
            setSessionExpiresAt(resolvedExpiry);
            await loadWorkspaceData();
          }
        } else {
          setAuthToken(null);
          setCurrentUser(null);
          setSessionExpiresAt(null);
        }
      } catch {
        // Offline fallback handled cleanly
      } finally {
        setBootLoading(false);
      }
    })();
  }, [loadWorkspaceData, handleSessionExpired]);

  const handleAuthenticated = async (user: UserProfile, expiresAt?: number | null) => {
    setHasUsers(true);
    setAuthNotice('');
    try {
      setCurrentUser(user);
      setSessionExpiresAt(expiresAt ?? getSessionExpiresAt() ?? Date.now() + 30 * 60 * 1000);
      await loadWorkspaceData();
    } catch {
      setAuthToken(null);
      setCurrentUser(null);
      setSessionExpiresAt(null);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout network errors and clear local session state
    } finally {
      setAuthToken(null);
      setCurrentUser(null);
      setSessionExpiresAt(null);
      setAuthNotice('');
      setUsers([]);
      setDevices([]);
      setTickets([]);
      setVisits([]);
      setNotifications([]);
      setLiveToast(null);
      setFocusedTicketId(null);
      setMobileMenuOpen(false);
    }
  };

  const handleClickNotification = async (notif: AppNotification) => {
    if (!notif.isRead) {
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)));
      void apiFetch(`/api/notifications/${notif.id}/read`, { method: 'PATCH' }).catch(() => {});
    }
    if (liveToast?.id === notif.id) setLiveToast(null);
    if (notif.ticketId) {
      setFocusedTicketId(notif.ticketId);
      setCurrentTab('ticketing');
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    void apiFetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
  };

  if (bootLoading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-slate-500">Memuat NusantaraOps...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <AuthGate
          hasUsers={hasUsers}
          smtpConfigured={smtpConfigured}
          notice={authNotice}
          onAuthenticated={handleAuthenticated}
        />
        <OfflineIndicator />
      </>
    );
  }

  const alertDevices = devices.filter((d) => d.status !== 'online');
  const openTickets = tickets.filter((t) => t.status === 'Open' || t.status === 'In Progress');

  const tabTitles: Record<string, string> = {
    dashboard: 'Ringkasan Nasional',
    infrastructure: 'Perangkat & Server',
    ticketing: 'Tiketing Insiden',
    visits: 'Visit & Daily Report',
    accounts: 'Akun & Tim',
    masterprompt: 'Master Prompt & Stack',
  };

  return (
    <div className="flex h-[100dvh] bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        currentUser={currentUser}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden min-w-0">
        <TopHeader
          currentTabTitle={tabTitles[currentTab] || 'Dashboard'}
          currentUser={currentUser}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          alertDevices={alertDevices}
          openTickets={openTickets}
          notifications={notifications}
          onClickNotification={handleClickNotification}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onJumpToTab={setCurrentTab}
        />

        {liveToast && (
          <div className="fixed top-16 sm:top-20 right-3 left-3 sm:left-auto sm:right-6 z-50 sm:w-96 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white border border-blue-500/60 shadow-2xl p-3.5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
              <BellRing className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-bold text-white truncate">{liveToast.title}</p>
              <p className="text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">{liveToast.message}</p>
              <div className="flex items-center gap-2 mt-2">
                {liveToast.ticketId && (
                  <button
                    onClick={() => handleClickNotification(liveToast)}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] transition"
                  >
                    Buka Tugas
                  </button>
                )}
                <button
                  onClick={() => setLiveToast(null)}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[11px]"
                >
                  Tutup
                </button>
              </div>
            </div>
            <button
              onClick={() => setLiveToast(null)}
              className="text-slate-400 hover:text-white shrink-0"
              aria-label="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
          {currentTab === 'dashboard' && (
            <DashboardOverview
              currentUser={currentUser}
              devices={devices}
              tickets={tickets}
              visits={visits}
              onNavigate={setCurrentTab}
              onOpenNewDevice={() => {
                setCurrentTab('infrastructure');
                if (canManageDevices(currentUser.role)) setIsCreateDeviceModalOpen(true);
              }}
              onOpenNewTicket={() => {
                setCurrentTab('ticketing');
                if (canCreateOrManageTickets(currentUser.role)) setIsCreateTicketModalOpen(true);
              }}
              onOpenNewVisit={() => {
                setCurrentTab('visits');
                setIsCreateVisitModalOpen(true);
              }}
            />
          )}

          {currentTab === 'infrastructure' && (
            <InfrastructureView
              currentUser={currentUser}
              devices={devices}
              globalSearch={searchTerm}
              onCreated={(dev) => setDevices((prev) => [dev, ...prev])}
              onUpdated={(dev) => setDevices((prev) => prev.map((d) => (d.id === dev.id ? dev : d)))}
              onDeleted={(id) => setDevices((prev) => prev.filter((d) => d.id !== id))}
              isCreateModalOpen={isCreateDeviceModalOpen}
              setIsCreateModalOpen={setIsCreateDeviceModalOpen}
            />
          )}

          {currentTab === 'ticketing' && (
            <TicketingView
              currentUser={currentUser}
              tickets={tickets}
              users={users}
              devices={devices}
              globalSearch={searchTerm}
              onCreated={(tkt) => setTickets((prev) => (prev.some((t) => t.id === tkt.id) ? prev : [tkt, ...prev]))}
              onUpdated={(tkt) => setTickets((prev) => prev.map((t) => (t.id === tkt.id ? tkt : t)))}
              onDeleted={(id) => setTickets((prev) => prev.filter((t) => t.id !== id))}
              isCreateModalOpen={isCreateTicketModalOpen}
              setIsCreateModalOpen={setIsCreateTicketModalOpen}
              focusedTicketId={focusedTicketId}
              onClearFocusedTicket={() => setFocusedTicketId(null)}
            />
          )}

          {currentTab === 'visits' && (
            <FieldVisitsView
              currentUser={currentUser}
              visits={visits}
              globalSearch={searchTerm}
              onCreated={(vst) => setVisits((prev) => [vst, ...prev])}
              onUpdated={(vst) => setVisits((prev) => prev.map((v) => (v.id === vst.id ? vst : v)))}
              onDeleted={(id) => setVisits((prev) => prev.filter((v) => v.id !== id))}
              isCreateModalOpen={isCreateVisitModalOpen}
              setIsCreateModalOpen={setIsCreateVisitModalOpen}
            />
          )}

          {currentTab === 'accounts' && (
            <AccountView
              currentUser={currentUser}
              users={users}
              smtpConfigured={smtpConfigured}
              sessionExpiresAt={sessionExpiresAt}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              onUpdateCurrentUser={(updated) => {
                setCurrentUser(updated);
                setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
              }}
              onUserAdded={(u) => setUsers((prev) => [u, ...prev])}
              onUserUpdated={(u) => setUsers((prev) => prev.map((item) => (item.id === u.id ? u : item)))}
              onUserDeleted={(id) => setUsers((prev) => prev.filter((u) => u.id !== id))}
              onLogout={handleLogout}
              onPasswordChanged={(msg) => handleSessionExpired(msg)}
              onOpenMasterPrompt={() => setCurrentTab('masterprompt')}
            />
          )}

          {currentTab === 'masterprompt' && <MasterPromptView />}
        </main>
      </div>

      <MobileBottomNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        openTicketCount={openTickets.length}
      />

      <OfflineIndicator />
    </div>
  );
}
