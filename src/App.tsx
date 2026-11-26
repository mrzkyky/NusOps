import React, { useState, useEffect, useCallback } from 'react';
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
import { apiFetch, getSessionExpiresAt, setAuthToken, setUnauthorizedHandler } from './lib/api';
import { canCreateOrManageTickets, canManageDevices } from './lib/permissions';
import { InfrastructureDevice, Ticket, FieldVisitReport, UserProfile } from './types';

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
    const [uRes, dRes, tRes, vRes] = await Promise.all([
      apiFetch<{ users: UserProfile[] }>('/api/users'),
      apiFetch<{ devices: InfrastructureDevice[] }>('/api/devices'),
      apiFetch<{ tickets: Ticket[] }>('/api/tickets'),
      apiFetch<{ visits: FieldVisitReport[] }>('/api/visits'),
    ]);
    setUsers(uRes.users);
    setDevices(dRes.devices);
    setTickets(tRes.tickets);
    setVisits(vRes.visits);
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
      setMobileMenuOpen(false);
    }
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
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onJumpToTab={setCurrentTab}
        />

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
              onCreated={(tkt) => setTickets((prev) => [tkt, ...prev])}
              onUpdated={(tkt) => setTickets((prev) => prev.map((t) => (t.id === tkt.id ? tkt : t)))}
              onDeleted={(id) => setTickets((prev) => prev.filter((t) => t.id !== id))}
              isCreateModalOpen={isCreateTicketModalOpen}
              setIsCreateModalOpen={setIsCreateTicketModalOpen}
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
