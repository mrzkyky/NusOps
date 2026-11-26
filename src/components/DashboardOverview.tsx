import React from 'react';
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  TicketCheck,
  ClipboardCheck,
  TrendingUp,
  ArrowUpRight,
  MapPin,
  Plus,
} from 'lucide-react';
import { InfrastructureDevice, Ticket, FieldVisitReport, UserProfile } from '../types';
import { formatRelativeTime } from '../lib/api';
import { canCreateOrManageTickets, canManageDevices } from '../lib/permissions';

interface DashboardOverviewProps {
  currentUser: UserProfile;
  devices: InfrastructureDevice[];
  tickets: Ticket[];
  visits: FieldVisitReport[];
  onNavigate: (tab: string) => void;
  onOpenNewDevice: () => void;
  onOpenNewTicket: () => void;
  onOpenNewVisit: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  currentUser,
  devices,
  tickets,
  visits,
  onNavigate,
  onOpenNewDevice,
  onOpenNewTicket,
  onOpenNewVisit,
}) => {
  const canCreateTicket = canCreateOrManageTickets(currentUser.role);
  const canAddDevice = canManageDevices(currentUser.role);
  const onlineCount = devices.filter((d) => d.status === 'online').length;
  const warningCount = devices.filter((d) => d.status === 'warning').length;
  const offlineCount = devices.filter((d) => d.status === 'offline').length;
  const openTicketsCount = tickets.filter((t) => t.status === 'Open' || t.status === 'In Progress').length;
  const totalCost = visits.reduce((acc, v) => acc + v.costRp, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8 space-y-5 sm:space-y-6 max-w-7xl mx-auto min-w-0 overflow-x-hidden">
      {/* Hero Action Card */}
      <div className="rounded-2xl sm:rounded-3xl bg-slate-900 dark:bg-slate-900 border border-slate-800 p-5 sm:p-7 text-white">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold text-blue-400">
            Pusat Kendali Infrastruktur Nasional · {currentUser.position || currentUser.role}
          </p>
          <h2 className="mt-1.5 text-xl sm:text-3xl font-extrabold tracking-tight text-white [text-wrap:balance]">
            Monitoring Perangkat, Tiket Insiden & Laporan Visit Unit
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            Pantau perangkat di seluruh cabang, kelola penanganan gangguan, serta catat agenda visit lapangan dan maintenance rutin dalam satu tempat.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            {canCreateTicket && (
              <button
                onClick={onOpenNewTicket}
                className="min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Tiket</span>
              </button>
            )}
            <button
              onClick={onOpenNewVisit}
              className="min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition active:scale-[0.98]"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>Catat Visit / Daily Report</span>
            </button>
            {canAddDevice && (
              <button
                onClick={onOpenNewDevice}
                className="min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition active:scale-[0.98]"
              >
                <Server className="w-4 h-4" />
                <span>Tambah Perangkat</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Grid: 2 cols on HP, 4 cols on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <button
          onClick={() => onNavigate('infrastructure')}
          className="text-left p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 transition active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Perangkat</span>
            <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-2 tabular-nums">
            {devices.length} Unit
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {onlineCount} online · {warningCount} warn · {offlineCount} down
          </p>
        </button>

        <button
          onClick={() => onNavigate('ticketing')}
          className="text-left p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-400 transition active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tiket Aktif</span>
            <TicketCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-2 tabular-nums">
            {openTicketsCount} Isu
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Total {tickets.length} tiket tercatat
          </p>
        </button>

        <button
          onClick={() => onNavigate('visits')}
          className="text-left p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 transition active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Laporan Visit</span>
            <ClipboardCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-2 tabular-nums">
            {visits.length} Laporan
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            Cuci AC, Server & UPS
          </p>
        </button>

        <button
          onClick={() => onNavigate('visits')}
          className="text-left p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-400 transition active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Biaya Visit</span>
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-2 tabular-nums truncate">
            Rp {totalCost.toLocaleString('id-ID')}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            Akumulasi realisasi lapangan
          </p>
        </button>
      </div>

      {/* Main Two-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Devices Snapshot */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Status Perangkat Terdaftar</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Data perangkat & hasil probe jaringan terakhir</p>
            </div>
            <button
              onClick={() => onNavigate('infrastructure')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <span>Kelola</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {devices.length === 0 ? (
            <div className="py-10 text-center space-y-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <Server className="w-8 h-8 text-slate-400 mx-auto" />
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Belum ada perangkat terdaftar</p>
                <p className="text-xs text-slate-500 mt-0.5">Tambahkan server, router, UPS, atau unit AC untuk mulai memantau.</p>
              </div>
              {canAddDevice && (
                <button
                  onClick={onOpenNewDevice}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  + Tambah Perangkat Pertama
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {devices.slice(0, 5).map((device) => {
                const isOnline = device.status === 'online';
                const isWarning = device.status === 'warning';
                return (
                  <div
                    key={device.id}
                    onClick={() => onNavigate('infrastructure')}
                    className="py-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 px-2 rounded-xl transition"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-mono truncate">
                          {device.name}
                        </span>
                        <span className="text-[11px] text-slate-400 hidden sm:inline">· {device.type}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{device.branchUnit}</span>
                        <span>·</span>
                        <span className="font-mono">{device.ipAddress}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="hidden sm:block text-right tabular-nums">
                        <p className="text-[11px] text-slate-400">CPU / Temp</p>
                        <p className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {device.cpuUsage}% / {device.temperature}°C
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                          isOnline
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isWarning
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isOnline ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        <span>{device.status.toUpperCase()}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Field Visits Snapshot */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Kunjungan & Daily Report</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Aktivitas visit cabang terbaru</p>
              </div>
              <button
                onClick={() => onNavigate('visits')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>Semua</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {visits.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <ClipboardCheck className="w-7 h-7 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-500">Belum ada laporan kunjungan unit.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {visits.slice(0, 4).map((visit) => (
                  <div
                    key={visit.id}
                    onClick={() => onNavigate('visits')}
                    className="py-3 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 px-2 rounded-xl transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{visit.code}</span>
                      <span
                        className={`text-[11px] font-semibold ${
                          visit.status === 'Approved'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : visit.status === 'Revision Required'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {visit.status}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate mt-0.5">{visit.branchUnit}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {visit.category} · {visit.teamLead} · {formatRelativeTime(visit.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onOpenNewVisit}
            className="mt-4 w-full min-h-[44px] py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            + Catat Laporan Visit Baru
          </button>
        </div>
      </div>
    </div>
  );
};
