import React, { useState } from 'react';
import {
  Clock,
  Plus,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  X,
  Calendar,
  Building2,
} from 'lucide-react';
import { MaintenanceSchedule, VisitCategory, RegionItem, BranchItem, UserProfile } from '../types';
import { apiFetch, formatDateTime } from '../lib/api';
import { canCreateOrManageTickets } from '../lib/permissions';

interface MaintenanceViewProps {
  currentUser: UserProfile;
  schedules: MaintenanceSchedule[];
  regions: RegionItem[];
  branches: BranchItem[];
  users: UserProfile[];
  onCreated: (sched: MaintenanceSchedule) => void;
  onUpdated: (sched: MaintenanceSchedule) => void;
  onDeleted: (id: string) => void;
  onCreateVisitFromSchedule?: (sched: MaintenanceSchedule) => void;
  onCreateTicketFromSchedule?: (sched: MaintenanceSchedule) => void;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  currentUser,
  schedules,
  regions,
  branches,
  users,
  onCreated,
  onUpdated,
  onDeleted,
  onCreateVisitFromSchedule,
  onCreateTicketFromSchedule,
}) => {
  const canManage = canCreateOrManageTickets(currentUser.role);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<VisitCategory>('AC Cleaning & Service');
  const [region, setRegion] = useState(regions[0]?.name || 'Jabodetabek');
  const [branchUnit, setBranchUnit] = useState(branches[0]?.name || '');
  const [frequencyDays, setFrequencyDays] = useState('30');
  const [nextDueDate, setNextDueDate] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [assignedToId, setAssignedToId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const regionBranches = branches.filter((b) => b.regionName === region);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const assignedUser = users.find((u) => u.id === assignedToId);
      const res = await apiFetch<{ schedule: MaintenanceSchedule }>('/api/schedules', {
        method: 'POST',
        body: JSON.stringify({
          title,
          category,
          region,
          branchUnit: branchUnit || (regionBranches[0]?.name ?? 'Pusat'),
          frequencyDays: Number(frequencyDays) || 30,
          nextDueDate,
          assignedToId,
          assignedToName: assignedUser ? assignedUser.name : 'Belum Ditugaskan',
        }),
      });
      onCreated(res.schedule);
      setIsModalOpen(false);
      setTitle('');
      setFrequencyDays('30');
      setAssignedToId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat jadwal maintenance');
    } finally {
      setSaving(false);
    }
  };

  const handleTrigger = async (sched: MaintenanceSchedule, actionType: 'visit' | 'ticket') => {
    try {
      const res = await apiFetch<{ schedule: MaintenanceSchedule }>(`/api/schedules/${sched.id}/trigger`, {
        method: 'POST',
      });
      onUpdated(res.schedule);
      if (actionType === 'visit' && onCreateVisitFromSchedule) {
        onCreateVisitFromSchedule(sched);
      } else if (actionType === 'ticket' && onCreateTicketFromSchedule) {
        onCreateTicketFromSchedule(sched);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menjalankan trigger jadwal');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' });
      onDeleted(id);
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus jadwal');
      setConfirmDeleteId(null);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8 space-y-5 max-w-7xl mx-auto min-w-0 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Jadwal Maintenance Rutin (Preventive Maintenance)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Atur jadwal servis berkala (cuci AC, audit rack, load test UPS) lengkap dengan pengingat jatuh tempo & 1-klik buat visit/tiket.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition active:scale-[0.98] shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Jadwal Maintenance</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {schedules.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <Clock className="w-10 h-10 text-slate-400 mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Belum Ada Jadwal Maintenance</h3>
            <p className="text-xs text-slate-500 mt-1">Buat jadwal berkala untuk memastikan perangkat cabang terpelihara tepat waktu.</p>
          </div>
          {canManage && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl"
            >
              + Buat Jadwal Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {schedules.map((sch) => {
            const isDue = sch.nextDueDate <= todayStr || sch.status === 'Due';
            return (
              <div
                key={sch.id}
                className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border flex flex-col justify-between space-y-4 ${
                  isDue ? 'border-amber-400 dark:border-amber-500/80 shadow-sm' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 truncate">
                      {sch.region} · {sch.category}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                        isDue ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isDue ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>{isDue ? 'JATUH TEMPO' : 'AKTIF'}</span>
                    </span>
                  </div>

                  <h4 className="mt-2 text-base font-bold text-slate-900 dark:text-white truncate">{sch.title}</h4>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="truncate">{sch.branchUnit}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Jadwal Berikutnya: <strong className="font-mono">{sch.nextDueDate}</strong> (tiap {sch.frequencyDays} hari)</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    PIC: {sch.assignedToName}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  {canManage && (
                    <button
                      onClick={() => setConfirmDeleteId(sch.id)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-rose-600 hover:bg-rose-50"
                      title="Hapus Jadwal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={() => handleTrigger(sch, 'visit')}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 transition"
                      title="Buat Laporan Visit dari Jadwal Ini"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>Buat Visit</span>
                    </button>
                    <button
                      onClick={() => handleTrigger(sch, 'ticket')}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5 transition"
                      title="Buat Tiket Maintenance"
                    >
                      <span>Buat Tiket</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && canManage && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90dvh] overflow-y-auto">
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Buat Jadwal Maintenance Rutin</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Judul / Agenda Servis</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Cuci AC & Cek Filter Server Room"
                  className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kategori Pekerjaan</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as VisitCategory)}
                  className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  <option value="AC Cleaning & Service">AC Cleaning & Service</option>
                  <option value="Server Rack Audit">Server Rack Audit</option>
                  <option value="UPS Battery Load Test">UPS Battery Load Test</option>
                  <option value="Network Cable Management">Network Cable Management</option>
                  <option value="General Infrastructure Check">General Infrastructure Check</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Wilayah</label>
                  <select
                    value={region}
                    onChange={(e) => {
                      const nextReg = e.target.value;
                      setRegion(nextReg);
                      const bList = branches.filter((b) => b.regionName === nextReg);
                      if (bList.length > 0) setBranchUnit(bList[0].name);
                    }}
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    {regions.map((r) => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Unit Cabang</label>
                  <select
                    value={branchUnit}
                    onChange={(e) => setBranchUnit(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    {regionBranches.length === 0 ? (
                      <option value={branchUnit || 'Pusat'}>{branchUnit || 'Pusat'}</option>
                    ) : (
                      regionBranches.map((b) => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Frekuensi (Hari)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={frequencyDays}
                    onChange={(e) => setFrequencyDays(e.target.value)}
                    placeholder="30"
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tanggal Jatuh Tempo</label>
                  <input
                    type="date"
                    required
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tugaskan PIC (Opsional)</label>
                <select
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  <option value="">Belum Ditugaskan</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Jadwal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Hapus Jadwal Maintenance?</h3>
            <p className="text-xs text-slate-500">Jadwal berkala ini akan dihapus permanen.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteId(null)} className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
                Batal
              </button>
              <button onClick={() => handleDelete(confirmDeleteId)} className="min-h-[40px] px-4 py-2 rounded-xl bg-rose-600 text-xs font-semibold text-white">
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
