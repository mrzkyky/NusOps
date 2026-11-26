import React, { useEffect, useState } from 'react';
import {
  TicketCheck,
  Plus,
  MapPin,
  Search,
  Send,
  ArrowLeft,
  Trash2,
  Camera,
  X,
  UserCheck,
  ShieldAlert,
  Paperclip,
  FileText,
  Download,
  PlayCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Ticket, TicketPriority, TicketStatus, TicketAttachment, TicketDraftPrefill, UserProfile, InfrastructureDevice } from '../types';
import { apiFetch, compressAndUploadImage, uploadAttachmentFile, formatDateTime, formatRelativeTime } from '../lib/api';
import { canCreateOrManageTickets } from '../lib/permissions';

interface TicketingViewProps {
  currentUser: UserProfile;
  tickets: Ticket[];
  users: UserProfile[];
  devices: InfrastructureDevice[];
  globalSearch: string;
  onCreated: (ticket: Ticket) => void;
  onUpdated: (ticket: Ticket) => void;
  onDeleted: (id: string) => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  focusedTicketId?: string | null;
  onClearFocusedTicket?: () => void;
  draftPrefill?: TicketDraftPrefill | null;
  onClearDraftPrefill?: () => void;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const TicketingView: React.FC<TicketingViewProps> = ({
  currentUser,
  tickets,
  users,
  devices,
  globalSearch,
  onCreated,
  onUpdated,
  onDeleted,
  isCreateModalOpen,
  setIsCreateModalOpen,
  focusedTicketId,
  onClearFocusedTicket,
  draftPrefill,
  onClearDraftPrefill,
}) => {
  const canManageTickets = canCreateOrManageTickets(currentUser.role);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState<boolean>(false);
  const [commentText, setCommentText] = useState('');
  const [commentAttachments, setCommentAttachments] = useState<TicketAttachment[]>([]);
  const [commentNextStatus, setCommentNextStatus] = useState<'' | TicketStatus>('');
  const [uploadingCommentFile, setUploadingCommentFile] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Create form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Ticket['category']>('Server Hardware');
  const [priority, setPriority] = useState<TicketPriority>('High');
  const [branchUnit, setBranchUnit] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const combinedSearch = (localSearch || globalSearch).trim().toLowerCase();

  const filteredTickets = tickets.filter((t) => {
    const matchStatus = statusFilter === 'All' || t.status === statusFilter;
    const matchPriority = priorityFilter === 'All' || t.priority === priorityFilter;
    const matchSearch =
      !combinedSearch ||
      t.title.toLowerCase().includes(combinedSearch) ||
      t.code.toLowerCase().includes(combinedSearch) ||
      t.branchUnit.toLowerCase().includes(combinedSearch);
    return matchStatus && matchPriority && matchSearch;
  });

  const selectedTicket =
    tickets.find((t) => t.id === selectedTicketId) ||
    (filteredTickets.length > 0 ? filteredTickets[0] : null);

  useEffect(() => {
    setCommentText('');
    setCommentAttachments([]);
    setCommentNextStatus('');
    setCommentError('');
  }, [selectedTicket?.id, selectedTicket?.status]);

  useEffect(() => {
    if (!focusedTicketId) return;
    if (tickets.some((t) => t.id === focusedTicketId)) {
      setSelectedTicketId(focusedTicketId);
      setMobileShowDetail(true);
    }
    onClearFocusedTicket?.();
  }, [focusedTicketId, tickets, onClearFocusedTicket]);

  useEffect(() => {
    if (!draftPrefill) return;
    setTitle(draftPrefill.title);
    setCategory(draftPrefill.category);
    setPriority(draftPrefill.priority);
    setBranchUnit(draftPrefill.branchUnit);
    setDeviceId(draftPrefill.deviceId);
    setDescription(draftPrefill.description);
    setFormError('');
    setIsCreateModalOpen(true);
    onClearDraftPrefill?.();
  }, [draftPrefill, onClearDraftPrefill, setIsCreateModalOpen]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setFormError('');
    try {
      const url = await compressAndUploadImage(file);
      setPhotoUrl(url);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal mengunggah foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const res = await apiFetch<{ ticket: Ticket }>('/api/tickets', {
        method: 'POST',
        body: JSON.stringify({
          title,
          category,
          priority,
          branchUnit,
          deviceId,
          assignedToId,
          description,
          photoUrl,
        }),
      });
      onCreated(res.ticket);
      setSelectedTicketId(res.ticket.id);
      setMobileShowDetail(true);
      setIsCreateModalOpen(false);
      setTitle('');
      setBranchUnit('');
      setDeviceId('');
      setAssignedToId('');
      setDescription('');
      setPhotoUrl('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal membuat tiket');
    } finally {
      setSaving(false);
    }
  };

  const handlePatchTicket = async (id: string, patch: Record<string, string>) => {
    try {
      const res = await apiFetch<{ ticket: Ticket }>(`/api/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      onUpdated(res.ticket);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal memperbarui tiket');
    }
  };

  const handleCommentAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingCommentFile(true);
    setCommentError('');
    try {
      const uploaded: TicketAttachment[] = [];
      for (const file of Array.from(files).slice(0, 6 - commentAttachments.length)) {
        const item = await uploadAttachmentFile(file);
        uploaded.push(item);
      }
      setCommentAttachments((prev) => [...prev, ...uploaded].slice(0, 6));
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Gagal mengunggah lampiran');
    } finally {
      setUploadingCommentFile(false);
      e.target.value = '';
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    if (selectedTicket.status === 'Resolved') {
      setCommentError('Tiket sudah selesai & ditutup. Tidak dapat mengirim update atau chat lagi.');
      return;
    }
    if (!commentText.trim() && commentAttachments.length === 0) {
      setCommentError('Tulis update progres atau lampirkan foto/file terlebih dahulu.');
      return;
    }
    setSendingComment(true);
    setCommentError('');
    try {
      const res = await apiFetch<{ ticket: Ticket }>(`/api/tickets/${selectedTicket.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          message: commentText.trim(),
          attachments: commentAttachments,
          ...(commentNextStatus ? { nextStatus: commentNextStatus } : {}),
        }),
      });
      onUpdated(res.ticket);
      setCommentText('');
      setCommentAttachments([]);
      setCommentNextStatus('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Gagal mengirim update penanganan');
    } finally {
      setSendingComment(false);
    }
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/tickets/${id}`, { method: 'DELETE' });
    onDeleted(id);
    setConfirmDeleteId(null);
    setMobileShowDetail(false);
    if (selectedTicketId === id) setSelectedTicketId(null);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8 space-y-5 max-w-7xl mx-auto min-w-0 overflow-x-hidden">
      {/* Header action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Sistem Tiketing & Insiden
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Kelola laporan gangguan perangkat, tugaskan teknisi lapangan, dan catat progres perbaikan.
          </p>
        </div>

        {canManageTickets && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition active:scale-[0.98] shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Tiket Baru</span>
          </button>
        )}
      </div>

      {!canManageTickets && (
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
          <ShieldAlert className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p>
            Pembuatan dan penugasan tiket baru dikelola oleh <strong>Super Admin</strong>, <strong>Manager</strong>, atau <strong>SPV</strong>. Anda dapat memantau tiket aktif, memperbarui status progres, dan menambahkan log penanganan.
          </p>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {['All', 'Open', 'In Progress', 'Pending Review', 'Resolved'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {st === 'All' ? 'Semua Status' : st}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="min-h-[40px] px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="All">Semua Prioritas</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Cari kode tiket, judul, atau cabang..."
              className="w-full min-h-[40px] pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {filteredTickets.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <TicketCheck className="w-10 h-10 text-slate-400 mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {tickets.length === 0 ? 'Belum Ada Tiket Insiden' : 'Tidak Ada Tiket Sesuai Filter'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {tickets.length === 0
                ? 'Catat kendala server, jaringan, AC, atau permintaan maintenance unit di sini.'
                : 'Coba ubah filter status, prioritas, atau kata kunci pencarian.'}
            </p>
          </div>
          {tickets.length === 0 && canManageTickets && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl"
            >
              + Buat Tiket Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Ticket List */}
          <div className={`lg:col-span-5 space-y-2.5 min-w-0 ${mobileShowDetail ? 'hidden lg:block' : 'block'}`}>
            {filteredTickets.map((ticket) => {
              const isSelected = selectedTicket?.id === ticket.id;
              return (
                <button
                  key={ticket.id}
                  onClick={() => {
                    setSelectedTicketId(ticket.id);
                    setMobileShowDetail(true);
                  }}
                  className={`w-full text-left p-4 rounded-2xl border transition active:scale-[0.99] overflow-hidden ${
                    isSelected
                      ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-500'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 truncate">{ticket.code}</span>
                    <span
                      className={`text-[11px] font-bold shrink-0 ${
                        ticket.priority === 'Critical'
                          ? 'text-rose-600 dark:text-rose-400'
                          : ticket.priority === 'High'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {ticket.priority} · {ticket.status}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{ticket.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
                    <span className="truncate">{ticket.branchUnit}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-2 truncate">
                    PIC: {ticket.assignedTo} · {formatRelativeTime(ticket.createdAt)}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Ticket Detail */}
          <div className={`lg:col-span-7 min-w-0 overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 ${mobileShowDetail ? 'block' : 'hidden lg:block'}`}>
            {selectedTicket && (
              <div className="space-y-5">
                <button
                  onClick={() => setMobileShowDetail(false)}
                  className="lg:hidden min-h-[40px] flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Daftar Tiket</span>
                </button>

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {selectedTicket.code} · {selectedTicket.category}
                    </p>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
                      {selectedTicket.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={selectedTicket.status}
                      disabled={selectedTicket.status === 'Resolved' && !canManageTickets}
                      onChange={(e) => handlePatchTicket(selectedTicket.id, { status: e.target.value })}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 disabled:opacity-60"
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Pending Review">Pending Review</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                    {canManageTickets && (
                      <button
                        onClick={() => setConfirmDeleteId(selectedTicket.id)}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Hapus Tiket"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                  <div>
                    <p className="text-slate-400 font-semibold">Cabang / Unit</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedTicket.branchUnit}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-semibold">Pelapor</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedTicket.reportedBy}</p>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Teknisi Bertugas</label>
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      {canManageTickets ? (
                        <select
                          value={selectedTicket.assignedToId}
                          onChange={(e) => handlePatchTicket(selectedTicket.id, { assignedToId: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100"
                        >
                          <option value="">Belum Ditugaskan</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.position || u.role})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {selectedTicket.assignedTo}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-400 mb-1.5">Deskripsi Kendala</h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                    {selectedTicket.description}
                  </p>
                </div>

                {selectedTicket.photoUrl && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 mb-1.5">Foto Bukti Kendala</h4>
                    <button
                      type="button"
                      onClick={() => setPreviewImageUrl(selectedTicket.photoUrl)}
                      className="block w-full sm:w-auto max-w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:opacity-95 transition"
                    >
                      <img
                        src={selectedTicket.photoUrl}
                        alt="Bukti Kendala"
                        className="w-full sm:max-w-sm max-h-60 object-cover"
                      />
                    </button>
                  </div>
                )}

                {/* Quick Work Action Bar */}
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/25 border border-blue-200/70 dark:border-blue-900/50 text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 mr-1">Aksi Pengerjaan:</span>
                  {selectedTicket.status === 'Open' && (
                    <button
                      type="button"
                      onClick={() => handlePatchTicket(selectedTicket.id, { status: 'In Progress' })}
                      className="min-h-[34px] px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5 transition"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>Mulai Kerjakan</span>
                    </button>
                  )}
                  {(selectedTicket.status === 'Open' || selectedTicket.status === 'In Progress') && (
                    <button
                      type="button"
                      onClick={() => handlePatchTicket(selectedTicket.id, { status: 'Pending Review' })}
                      className="min-h-[34px] px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition"
                    >
                      Ajukan Review
                    </button>
                  )}
                  {selectedTicket.status !== 'Resolved' && (
                    <button
                      type="button"
                      onClick={() => handlePatchTicket(selectedTicket.id, { status: 'Resolved' })}
                      className="min-h-[34px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Tandai Selesai</span>
                    </button>
                  )}
                  {selectedTicket.status === 'Resolved' && (
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Tiket sudah selesai ditangani
                    </span>
                  )}
                </div>

                {/* Comments & Work Progress Logs */}
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-500">
                    Log Penanganan & Lampiran Progres ({selectedTicket.comments.length})
                  </h4>

                  <div className="space-y-2.5 lg:max-h-96 lg:overflow-y-auto lg:pr-1">
                    {selectedTicket.comments.length === 0 ? (
                      <p className="text-xs text-slate-400">Belum ada update penanganan dari tim. Kirim teks, foto hasil kerja, atau file lampiran di bawah.</p>
                    ) : (
                      selectedTicket.comments.map((cm) => (
                        <div key={cm.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs space-y-2 min-w-0 overflow-hidden">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-white truncate">{cm.authorName}</span>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">{formatDateTime(cm.timestamp)}</span>
                          </div>
                          {cm.message && <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">{cm.message}</p>}

                          {cm.attachments && cm.attachments.length > 0 && (
                            <div className="pt-1 space-y-2">
                              <div className="flex flex-wrap gap-2">
                                {cm.attachments
                                  .filter((att) => att.mimeType.startsWith('image/'))
                                  .map((att, idx) => (
                                    <button
                                      key={`${cm.id}-img-${idx}`}
                                      type="button"
                                      onClick={() => setPreviewImageUrl(att.url)}
                                      className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 w-24 h-20 hover:opacity-90 transition shrink-0"
                                      title={att.name}
                                    >
                                      <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                                    </button>
                                  ))}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {cm.attachments
                                  .filter((att) => !att.mimeType.startsWith('image/'))
                                  .map((att, idx) => (
                                    <a
                                      key={`${cm.id}-doc-${idx}`}
                                      href={att.url}
                                      download={att.name}
                                      className="inline-flex max-w-full min-w-0 items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400 transition"
                                    >
                                      <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                      <span className="font-medium truncate max-w-[140px] sm:max-w-[180px]">{att.name}</span>
                                      <span className="text-[10px] text-slate-400 shrink-0">{formatFileSize(att.size)}</span>
                                      <Download className="w-3 h-3 text-slate-400 shrink-0" />
                                    </a>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Work Update Composer (automatically locked when ticket is Resolved) */}
                  {selectedTicket.status === 'Resolved' ? (
                    <div className="p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-start gap-3 text-xs">
                      <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          Tiket Ditutup — Chat & Lampiran Dikunci Otomatis
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          Tiket ini sudah berstatus <strong>Resolved</strong>. Siapapun tidak dapat mengirim pesan, foto, atau lampiran baru lagi.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSendComment} className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3 text-xs min-w-0">
                      <textarea
                        rows={2}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Tulis progres pengerjaan, tindakan perbaikan, atau kendala..."
                        className="w-full min-w-0 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />

                      {commentAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {commentAttachments.map((att, idx) => (
                            <div
                              key={`${att.url}-${idx}`}
                              className="relative group flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 max-w-full min-w-0"
                            >
                              {att.mimeType.startsWith('image/') ? (
                                <img src={att.url} alt={att.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                              ) : (
                                <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                              )}
                              <div className="min-w-0 max-w-[130px]">
                                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{att.name}</p>
                                <p className="text-[10px] text-slate-400">{formatFileSize(att.size)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setCommentAttachments((prev) => prev.filter((_, i) => i !== idx))}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-500 shrink-0"
                                title="Hapus Lampiran"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {commentError && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{commentError}</p>}

                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                          <label className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400 cursor-pointer flex items-center justify-center gap-1.5 font-semibold transition">
                            <Camera className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="truncate">{uploadingCommentFile ? 'Mengunggah...' : 'Foto / Kamera'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              disabled={uploadingCommentFile}
                              onChange={handleCommentAttachmentUpload}
                              className="hidden"
                            />
                          </label>

                          <label className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400 cursor-pointer flex items-center justify-center gap-1.5 font-semibold transition">
                            <Paperclip className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span className="truncate">Lampirkan File</span>
                            <input
                              type="file"
                              accept=".pdf,.txt,.csv,.log,.doc,.docx,.xls,.xlsx,.zip,image/*"
                              multiple
                              disabled={uploadingCommentFile}
                              onChange={handleCommentAttachmentUpload}
                              className="hidden"
                            />
                          </label>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <select
                            value={commentNextStatus}
                            onChange={(e) => setCommentNextStatus(e.target.value as '' | TicketStatus)}
                            className="w-full sm:w-auto min-w-0 min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                            title="Opsional: sekaligus ubah status tiket"
                          >
                            <option value="">Status: Tetap ({selectedTicket.status})</option>
                            <option value="In Progress">Set In Progress</option>
                            <option value="Pending Review">Set Pending Review</option>
                            <option value="Resolved">Set Resolved</option>
                          </select>

                          <button
                            type="submit"
                            disabled={sendingComment || uploadingCommentFile}
                            className="w-full sm:w-auto min-h-[42px] px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shrink-0"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{sendingComment ? 'Mengirim...' : 'Kirim Update'}</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Ticket Bottom Sheet / Modal */}
      {isCreateModalOpen && canManageTickets && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4">
          <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90dvh] overflow-y-auto">
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Buat Tiket Insiden Baru</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Judul Kendala</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: AC Server Room Bocor / Router Down"
                  className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kategori</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Ticket['category'])}
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="Server Hardware">Server Hardware</option>
                    <option value="Network & Routing">Network & Routing</option>
                    <option value="AC & Cooling">AC & Cooling</option>
                    <option value="UPS Power">UPS Power</option>
                    <option value="Security & Access">Security & Access</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Prioritas</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TicketPriority)}
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Unit / Cabang</label>
                <input
                  type="text"
                  required
                  value={branchUnit}
                  onChange={(e) => setBranchUnit(e.target.value)}
                  placeholder="Contoh: Cabang Surabaya Basuki"
                  className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Perangkat Terkait (Opsional)</label>
                  <select
                    value={deviceId}
                    onChange={(e) => {
                      setDeviceId(e.target.value);
                      const found = devices.find((d) => d.id === e.target.value);
                      if (found && !branchUnit) setBranchUnit(found.branchUnit);
                    }}
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="">-- Tidak dipilih --</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.branchUnit})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tugaskan Teknisi</label>
                  <select
                    value={assignedToId}
                    onChange={(e) => setAssignedToId(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="">Belum Ditugaskan</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.position || u.role})
                      </option>
                    ))}
                  </select>
                  {assignedToId && (
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                      Notifikasi real-time & email otomatis dikirim ke user terpilih.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Deskripsi Masalah</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Jelaskan kondisi lapangan dan dampak layanan..."
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Foto Kondisi Lapangan (Opsional)</label>
                <label className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <Camera className="w-4 h-4 text-blue-500" />
                  <span>{uploadingPhoto ? 'Mengunggah foto...' : photoUrl ? 'Ganti Foto Terlampir' : 'Ambil Foto / Pilih dari Galeri'}</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
                {photoUrl && (
                  <img src={photoUrl} alt="Preview" className="mt-2 h-24 rounded-xl object-cover border border-slate-200 dark:border-slate-700" />
                )}
              </div>

              {formError && <p className="text-xs font-medium text-rose-600">{formError}</p>}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingPhoto}
                  className="min-h-[44px] px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl"
                >
                  {saving ? 'Menyimpan...' : 'Kirim Tiket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Hapus Tiket Ini?</h3>
            <p className="text-xs text-slate-500">Tiket beserta semua log komentar akan dihapus permanen.</p>
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
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-3xl w-full flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-end gap-2">
              <a
                href={previewImageUrl}
                download
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Unduh</span>
              </a>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white"
                aria-label="Tutup Preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewImageUrl}
              alt="Lampiran Foto"
              className="max-h-[80dvh] w-auto rounded-2xl object-contain border border-white/10 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
