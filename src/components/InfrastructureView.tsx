import React, { useState, useEffect } from 'react';
import {
  Server,
  Plus,
  Activity,
  MapPin,
  Search,
  Edit3,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  TicketCheck,
  Cpu,
  SlidersHorizontal,
  Download,
  Building2,
} from 'lucide-react';
import {
  InfrastructureDevice,
  DeviceStatus,
  DeviceProbeLog,
  UserProfile,
  RegionItem,
  BranchItem,
  HostMetrics,
} from '../types';
import { apiFetch, formatRelativeTime, formatDateTime } from '../lib/api';
import { canManageDevices, canDeleteDevices, canCreateOrManageTickets } from '../lib/permissions';

interface InfrastructureViewProps {
  currentUser: UserProfile;
  devices: InfrastructureDevice[];
  regions: RegionItem[];
  branches: BranchItem[];
  globalSearch: string;
  onCreated: (device: InfrastructureDevice) => void;
  onUpdated: (device: InfrastructureDevice) => void;
  onDevicesSynced?: (devices: InfrastructureDevice[]) => void;
  onDeleted: (id: string) => void;
  onOpenRegionManager?: () => void;
  onOpenBranchManager?: () => void;
  onCreateTicketFromDevice?: (device: InfrastructureDevice) => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
}

const TYPES: InfrastructureDevice['type'][] = [
  'Server',
  'Core Router',
  'Switch',
  'UPS Power',
  'AC Cooling Unit',
];

export const InfrastructureView: React.FC<InfrastructureViewProps> = ({
  currentUser,
  devices,
  regions,
  branches,
  globalSearch,
  onCreated,
  onUpdated,
  onDevicesSynced,
  onDeleted,
  onOpenRegionManager,
  onOpenBranchManager,
  onCreateTicketFromDevice,
  isCreateModalOpen,
  setIsCreateModalOpen,
}) => {
  const canEditDevices = canManageDevices(currentUser.role);
  const canRemoveDevices = canDeleteDevices(currentUser.role);
  const canCreateTickets = canCreateOrManageTickets(currentUser.role);
  const canManageRegions = canCreateOrManageTickets(currentUser.role);

  const regionNames = Array.from(
    new Set([
      ...regions.map((r) => r.name),
      ...devices.map((d) => d.region).filter(Boolean),
    ])
  );

  const [regionFilter, setRegionFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [editingDevice, setEditingDevice] = useState<InfrastructureDevice | null>(null);
  const [probingId, setProbingId] = useState<string | null>(null);
  const [probingAll, setProbingAll] = useState(false);
  const [probeAllSummary, setProbeAllSummary] = useState('');
  const [probeFeedback, setProbeFeedback] = useState<Record<string, string>>({});
  const [logsDevice, setLogsDevice] = useState<InfrastructureDevice | null>(null);
  const [deviceLogs, setDeviceLogs] = useState<DeviceProbeLog[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Live host metrics
  const [hostMetrics, setHostMetrics] = useState<HostMetrics | null>(null);
  const [loadingHostMetrics, setLoadingHostMetrics] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [type, setType] = useState<InfrastructureDevice['type']>('Server');
  const [region, setRegion] = useState<string>(regionNames[0] || 'Jabodetabek');
  const [branchUnit, setBranchUnit] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [port, setPort] = useState('80');
  const [probeUrl, setProbeUrl] = useState('');
  const [status, setStatus] = useState<DeviceStatus>('online');
  const [cpuUsage, setCpuUsage] = useState('0');
  const [memoryUsage, setMemoryUsage] = useState('0');
  const [diskUsage, setDiskUsage] = useState('0');
  const [temperature, setTemperature] = useState('25');
  const [notes, setNotes] = useState('');

  const regionBranches = branches.filter((b) => b.regionName === region);

  const fetchHostMetrics = async () => {
    setLoadingHostMetrics(true);
    try {
      const data = await apiFetch<HostMetrics>('/api/system/host-metrics');
      setHostMetrics(data);
    } catch {
      // Ignore transient host metric failure
    } finally {
      setLoadingHostMetrics(false);
    }
  };

  useEffect(() => {
    void fetchHostMetrics();
  }, []);

  const combinedSearch = (localSearch || globalSearch).trim().toLowerCase();

  const filteredDevices = devices.filter((dev) => {
    const matchRegion = regionFilter === 'All' || dev.region === regionFilter;
    const matchType = typeFilter === 'All' || dev.type === typeFilter;
    const matchSearch =
      !combinedSearch ||
      dev.name.toLowerCase().includes(combinedSearch) ||
      dev.branchUnit.toLowerCase().includes(combinedSearch) ||
      dev.ipAddress.toLowerCase().includes(combinedSearch) ||
      dev.region.toLowerCase().includes(combinedSearch);
    return matchRegion && matchType && matchSearch;
  });

  const resetForm = () => {
    setName('');
    setType('Server');
    const defaultReg = regionNames[0] || 'Jabodetabek';
    setRegion(defaultReg);
    const defBranches = branches.filter((b) => b.regionName === defaultReg);
    setBranchUnit(defBranches[0]?.name || '');
    setIpAddress('');
    setPort('80');
    setProbeUrl('');
    setStatus('online');
    setCpuUsage('0');
    setMemoryUsage('0');
    setDiskUsage('0');
    setTemperature('25');
    setNotes('');
    setFormError('');
  };

  const openEdit = (dev: InfrastructureDevice) => {
    setEditingDevice(dev);
    setName(dev.name);
    setType(dev.type);
    setRegion(dev.region || regionNames[0] || '');
    setBranchUnit(dev.branchUnit);
    setIpAddress(dev.ipAddress);
    setPort(String(dev.port || 80));
    setProbeUrl(dev.probeUrl || '');
    setStatus(dev.status);
    setCpuUsage(String(dev.cpuUsage));
    setMemoryUsage(String(dev.memoryUsage));
    setDiskUsage(String(dev.diskUsage));
    setTemperature(String(dev.temperature));
    setNotes(dev.notes || '');
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const payload = {
        name,
        type,
        region,
        branchUnit: branchUnit || (regionBranches[0]?.name ?? 'Pusat'),
        ipAddress,
        port: Number(port) || 80,
        probeUrl,
        status,
        cpuUsage: Number(cpuUsage) || 0,
        memoryUsage: Number(memoryUsage) || 0,
        diskUsage: Number(diskUsage) || 0,
        temperature: Number(temperature) || 0,
        notes,
      };

      if (editingDevice) {
        const res = await apiFetch<{ device: InfrastructureDevice }>(`/api/devices/${editingDevice.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        onUpdated(res.device);
        setEditingDevice(null);
      } else {
        const res = await apiFetch<{ device: InfrastructureDevice }>('/api/devices', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onCreated(res.device);
        setIsCreateModalOpen(false);
      }
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan perangkat');
    } finally {
      setSaving(false);
    }
  };

  const handleProbe = async (dev: InfrastructureDevice) => {
    setProbingId(dev.id);
    try {
      const res = await apiFetch<{
        device: InfrastructureDevice;
        probeResult: { reachable: boolean; latencyMs: number | null; message: string };
      }>(`/api/devices/${dev.id}/probe`, { method: 'POST' });
      onUpdated(res.device);
      setProbeFeedback((prev) => ({ ...prev, [dev.id]: res.probeResult.message }));
    } catch (err) {
      setProbeFeedback((prev) => ({
        ...prev,
        [dev.id]: err instanceof Error ? err.message : 'Gagal melakukan probe',
      }));
    } finally {
      setProbingId(null);
    }
  };

  const handleProbeAll = async () => {
    if (devices.length === 0 || probingAll) return;
    setProbingAll(true);
    setProbeAllSummary('');
    try {
      const res = await apiFetch<{ devices: InfrastructureDevice[]; probedCount: number }>(
        '/api/devices/probe-all',
        { method: 'POST' }
      );
      if (onDevicesSynced) {
        onDevicesSynced(res.devices);
      } else {
        res.devices.forEach((d) => onUpdated(d));
      }
      const downCount = res.devices.filter((d) => d.status === 'offline').length;
      setProbeAllSummary(
        `Selesai mengecek ${res.probedCount} perangkat${downCount > 0 ? ` (${downCount} offline)` : ' — semua terpantau'}.`
      );
    } catch (err) {
      setProbeAllSummary(err instanceof Error ? err.message : 'Gagal menjalankan probe massal');
    } finally {
      setProbingAll(false);
    }
  };

  const handleOpenLogs = async (dev: InfrastructureDevice) => {
    setLogsDevice(dev);
    try {
      const res = await apiFetch<{ logs: DeviceProbeLog[] }>(`/api/devices/${dev.id}/logs`);
      setDeviceLogs(res.logs);
    } catch {
      setDeviceLogs([]);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/devices/${id}`, { method: 'DELETE' });
      onDeleted(id);
      setConfirmDeleteId(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menghapus perangkat');
    }
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Nama Perangkat', 'Tipe', 'Wilayah', 'Unit Cabang', 'IP Address', 'Port', 'Status', 'CPU %', 'RAM %', 'Disk %', 'Suhu (C)', 'Uptime (%)', 'Catatan'];
    const escapeCell = (val: string | number | null) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = filteredDevices.map((d) =>
      [
        d.id,
        d.name,
        d.type,
        d.region,
        d.branchUnit,
        d.ipAddress,
        d.port,
        d.status,
        d.cpuUsage,
        d.memoryUsage,
        d.diskUsage,
        d.temperature,
        d.uptimePct,
        d.notes,
      ]
        .map(escapeCell)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventaris-perangkat-nusantaraops-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const modalOpen = isCreateModalOpen || Boolean(editingDevice);

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8 space-y-5 max-w-7xl mx-auto min-w-0 overflow-x-hidden">
      {/* Header action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Monitoring Perangkat & Server
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cek konektivitas TCP/HTTP nyata, hitung uptime riil, dan ekspor inventaris perangkat ke CSV.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {filteredDevices.length > 0 && (
            <button
              onClick={handleExportCsv}
              className="min-h-[44px] px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          )}
          {devices.length > 0 && (
            <button
              onClick={handleProbeAll}
              disabled={probingAll}
              className="min-h-[44px] flex items-center justify-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold transition disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${probingAll ? 'animate-spin text-blue-500' : ''}`} />
              <span>{probingAll ? 'Mengecek Semua...' : 'Cek Semua Live'}</span>
            </button>
          )}
          {canEditDevices && (
            <button
              onClick={() => { resetForm(); setIsCreateModalOpen(true); }}
              className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Perangkat</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Host Server Metrics Bar */}
      {hostMetrics && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold truncate font-mono">{hostMetrics.hostname}</p>
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">({hostMetrics.platform})</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Metrik Real-Time Host Server NusantaraOps
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-5 tabular-nums">
            <div className="text-xs">
              <span className="text-slate-400 mr-1.5">CPU</span>
              <span className="font-mono font-bold text-white">{hostMetrics.cpuUsage}%</span>
            </div>
            <div className="text-xs">
              <span className="text-slate-400 mr-1.5">RAM</span>
              <span className="font-mono font-bold text-white">{hostMetrics.memoryUsage}%</span>
            </div>
            <div className="text-xs">
              <span className="text-slate-400 mr-1.5">DISK</span>
              <span className="font-mono font-bold text-white">{hostMetrics.diskUsage}%</span>
            </div>
            <button
              onClick={fetchHostMetrics}
              disabled={loadingHostMetrics}
              className="ml-auto lg:ml-0 min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 transition"
              title="Refresh metrik server host"
            >
              <RefreshCw className={`w-3 h-3 ${loadingHostMetrics ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>
        </div>
      )}

      {probeAllSummary && (
        <div className="px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-xs font-medium text-blue-800 dark:text-blue-200 flex items-center justify-between gap-2">
          <span>{probeAllSummary}</span>
          <button onClick={() => setProbeAllSummary('')} className="text-blue-500 hover:text-blue-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {['All', ...regionNames].map((reg) => (
              <button
                key={reg}
                onClick={() => setRegionFilter(reg)}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                  regionFilter === reg
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {reg === 'All' ? 'Semua Wilayah' : reg}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canManageRegions && onOpenRegionManager && (
              <button
                onClick={onOpenRegionManager}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 hover:bg-blue-100 transition"
                title="Kelola Master Wilayah"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Wilayah</span>
              </button>
            )}
            {canManageRegions && onOpenBranchManager && (
              <button
                onClick={onOpenBranchManager}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/60 text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 hover:bg-indigo-100 transition"
                title="Kelola Master Cabang"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Cabang</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="min-h-[40px] px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="All">Semua Tipe Perangkat</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Filter nama perangkat, cabang, wilayah, atau IP..."
              className="w-full min-h-[40px] pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Empty State or Grid */}
      {filteredDevices.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <Server className="w-10 h-10 text-slate-400 mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {devices.length === 0 ? 'Belum Ada Perangkat Terdaftar' : 'Tidak Ada Perangkat yang Cocok'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {devices.length === 0
                ? 'Mulai dengan menambahkan server, router, UPS, atau unit AC cabang.'
                : 'Ubah kata kunci pencarian atau filter wilayah.'}
            </p>
          </div>
          {devices.length === 0 && canEditDevices && (
            <button
              onClick={() => { resetForm(); setIsCreateModalOpen(true); }}
              className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl"
            >
              + Tambah Perangkat Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDevices.map((device) => {
            const isOnline = device.status === 'online';
            const isWarning = device.status === 'warning';
            return (
              <div
                key={device.id}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4 min-w-0 overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                      {device.type} · {device.region}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold shrink-0 ${
                        isOnline
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isWarning
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isOnline ? <CheckCircle2 className="w-3.5 h-3.5" /> : isWarning ? <AlertTriangle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      <span>{device.status.toUpperCase()}</span>
                    </span>
                  </div>

                  <h4 className="mt-2 text-base font-bold text-slate-900 dark:text-white font-mono truncate">
                    {device.name}
                  </h4>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="truncate">{device.branchUnit}</span>
                  </p>
                  <p className="mt-1 text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums break-all">
                    {device.probeUrl ? device.probeUrl : `${device.ipAddress}:${device.port}`}
                    {device.latencyMs !== null && ` · ${device.latencyMs} ms`}
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-2 py-2.5 border-y border-slate-100 dark:border-slate-800 text-center tabular-nums">
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold">CPU</p>
                    <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">{device.cpuUsage}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold">RAM</p>
                    <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">{device.memoryUsage}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold">DISK</p>
                    <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">{device.diskUsage}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold">SUHU</p>
                    <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">{device.temperature}°C</p>
                  </div>
                </div>

                {probeFeedback[device.id] && (
                  <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg">
                    {probeFeedback[device.id]}
                  </p>
                )}

                {!isOnline && canCreateTickets && onCreateTicketFromDevice && (
                  <button
                    onClick={() => onCreateTicketFromDevice(device)}
                    className="w-full min-h-[36px] px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <TicketCheck className="w-3.5 h-3.5" />
                    <span>Buat Tiket Insiden dari Perangkat Ini</span>
                  </button>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-400 truncate tabular-nums">
                    <span>Uptime {device.uptimePct}%</span>
                    <span> · </span>
                    <span>{formatRelativeTime(device.lastPingAt)}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    <button
                      onClick={() => handleOpenLogs(device)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                      title="Riwayat Probe"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                    {canEditDevices && (
                      <button
                        onClick={() => openEdit(device)}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        title="Edit Perangkat"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canRemoveDevices && (
                      <button
                        onClick={() => setConfirmDeleteId(device.id)}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-rose-600 hover:bg-rose-50"
                        title="Hapus Perangkat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleProbe(device)}
                      disabled={probingId === device.id}
                      className="min-h-[36px] px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>{probingId === device.id ? 'Cek...' : 'Cek Live'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Bottom Sheet on Mobile, Modal on Desktop */}
      {modalOpen && canEditDevices && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4">
          <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90dvh] overflow-y-auto">
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {editingDevice ? `Edit ${editingDevice.name}` : 'Tambah Perangkat Infrastruktur'}
              </h3>
              <button
                onClick={() => { setIsCreateModalOpen(false); setEditingDevice(null); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kode / Hostname Perangkat</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: SRV-CORE-JKT-01"
                  className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tipe</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as InfrastructureDevice['type'])}
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Wilayah</label>
                    {canManageRegions && onOpenRegionManager && (
                      <button
                        type="button"
                        onClick={onOpenRegionManager}
                        className="text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        + Kelola
                      </button>
                    )}
                  </div>
                  <select
                    required
                    value={region}
                    onChange={(e) => {
                      const nextReg = e.target.value;
                      setRegion(nextReg);
                      const bList = branches.filter((b) => b.regionName === nextReg);
                      if (bList.length > 0) setBranchUnit(bList[0].name);
                    }}
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    {regionNames.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Nama Unit / Cabang Resmi</label>
                  {canManageRegions && onOpenBranchManager && (
                    <button
                      type="button"
                      onClick={onOpenBranchManager}
                      className="text-[11px] font-semibold text-blue-600 hover:underline"
                    >
                      + Master Cabang
                    </button>
                  )}
                </div>
                {regionBranches.length > 0 ? (
                  <select
                    required
                    value={branchUnit}
                    onChange={(e) => setBranchUnit(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    {regionBranches.map((b) => (
                      <option key={b.id} value={b.name}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={branchUnit}
                    onChange={(e) => setBranchUnit(e.target.value)}
                    placeholder="Contoh: Cabang Utama Bandung"
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">IP Address / Domain</label>
                  <input
                    type="text"
                    required
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    placeholder="Contoh: 103.10.x.x"
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Port TCP</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="80"
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">URL Health Endpoint (Opsional)</label>
                <input
                  type="url"
                  value={probeUrl}
                  onChange={(e) => setProbeUrl(e.target.value)}
                  placeholder="https://status.unitanda.id/health"
                  className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as DeviceStatus)}
                    className="w-full min-h-[40px] px-2 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="online">Online</option>
                    <option value="warning">Warning</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">CPU %</label>
                  <input type="number" min="0" max="100" value={cpuUsage} onChange={(e) => setCpuUsage(e.target.value)} className="w-full min-h-[40px] px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">RAM %</label>
                  <input type="number" min="0" max="100" value={memoryUsage} onChange={(e) => setMemoryUsage(e.target.value)} className="w-full min-h-[40px] px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Disk %</label>
                  <input type="number" min="0" max="100" value={diskUsage} onChange={(e) => setDiskUsage(e.target.value)} className="w-full min-h-[40px] px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Suhu °C</label>
                  <input type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} className="w-full min-h-[40px] px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono" />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Catatan Teknis</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: AC server ruang lt 2"
                  className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              {formError && <p className="text-xs font-medium text-rose-600">{formError}</p>}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsCreateModalOpen(false); setEditingDevice(null); }}
                  className="min-h-[44px] px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl"
                >
                  {saving ? 'Menyimpan...' : editingDevice ? 'Simpan Perubahan' : 'Daftarkan Perangkat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Probe History Logs Sheet */}
      {logsDevice && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[85dvh] overflow-y-auto">
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono">{logsDevice.name}</h3>
                <p className="text-xs text-slate-500">Riwayat probe · Uptime {logsDevice.uptimePct}%</p>
              </div>
              <button onClick={() => setLogsDevice(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {deviceLogs.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">Belum ada riwayat probe.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {deviceLogs.map((log) => (
                  <div key={log.id} className="py-2.5 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${log.status === 'online' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {log.status.toUpperCase()}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">{formatDateTime(log.checked_at)}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">{log.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Hapus Perangkat?</h3>
            <p className="text-xs text-slate-500">Data perangkat beserta riwayat akan dihapus permanen.</p>
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
