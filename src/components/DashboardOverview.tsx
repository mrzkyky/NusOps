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
  Siren,
} from 'lucide-react';
import {
  InfrastructureDevice,
  Ticket,
  FieldVisitReport,
  UserProfile,
  RegionItem,
} from '../types';
import { formatRelativeTime } from '../lib/api';
import { canCreateOrManageTickets, canManageDevices } from '../lib/permissions';

interface DashboardOverviewProps {
  currentUser: UserProfile;
  devices: InfrastructureDevice[];
  tickets: Ticket[];
  visits: FieldVisitReport[];
  regions: RegionItem[];
  onNavigate: (tab: string) => void;
  onSelectTicket?: (ticketId: string) => void;
  onSelectVisit?: (visitId: string) => void;
  onOpenNewDevice: () => void;
  onOpenNewTicket: () => void;
  onOpenNewVisit: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  currentUser,
  devices,
  tickets,
  visits,
  regions,
  onNavigate,
  onSelectTicket,
  onSelectVisit,
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

  const regionNames = Array.from(
    new Set([
      ...regions.map((r) => r.name),
      ...devices.map((d) => d.region).filter(Boolean),
      ...visits.map((v) => v.region).filter(Boolean),
    ])
  );

  const attentionDevices = devices.filter((d) => d.status !== 'online').slice(0, 4);
  const urgentTickets = tickets
    .filter((t) => (t.status === 'Open' || t.status === 'In Progress') && (t.priority === 'Critical' || t.priority === 'High'))
    .slice(0, 4);
  const pendingVisits = visits.filter((v) => v.status === 'Submitted').slice(0, 4);
  const totalActionNeeded = attentionDevices.length + urgentTickets.length + pendingVisits.length;

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
            Pantau perangkat di seluruh wilayah & cabang, kelola penanganan gangguan secara real-time, serta catat agenda visit lapangan dan maintenance rutin dalam satu tempat.
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
            {pendingVisits.length} menunggu review
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

      {/* Action Needed Spotlight (Only if there are live issues/approvals pending) */}
      {totalActionNeeded > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Siren className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Perlu Tindak Lanjut Segera
              </h3>
            </div>
            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              {totalActionNeeded} item aktif
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {attentionDevices.map((d) => (
              <button
                key={d.id}
                onClick={() => onNavigate('infrastructure')}
                className="text-left p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/50 hover:border-rose-400 transition"
              >
                <p className="font-mono font-bold text-rose-700 dark:text-rose-300 truncate">
                  [{d.status.toUpperCase()}] {d.name}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">
                  {d.branchUnit} · {d.region}
                </p>
              </button>
            ))}

            {urgentTickets.map((t) => (
              <button
                key={t.id}
                onClick={() => (onSelectTicket ? onSelectTicket(t.id) : onNavigate('ticketing'))}
                className="text-left p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 hover:border-amber-400 transition"
              >
                <p className="font-mono font-bold text-amber-700 dark:text-amber-300 truncate">
                  [{t.priority}] {t.code}
                </p>
                <p className="text-[11px] text-slate-700 dark:text-slate-200 font-semibold truncate mt-0.5">
                  {t.title}
                </p>
              </button>
            ))}

            {pendingVisits.map((v) => (
              <button
                key={v.id}
                onClick={() => (onSelectVisit ? onSelectVisit(v.id) : onNavigate('visits'))}
                className="text-left p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/50 hover:border-blue-400 transition"
              >
                <p className="font-mono font-bold text-blue-700 dark:text-blue-300 truncate">
                  [Review Visit] {v.code}
                </p>
                <p className="text-[11px] text-slate-700 dark:text-slate-200 font-semibold truncate mt-0.5">
                  {v.branchUnit} · {v.teamLead}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Regional Breakdown Live Summary */}
      {regionNames.length > 0 && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Ringkasan per Wilayah ({regionNames.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rekap langsung jumlah perangkat, kesehatan jaringan, dan laporan visit tiap area.
              </p>
            </div>
            <button
              onClick={() => onNavigate('infrastructure')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Detail</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {regionNames.map((regName) => {
              const regDevices = devices.filter((d) => d.region === regName);
              const regVisits = visits.filter((v) => v.region === regName);
              const regDown = regDevices.filter((d) => d.status !== 'online').length;
              const regMeta = regions.find((r) => r.name === regName);

              return (
                <button
                  key={regName}
                  onClick={() => onNavigate(regDevices.length > 0 ? 'infrastructure' : 'visits')}
                  className="text-left p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 hover:border-blue-400 transition space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{regName}</span>
                    {regMeta?.code && (
                      <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 shrink-0">
                        {regMeta.code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] tabular-nums">
                    <span className="text-slate-600 dark:text-slate-300">{regDevices.length} perangkat</span>
                    <span className={regDown > 0 ? 'font-bold text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}>
                      {regDown > 0 ? `${regDown} isu` : 'Normal'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
                    {regVisits.length} visit{regMeta?.picName ? ` · PIC: ${regMeta.picName}` : ''}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

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
                        <p className="text-[11px] text-slate-400">Uptime / Temp</p>
                        <p className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {device.uptimePct}% / {device.temperature}°C
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
                    onClick={() => (onSelectVisit ? onSelectVisit(visit.id) : onNavigate('visits'))}
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
