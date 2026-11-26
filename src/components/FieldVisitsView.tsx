import React, { useState } from 'react';
import {
  ClipboardCheck,
  Plus,
  Search,
  ArrowLeft,
  Camera,
  Trash2,
  Edit3,
  Download,
  Printer,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';
import { FieldVisitReport, VisitCategory, VisitChecklistItem, UserProfile } from '../types';
import { apiFetch, compressAndUploadImage } from '../lib/api';
import { canApproveVisits } from '../lib/permissions';

interface FieldVisitsViewProps {
  currentUser: UserProfile;
  visits: FieldVisitReport[];
  globalSearch: string;
  onCreated: (visit: FieldVisitReport) => void;
  onUpdated: (visit: FieldVisitReport) => void;
  onDeleted: (id: string) => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
}

const DEFAULT_CHECKLISTS: Record<VisitCategory, string[]> = {
  'AC Cleaning & Service': [
    'Cuci filter indoor & sirip evaporator',
    'Bersihkan drainase & saluran pembuangan',
    'Cek arus kompresor & tekanan freon',
    'Catat suhu ruang server sebelum & sesudah',
  ],
  'Server Rack Audit': [
    'Pembersihan debu filter & blower rack',
    'Periksa suhu CPU/storage & airflow rack',
    'Rapikan & label ulang kabel UTP/fiber',
    'Cek grounding & status PSU redundan',
  ],
  'UPS Battery Load Test': [
    'Cek voltase tiap modul baterai',
    'Simulasi failover beban PLN ke UPS',
    'Bersihkan terminal & cek suhu ruang UPS',
  ],
  'Network Cable Management': [
    'Cek kualitas terminasi RJ45 / SFP',
    'Labeling port switch ke patch panel',
    'Test throughput & packet loss jalur utama',
  ],
  'General Infrastructure Check': [
    'Inspeksi fisik perangkat & kelistrikan',
    'Cek akses keamanan fisik ruang server',
    'Verifikasi inventaris aset cabang',
  ],
};

function buildChecklist(cat: VisitCategory): VisitChecklistItem[] {
  return (DEFAULT_CHECKLISTS[cat] || []).map((label, idx) => ({
    id: `chk-${idx}-${Date.now()}`,
    label,
    done: false,
  }));
}

export const FieldVisitsView: React.FC<FieldVisitsViewProps> = ({
  currentUser,
  visits,
  globalSearch,
  onCreated,
  onUpdated,
  onDeleted,
  isCreateModalOpen,
  setIsCreateModalOpen,
}) => {
  const canApprove = canApproveVisits(currentUser.role);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [editingVisit, setEditingVisit] = useState<FieldVisitReport | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form fields
  const [branchUnit, setBranchUnit] = useState('');
  const [region, setRegion] = useState('Jabodetabek');
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [membersInput, setMembersInput] = useState('');
  const [category, setCategory] = useState<VisitCategory>('AC Cleaning & Service');
  const [checklist, setChecklist] = useState<VisitChecklistItem[]>(() => buildChecklist('AC Cleaning & Service'));
  const [newCheckItem, setNewCheckItem] = useState('');
  const [summary, setSummary] = useState('');
  const [findings, setFindings] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [costRp, setCostRp] = useState('0');
  const [photos, setPhotos] = useState<string[]>([]);

  const combinedSearch = (localSearch || globalSearch).trim().toLowerCase();

  const filteredVisits = visits.filter((v) => {
    const matchCategory = categoryFilter === 'All' || v.category === categoryFilter;
    const matchSearch =
      !combinedSearch ||
      v.branchUnit.toLowerCase().includes(combinedSearch) ||
      v.code.toLowerCase().includes(combinedSearch) ||
      v.teamLead.toLowerCase().includes(combinedSearch);
    return matchCategory && matchSearch;
  });

  const selectedVisit =
    visits.find((v) => v.id === selectedVisitId) ||
    (filteredVisits.length > 0 ? filteredVisits[0] : null);

  const resetForm = () => {
    setBranchUnit('');
    setRegion('Jabodetabek');
    setVisitDate(new Date().toISOString().slice(0, 10));
    setMembersInput('');
    setCategory('AC Cleaning & Service');
    setChecklist(buildChecklist('AC Cleaning & Service'));
    setNewCheckItem('');
    setSummary('');
    setFindings('');
    setRecommendations('');
    setCostRp('0');
    setPhotos([]);
    setFormError('');
  };

  const openEdit = (v: FieldVisitReport) => {
    setEditingVisit(v);
    setBranchUnit(v.branchUnit);
    setRegion(v.region);
    setVisitDate(v.visitDate);
    setMembersInput(v.members.join(', '));
    setCategory(v.category);
    setChecklist(v.checklist?.length ? v.checklist : buildChecklist(v.category));
    setSummary(v.summary);
    setFindings(v.findings);
    setRecommendations(v.recommendations);
    setCostRp(String(v.costRp));
    setPhotos(v.photos || []);
    setFormError('');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingPhoto(true);
    setFormError('');
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const url = await compressAndUploadImage(file);
        uploaded.push(url);
      }
      setPhotos((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal mengunggah foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const payload = {
        branchUnit,
        region,
        visitDate,
        members: membersInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        category,
        checklist,
        summary,
        findings,
        recommendations,
        photos,
        costRp: Number(costRp) || 0,
      };

      if (editingVisit) {
        const res = await apiFetch<{ visit: FieldVisitReport }>(`/api/visits/${editingVisit.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        onUpdated(res.visit);
        setEditingVisit(null);
      } else {
        const res = await apiFetch<{ visit: FieldVisitReport }>('/api/visits', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onCreated(res.visit);
        setSelectedVisitId(res.visit.id);
        setMobileShowDetail(true);
        setIsCreateModalOpen(false);
      }
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan laporan');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleExistingChecklist = async (visit: FieldVisitReport, itemId: string) => {
    const canEditThis = canApprove || visit.teamLeadId === currentUser.id;
    if (!canEditThis) return;
    const nextChecklist = visit.checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    try {
      const res = await apiFetch<{ visit: FieldVisitReport }>(`/api/visits/${visit.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ checklist: nextChecklist }),
      });
      onUpdated(res.visit);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal memperbarui checklist');
    }
  };

  const handleStatusChange = async (id: string, status: FieldVisitReport['status']) => {
    try {
      const res = await apiFetch<{ visit: FieldVisitReport }>(`/api/visits/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      onUpdated(res.visit);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal mengubah status laporan');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/visits/${id}`, { method: 'DELETE' });
      onDeleted(id);
      setConfirmDeleteId(null);
      setMobileShowDetail(false);
      if (selectedVisitId === id) setSelectedVisitId(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menghapus laporan');
      setConfirmDeleteId(null);
    }
  };

  const handleExportCsv = () => {
    const headers = ['Kode', 'Tanggal', 'Wilayah', 'Unit Cabang', 'Kategori', 'Ketua Tim', 'Anggota', 'Status', 'Biaya (Rp)', 'Ringkasan', 'Temuan', 'Rekomendasi'];
    const escapeCell = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
    const rows = filteredVisits.map((v) =>
      [
        v.code,
        v.visitDate,
        v.region,
        v.branchUnit,
        v.category,
        v.teamLead,
        v.members.join('; '),
        v.status,
        v.costRp,
        v.summary,
        v.findings,
        v.recommendations,
      ]
        .map(escapeCell)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-visit-nusantaraops-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const modalOpen = isCreateModalOpen || Boolean(editingVisit);

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8 space-y-5 max-w-7xl mx-auto min-w-0 overflow-x-hidden">
      {/* Header action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Kunjungan Cabang & Daily Report
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Catat agenda visit unit (cuci AC, audit server, cek UPS), checklist pekerjaan, foto dokumentasi, dan ekspor laporan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {filteredVisits.length > 0 && (
            <button
              onClick={handleExportCsv}
              className="min-h-[44px] px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          )}
          <button
            onClick={() => { resetForm(); setIsCreateModalOpen(true); }}
            className="min-h-[44px] flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Laporan Visit</span>
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 no-print">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {['All', 'AC Cleaning & Service', 'Server Rack Audit', 'UPS Battery Load Test', 'Network Cable Management', 'General Infrastructure Check'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                categoryFilter === cat
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat === 'All' ? 'Semua Agenda' : cat}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Cari unit cabang, kode laporan, atau ketua tim..."
            className="w-full min-h-[40px] pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none"
          />
        </div>
      </div>

      {filteredVisits.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <ClipboardCheck className="w-10 h-10 text-slate-400 mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {visits.length === 0 ? 'Belum Ada Laporan Kunjungan' : 'Tidak Ada Laporan yang Cocok'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {visits.length === 0
                ? 'Catat hasil visit cabang seperti cuci AC, pengecekan server, dan maintenance unit.'
                : 'Coba ubah kategori atau kata kunci pencarian.'}
            </p>
          </div>
          {visits.length === 0 && (
            <button
              onClick={() => { resetForm(); setIsCreateModalOpen(true); }}
              className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl"
            >
              + Catat Visit Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Visit List */}
          <div className={`lg:col-span-5 space-y-2.5 no-print ${mobileShowDetail ? 'hidden lg:block' : 'block'}`}>
            {filteredVisits.map((visit) => {
              const isSelected = selectedVisit?.id === visit.id;
              const doneCount = visit.checklist?.filter((c) => c.done).length || 0;
              const totalCheck = visit.checklist?.length || 0;
              return (
                <button
                  key={visit.id}
                  onClick={() => {
                    setSelectedVisitId(visit.id);
                    setMobileShowDetail(true);
                  }}
                  className={`w-full text-left p-4 rounded-2xl border transition active:scale-[0.99] ${
                    isSelected
                      ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-500'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{visit.code}</span>
                    <span
                      className={`text-[11px] font-bold ${
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

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{visit.branchUnit}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{visit.category}</p>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                    <span>{visit.teamLead} · {visit.visitDate}</span>
                    {totalCheck > 0 && <span>{doneCount}/{totalCheck} tugas</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Visit Detail */}
          <div className={`lg:col-span-7 min-w-0 overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 ${mobileShowDetail ? 'block' : 'hidden lg:block'}`}>
            {selectedVisit && (
              <div className="space-y-5">
                <button
                  onClick={() => setMobileShowDetail(false)}
                  className="lg:hidden min-h-[40px] flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 no-print"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Daftar Laporan</span>
                </button>

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {selectedVisit.code} · {selectedVisit.region} · {selectedVisit.visitDate}
                    </p>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1 break-words">
                      {selectedVisit.branchUnit}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
                    {canApprove ? (
                      <select
                        value={selectedVisit.status}
                        onChange={(e) => handleStatusChange(selectedVisit.id, e.target.value as FieldVisitReport['status'])}
                        className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
                      >
                        <option value="Submitted">Submitted</option>
                        <option value="Approved">Approved</option>
                        <option value="Revision Required">Revision Required</option>
                      </select>
                    ) : (
                      <span
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                          selectedVisit.status === 'Approved'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : selectedVisit.status === 'Revision Required'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                        }`}
                      >
                        {selectedVisit.status}
                      </span>
                    )}
                    {(canApprove || selectedVisit.teamLeadId === currentUser.id) && (
                      <button
                        onClick={() => openEdit(selectedVisit)}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        title="Edit Laporan"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => window.print()}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      title="Cetak Laporan"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    {(canApprove || (selectedVisit.teamLeadId === currentUser.id && selectedVisit.status !== 'Approved')) && (
                      <button
                        onClick={() => setConfirmDeleteId(selectedVisit.id)}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-rose-600"
                        title="Hapus Laporan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                  <div>
                    <p className="text-slate-400 font-semibold">Agenda Pekerjaan</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedVisit.category}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-semibold">Tim Lapangan</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {selectedVisit.teamLead}
                      {selectedVisit.members.length > 0 && ` (+${selectedVisit.members.join(', ')})`}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-semibold">Biaya Realisasi</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono tabular-nums">
                      Rp {selectedVisit.costRp.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>

                {/* Interactive Checklist */}
                {selectedVisit.checklist && selectedVisit.checklist.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 mb-2">Checklist Pekerjaan Lapangan</h4>
                    <div className="space-y-1.5">
                      {selectedVisit.checklist.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleToggleExistingChecklist(selectedVisit, item.id)}
                          className="w-full min-h-[40px] flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-xs transition"
                        >
                          {item.done ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className={item.done ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}>
                            {item.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div>
                    <h4 className="font-bold text-slate-400 mb-1">Ringkasan Pekerjaan</h4>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedVisit.summary}</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-400 mb-1">Temuan Lapangan</h4>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedVisit.findings}</p>
                  </div>
                  {selectedVisit.recommendations && (
                    <div>
                      <h4 className="font-bold text-slate-400 mb-1">Rekomendasi Tindak Lanjut</h4>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedVisit.recommendations}</p>
                    </div>
                  )}
                </div>

                {/* Uploaded Photos */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 mb-2">Dokumentasi Foto ({selectedVisit.photos.length})</h4>
                  {selectedVisit.photos.length === 0 ? (
                    <p className="text-xs text-slate-400">Tidak ada foto dilampirkan.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {selectedVisit.photos.map((photo, i) => (
                        <a
                          key={i}
                          href={photo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-video"
                        >
                          <img src={photo} alt={`Dokumentasi ${i + 1}`} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Bottom Sheet / Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4">
          <div className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90dvh] overflow-y-auto">
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {editingVisit ? `Edit ${editingVisit.code}` : 'Catat Laporan Visit & Daily Report'}
              </h3>
              <button
                onClick={() => { setIsCreateModalOpen(false); setEditingVisit(null); }}
                className="p-1.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Unit / Cabang Dikunjungi</label>
                <input
                  type="text"
                  required
                  value={branchUnit}
                  onChange={(e) => setBranchUnit(e.target.value)}
                  placeholder="Contoh: Cabang Utama Bandung"
                  className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Wilayah</label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="Jabodetabek">Jabodetabek</option>
                    <option value="Jawa Barat">Jawa Barat</option>
                    <option value="Jawa Timur">Jawa Timur</option>
                    <option value="Sumatera Utara">Sumatera Utara</option>
                    <option value="Sulawesi Selatan">Sulawesi Selatan</option>
                    <option value="Bali Nusra">Bali Nusra</option>
                    <option value="Kalimantan">Kalimantan</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tanggal Visit</label>
                  <input
                    type="date"
                    required
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Biaya (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={costRp}
                    onChange={(e) => setCostRp(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Agenda Pekerjaan</label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const nextCat = e.target.value as VisitCategory;
                      setCategory(nextCat);
                      if (!editingVisit) setChecklist(buildChecklist(nextCat));
                    }}
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="AC Cleaning & Service">AC Cleaning & Service</option>
                    <option value="Server Rack Audit">Server Rack Audit</option>
                    <option value="UPS Battery Load Test">UPS Battery Load Test</option>
                    <option value="Network Cable Management">Network Cable Management</option>
                    <option value="General Infrastructure Check">General Infrastructure Check</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Anggota Tim (pisahkan koma)</label>
                  <input
                    type="text"
                    value={membersInput}
                    onChange={(e) => setMembersInput(e.target.value)}
                    placeholder="Contoh: Budi, Andi"
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Checklist builder */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Checklist Pekerjaan</label>
                <div className="space-y-1.5 mb-2">
                  {checklist.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <button
                        type="button"
                        onClick={() =>
                          setChecklist((prev) =>
                            prev.map((c) => (c.id === item.id ? { ...c, done: !c.done } : c))
                          )
                        }
                        className="flex items-center gap-2 text-left flex-1"
                      >
                        {item.done ? <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" /> : <Square className="w-4 h-4 text-slate-400 shrink-0" />}
                        <span className={item.done ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}>
                          {item.label}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setChecklist((prev) => prev.filter((c) => c.id !== item.id))}
                        className="text-slate-400 hover:text-rose-500 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCheckItem}
                    onChange={(e) => setNewCheckItem(e.target.value)}
                    placeholder="Tambah poin pekerjaan..."
                    className="flex-1 min-w-0 min-h-[38px] px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newCheckItem.trim()) return;
                      setChecklist((prev) => [
                        ...prev,
                        { id: `chk-${Date.now()}`, label: newCheckItem.trim(), done: false },
                      ]);
                      setNewCheckItem('');
                    }}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 rounded-xl font-semibold"
                  >
                    Tambah
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Ringkasan Kegiatan</label>
                <textarea
                  required
                  rows={2}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Jelaskan pekerjaan yang dilakukan selama visit..."
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Temuan Lapangan</label>
                <textarea
                  required
                  rows={2}
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  placeholder="Contoh: Filter AC kotor, suhu turun ke 21°C setelah dicuci..."
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Rekomendasi Tindak Lanjut</label>
                <textarea
                  rows={2}
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  placeholder="Contoh: Jadwalkan cuci AC ulang bulan depan..."
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              {/* Photo Uploader */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Foto Dokumentasi (Kamera / Galeri)</label>
                <label className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <Camera className="w-4 h-4 text-blue-500" />
                  <span>{uploadingPhoto ? 'Mengunggah foto...' : 'Unggah Foto Lapangan (Bisa Pilih Banyak)'}</span>
                  <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                </label>

                {photos.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {photos.map((p, idx) => (
                      <div key={idx} className="relative rounded-xl overflow-hidden aspect-video border border-slate-200 dark:border-slate-700">
                        <img src={p} alt="Upload" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {formError && <p className="text-xs font-medium text-rose-600">{formError}</p>}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsCreateModalOpen(false); setEditingVisit(null); }}
                  className="min-h-[44px] px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingPhoto}
                  className="min-h-[44px] px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl"
                >
                  {saving ? 'Menyimpan...' : editingVisit ? 'Simpan Perubahan' : 'Simpan Laporan Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Hapus Laporan Visit?</h3>
            <p className="text-xs text-slate-500">Laporan kunjungan beserta dokumentasi akan dihapus permanen.</p>
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
