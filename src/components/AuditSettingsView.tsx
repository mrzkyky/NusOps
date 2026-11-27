import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Mail,
  RefreshCw,
  Clock,
  Terminal,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { AuditLogEntry, UserProfile } from '../types';
import { apiFetch, formatDateTime } from '../lib/api';

interface AuditSettingsViewProps {
  currentUser: UserProfile;
  smtpConfigured: boolean;
}

export const AuditSettingsView: React.FC<AuditSettingsViewProps> = ({ currentUser, smtpConfigured }) => {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [testEmail, setTestEmail] = useState(currentUser.email);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpResult, setSmtpResult] = useState<{ sent: boolean; message: string } | null>(null);

  const loadAuditLogs = async () => {
    if (currentUser.role !== 'Super Admin') return;
    setLoadingLogs(true);
    try {
      const res = await apiFetch<{ auditLogs: AuditLogEntry[] }>('/api/audit-logs');
      setAuditLogs(res.auditLogs);
    } catch {
      setAuditLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    void loadAuditLogs();
  }, [currentUser.role]);

  const handleTestSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail.trim()) return;
    setTestingSmtp(true);
    setSmtpResult(null);
    try {
      const res = await apiFetch<{ sent: boolean; message: string }>('/api/system/test-smtp', {
        method: 'POST',
        body: JSON.stringify({ email: testEmail.trim() }),
      });
      setSmtpResult(res);
    } catch (err) {
      setSmtpResult({
        sent: false,
        message: err instanceof Error ? err.message : 'Gagal melakukan tes SMTP',
      });
    } finally {
      setTestingSmtp(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8 space-y-6 max-w-6xl mx-auto min-w-0 overflow-x-hidden">
      <div>
        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Audit Log & Pengaturan Sistem
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Pantau riwayat aktivitas penting (ubah role, hapus data, tutup tiket) dan lakukan tes koneksi SMTP email.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* SMTP Test Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tes Koneksi SMTP</h3>
              <p className="text-[11px] text-slate-500">Status SMTP: {smtpConfigured ? 'Aktif (Nodemailer)' : 'Belum Dikonfigurasi'}</p>
            </div>
          </div>

          <form onSubmit={handleTestSmtp} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kirim Email Tes ke</label>
              <input
                type="email"
                required
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            {smtpResult && (
              <div
                className={`p-3 rounded-xl border text-xs ${
                  smtpResult.sent
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                }`}
              >
                <p className="font-semibold">{smtpResult.sent ? 'Berhasil Terkirim!' : 'Gagal Mengirim'}</p>
                <p className="mt-0.5">{smtpResult.message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={testingSmtp}
              className="w-full min-h-[42px] px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl flex items-center justify-center gap-1.5 transition"
            >
              <Mail className={`w-4 h-4 ${testingSmtp ? 'animate-bounce' : ''}`} />
              <span>{testingSmtp ? 'Mengirim Tes...' : 'Kirim Email Tes SMTP'}</span>
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
            <p>• Notifikasi real-time & email otomatis aktif untuk penugasan tugas & approval visit.</p>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Riwayat Audit Log Keamanan ({auditLogs.length})</h3>
            </div>
            <button
              onClick={loadAuditLogs}
              disabled={loadingLogs}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              <span>Muat Ulang</span>
            </button>
          </div>

          {currentUser.role !== 'Super Admin' ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              Audit log riwayat aktivitas sistem hanya dapat dilihat oleh akun ber-role <strong>Super Admin</strong>.
            </p>
          ) : auditLogs.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">Belum ada aktivitas audit tercatat.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[480px] overflow-y-auto text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white font-mono">{log.action}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{formatDateTime(log.createdAt)}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">{log.details}</p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Oleh: {log.userName} · IP: {log.ipAddress || 'Internal'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
