import React, { useState } from 'react';
import { Building2, Plus, Edit3, Trash2, X, Check, MapPin } from 'lucide-react';
import { BranchItem, RegionItem, UserProfile } from '../types';
import { apiFetch } from '../lib/api';

interface BranchManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  regions: RegionItem[];
  branches: BranchItem[];
  currentUser: UserProfile;
  onCreated: (branch: BranchItem) => void;
  onUpdated: (branch: BranchItem) => void;
  onDeleted: (id: string) => void;
}

export const BranchManagerModal: React.FC<BranchManagerModalProps> = ({
  isOpen,
  onClose,
  regions,
  branches,
  currentUser,
  onCreated,
  onUpdated,
  onDeleted,
}) => {
  const [editingBranch, setEditingBranch] = useState<BranchItem | null>(null);
  const [regionName, setRegionName] = useState(regions[0]?.name || 'Jabodetabek');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [picName, setPicName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingBranch(null);
    setRegionName(regions[0]?.name || 'Jabodetabek');
    setName('');
    setCode('');
    setAddress('');
    setPicName('');
    setError('');
  };

  const startEdit = (b: BranchItem) => {
    setEditingBranch(b);
    setRegionName(b.regionName || regions[0]?.name || '');
    setName(b.name);
    setCode(b.code);
    setAddress(b.address);
    setPicName(b.picName);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { regionName, name, code, address, picName };
      if (editingBranch) {
        const res = await apiFetch<{ branch: BranchItem }>(`/api/branches/${editingBranch.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        onUpdated(res.branch);
        setEditingBranch(null);
      } else {
        const res = await apiFetch<{ branch: BranchItem }>('/api/branches', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onCreated(res.branch);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan cabang');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    try {
      await apiFetch(`/api/branches/${id}`, { method: 'DELETE' });
      onDeleted(id);
      setConfirmDeleteId(null);
      if (editingBranch?.id === id) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus cabang');
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4">
      <div className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90dvh] overflow-y-auto">
        <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Kelola Master Cabang & Unit Operasional
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Daftar cabang resmi per wilayah untuk standarisasi input perangkat, tiket, dan visit.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Add / Edit */}
        <form onSubmit={handleSubmit} className="mt-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {editingBranch ? `Edit Cabang: ${editingBranch.name}` : 'Tambah Cabang Baru'}
            </span>
            {editingBranch && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                + Mode Tambah Baru
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Wilayah</label>
              <select
                required
                value={regionName}
                onChange={(e) => setRegionName(e.target.value)}
                className="w-full min-h-[38px] px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              >
                {regions.map((r) => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Nama Cabang / Unit</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Cabang Utama Bandung Asia Afrika"
                className="w-full min-h-[38px] px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Kode Cabang</label>
              <input
                type="text"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="BDG-01"
                className="w-full min-h-[38px] px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono uppercase"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">PIC Cabang</label>
              <input
                type="text"
                value={picName}
                onChange={(e) => setPicName(e.target.value)}
                placeholder="Kepala Cabang / IT"
                className="w-full min-h-[38px] px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Alamat Singkat</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Jl. Asia Afrika No. 10"
                className="w-full min-h-[38px] px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          {error && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2">
            {editingBranch && (
              <button
                type="button"
                onClick={resetForm}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold"
              >
                Batal Edit
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="min-h-[38px] px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold flex items-center gap-1.5"
            >
              {editingBranch ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{saving ? 'Menyimpan...' : editingBranch ? 'Simpan Perubahan' : 'Tambah Cabang'}</span>
            </button>
          </div>
        </form>

        {/* List Branches */}
        <div className="mt-4 space-y-2">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Daftar Cabang Terdaftar ({branches.length})
          </p>

          {branches.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              Belum ada cabang terdaftar. Tambahkan cabang operasional di atas.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
              {branches.map((b) => {
                const isConfirming = confirmDeleteId === b.id;
                return (
                  <div key={b.id} className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono font-bold text-[10px] text-slate-700 dark:text-slate-300">
                          {b.code || 'CAB'}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white truncate">{b.name}</span>
                        <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">({b.regionName})</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {b.address ? `${b.address} · ` : ''}PIC: {b.picName || 'Belum diatur'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(b)}
                        className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        title="Edit Cabang"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(b.id)}
                            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold text-[11px]"
                          >
                            Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[34px] px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 text-[11px]"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(b.id)}
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-rose-600 hover:bg-rose-50"
                          title="Hapus Cabang"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
