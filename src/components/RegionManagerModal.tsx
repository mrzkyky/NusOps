import React, { useState } from 'react';
import { MapPin, Plus, Edit3, Trash2, X, Check } from 'lucide-react';
import { RegionItem, InfrastructureDevice, FieldVisitReport } from '../types';
import { apiFetch } from '../lib/api';

interface RegionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  regions: RegionItem[];
  devices: InfrastructureDevice[];
  visits: FieldVisitReport[];
  onCreated: (region: RegionItem) => void;
  onUpdated: (region: RegionItem, previousName?: string) => void;
  onDeleted: (id: string) => void;
}

export const RegionManagerModal: React.FC<RegionManagerModalProps> = ({
  isOpen,
  onClose,
  regions,
  devices,
  visits,
  onCreated,
  onUpdated,
  onDeleted,
}) => {
  const [editingRegion, setEditingRegion] = useState<RegionItem | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [picName, setPicName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingRegion(null);
    setName('');
    setCode('');
    setPicName('');
    setDescription('');
    setError('');
  };

  const startEdit = (reg: RegionItem) => {
    setEditingRegion(reg);
    setName(reg.name);
    setCode(reg.code);
    setPicName(reg.picName);
    setDescription(reg.description);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editingRegion) {
        const previousName = editingRegion.name;
        const res = await apiFetch<{ region: RegionItem }>(`/api/regions/${editingRegion.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, code, picName, description }),
        });
        onUpdated(res.region, previousName);
      } else {
        const res = await apiFetch<{ region: RegionItem }>('/api/regions', {
          method: 'POST',
          body: JSON.stringify({ name, code, picName, description }),
        });
        onCreated(res.region);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan wilayah');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    try {
      await apiFetch(`/api/regions/${id}`, { method: 'DELETE' });
      onDeleted(id);
      setConfirmDeleteId(null);
      if (editingRegion?.id === id) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus wilayah');
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
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Kelola Master Wilayah Operasional
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tambah, ubah nama (otomatis sinkron ke perangkat & visit), atau hapus wilayah.
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
              {editingRegion ? `Edit Wilayah: ${editingRegion.name}` : 'Tambah Wilayah Baru'}
            </span>
            {editingRegion && (
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
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Nama Wilayah</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Jawa Tengah & DIY"
                className="w-full min-h-[38px] px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Kode Wilayah</label>
              <input
                type="text"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="JTG"
                className="w-full min-h-[38px] px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono uppercase focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">PIC / Koordinator (Opsional)</label>
              <input
                type="text"
                value={picName}
                onChange={(e) => setPicName(e.target.value)}
                placeholder="Contoh: Pak Hendra - Area Jateng"
                className="w-full min-h-[38px] px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Cakupan / Keterangan</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Semarang, Solo, Yogyakarta"
                className="w-full min-h-[38px] px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          {error && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2">
            {editingRegion && (
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
              {editingRegion ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{saving ? 'Menyimpan...' : editingRegion ? 'Simpan Perubahan' : 'Tambah Wilayah'}</span>
            </button>
          </div>
        </form>

        {/* List Regions */}
        <div className="mt-4 space-y-2">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Daftar Wilayah Terdaftar ({regions.length})
          </p>

          {regions.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              Belum ada wilayah terdaftar. Tambahkan wilayah operasional di atas.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              {regions.map((reg) => {
                const devCount = devices.filter((d) => d.region === reg.name).length;
                const visitCount = visits.filter((v) => v.region === reg.name).length;
                const isConfirming = confirmDeleteId === reg.id;

                return (
                  <div key={reg.id} className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono font-bold text-[10px] text-slate-700 dark:text-slate-300">
                          {reg.code || 'REG'}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white truncate">{reg.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {devCount} perangkat · {visitCount} visit
                        {reg.picName ? ` · PIC: ${reg.picName}` : ''}
                        {reg.description ? ` · ${reg.description}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(reg)}
                        className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                        title="Edit Wilayah"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(reg.id)}
                            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold text-[11px]"
                          >
                            Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[34px] px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px]"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(reg.id)}
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Hapus Wilayah"
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
