import React, { useState, useEffect } from 'react';
import {
  Mail,
  ShieldCheck,
  Camera,
  CheckCircle2,
  Plus,
  LogOut,
  Sun,
  Moon,
  RefreshCw,
  X,
  FileCode,
  Briefcase,
  Trash2,
  KeyRound,
  Clock,
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { apiFetch, compressAndUploadImage, forceUpdatePwaApp } from '../lib/api';
import { ROLE_OPTIONS, normalizeRoleLabel } from '../lib/permissions';

interface AccountViewProps {
  currentUser: UserProfile;
  users: UserProfile[];
  smtpConfigured: boolean;
  sessionExpiresAt?: number | null;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onUpdateCurrentUser: (updated: UserProfile) => void;
  onUserAdded: (user: UserProfile) => void;
  onUserUpdated: (user: UserProfile) => void;
  onUserDeleted: (id: string) => void;
  onLogout: () => void;
  onPasswordChanged?: (message: string) => void;
  onOpenMasterPrompt: () => void;
}

const POSITION_SUGGESTIONS = [
  'SPV Infrastruktur',
  'SPV Operasional',
  'Manager IT',
  'IT Lead',
  'Staff IT Support',
  'NOC Engineer',
  'Teknisi Lapangan',
];

export const AccountView: React.FC<AccountViewProps> = ({
  currentUser,
  users,
  smtpConfigured,
  sessionExpiresAt,
  darkMode,
  setDarkMode,
  onUpdateCurrentUser,
  onUserAdded,
  onUserUpdated,
  onUserDeleted,
  onLogout,
  onPasswordChanged,
  onOpenMasterPrompt,
}) => {
  const [name, setName] = useState(currentUser?.name || '');
  const [position, setPosition] = useState(currentUser?.position || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [branch, setBranch] = useState(currentUser?.branch || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState('');
  const [teamNotice, setTeamNotice] = useState('');
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);

  // Password Change via Email OTP state
  const [pwStep, setPwStep] = useState<'idle' | 'confirm'>('idle');
  const [pwOtp, setPwOtp] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwNotice, setPwNotice] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwPreviewOtp, setPwPreviewOtp] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Remaining JWT minutes ticker
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const remainingMinutes = sessionExpiresAt
    ? Math.max(0, Math.ceil((sessionExpiresAt - nowTs) / 60000))
    : null;

  // New account registration modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Staff');
  const [newPosition, setNewPosition] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');

  // OTP Verification modal
  const [verifyTargetEmail, setVerifyTargetEmail] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpNotice, setOtpNotice] = useState('');
  const [previewOtp, setPreviewOtp] = useState('');
  const [verifying, setVerifying] = useState(false);

  const initials = (currentUser?.name || 'User')
    .split(' ')
    .map((p) => p[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setProfileNotice('');
    try {
      const uploadedUrl = await compressAndUploadImage(file, 512);
      setAvatarUrl(uploadedUrl);
      const res = await apiFetch<{ user: UserProfile }>('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ avatarUrl: uploadedUrl }),
      });
      onUpdateCurrentUser(res.user);
      setProfileNotice('Foto profil berhasil diperbarui.');
    } catch (err) {
      setProfileNotice(err instanceof Error ? err.message : 'Gagal mengunggah foto profil');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileNotice('');
    try {
      const res = await apiFetch<{ user: UserProfile }>('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ name, position, phone, branch, avatarUrl }),
      });
      onUpdateCurrentUser(res.user);
      setProfileNotice('Profil & posisi tersimpan ke database.');
    } catch (err) {
      setProfileNotice(err instanceof Error ? err.message : 'Gagal menyimpan profil');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');
    setRegistering(true);
    try {
      const res = await apiFetch<{
        user: UserProfile;
        emailSent: boolean;
        previewOtp?: string;
        message: string;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
          position: newPosition,
          branch: newBranch,
          phone: newPhone,
        }),
      });
      onUserAdded(res.user);
      setShowAddModal(false);
      setVerifyTargetEmail(res.user.email);
      setOtpNotice(res.message);
      setPreviewOtp(res.previewOtp || '');
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewPosition('');
      setNewBranch('');
      setNewPhone('');
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Gagal mendaftarkan akun');
    } finally {
      setRegistering(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyTargetEmail) return;
    setVerifying(true);
    try {
      const res = await apiFetch<{ user: UserProfile; message: string }>('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email: verifyTargetEmail, code: otpInput, autoSignIn: false }),
      });
      onUserUpdated(res.user);
      setVerifyTargetEmail(null);
      setOtpInput('');
      setPreviewOtp('');
      setOtpNotice('');
    } catch (err) {
      setOtpNotice(err instanceof Error ? err.message : 'Verifikasi gagal');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async (email: string) => {
    setVerifyTargetEmail(email);
    const res = await apiFetch<{ message: string; previewOtp?: string }>('/api/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    setOtpNotice(res.message);
    setPreviewOtp(res.previewOtp || '');
  };

  const handleChangeRole = async (userId: string, role: UserRole) => {
    setTeamNotice('');
    try {
      const res = await apiFetch<{ user: UserProfile }>(`/api/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      onUserUpdated(res.user);
    } catch (err) {
      setTeamNotice(err instanceof Error ? err.message : 'Gagal mengubah role pengguna');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setTeamNotice('');
    try {
      await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
      onUserDeleted(userId);
      setConfirmDeleteUserId(null);
    } catch (err) {
      setTeamNotice(err instanceof Error ? err.message : 'Gagal menghapus pengguna');
      setConfirmDeleteUserId(null);
    }
  };

  const handleRequestPasswordOtp = async () => {
    setPwError('');
    setPwNotice('');
    setPwPreviewOtp('');
    setPwLoading(true);
    try {
      const res = await apiFetch<{
        emailSent: boolean;
        previewOtp?: string;
        message: string;
      }>('/api/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ email: currentUser.email }),
      });
      setPwNotice(res.message);
      if (res.previewOtp) setPwPreviewOtp(res.previewOtp);
      setPwStep('confirm');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Gagal mengirim kode OTP ganti password');
    } finally {
      setPwLoading(false);
    }
  };

  const handleConfirmPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (pwNew.length < 6) {
      setPwError('Password baru minimal 6 karakter.');
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError('Konfirmasi password baru tidak cocok.');
      return;
    }
    setPwLoading(true);
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>('/api/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ email: currentUser.email, code: pwOtp, newPassword: pwNew }),
      });
      setPwOtp('');
      setPwNew('');
      setPwConfirm('');
      setPwPreviewOtp('');
      setPwStep('idle');
      if (onPasswordChanged) {
        onPasswordChanged(res.message);
      } else {
        onLogout();
      }
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Gagal memperbarui password');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8 space-y-6 max-w-5xl mx-auto min-w-0 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Profil, Tim & Verifikasi Email
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ubah foto profil langsung dari galeri/kamera, atur akun tim, dan verifikasi OTP email.
          </p>
        </div>

        {/* Mobile Quick Utilities */}
        <div className="flex flex-wrap items-center gap-2 lg:hidden">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="min-h-[40px] px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold flex items-center gap-1.5"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            <span>{darkMode ? 'Mode Terang' : 'Mode Gelap'}</span>
          </button>
          <button
            onClick={onOpenMasterPrompt}
            className="min-h-[40px] px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold flex items-center gap-1.5"
          >
            <FileCode className="w-4 h-4 text-blue-500" />
            <span>Master Prompt</span>
          </button>
          <button
            onClick={onLogout}
            className="min-h-[40px] px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Profile Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-center space-y-4">
          <div className="relative inline-block mx-auto">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={currentUser.name}
                className="w-24 h-24 rounded-2xl object-cover border-2 border-slate-200 dark:border-slate-700 mx-auto"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-blue-600 text-white text-2xl font-bold flex items-center justify-center mx-auto">
                {initials}
              </div>
            )}

            <label
              title="Ubah Foto Profil"
              className="absolute -bottom-2 -right-2 min-h-[36px] min-w-[36px] flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md cursor-pointer transition"
            >
              <Camera className="w-4 h-4" />
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{currentUser.name}</h3>
            <p className="text-xs text-slate-500">{currentUser.email}</p>
            <p className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>{currentUser.position || 'Posisi belum diisi'}</span>
            </p>
            <p className="mt-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
              {normalizeRoleLabel(currentUser.role)} · {currentUser.branch}
            </p>
          </div>

          {uploadingAvatar && <p className="text-xs text-blue-500">Mengunggah foto profil...</p>}

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Role Akses:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{normalizeRoleLabel(currentUser.role)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Status Email:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Terverifikasi
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">SMTP Server:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {smtpConfigured ? 'Aktif (Nodemailer)' : 'Belum dikonfigurasi (.env)'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Sesi JWT (30 mnt):</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {remainingMinutes !== null ? `${remainingMinutes} mnt tersisa` : 'Aktif'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { void forceUpdatePwaApp(); }}
            className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Perbarui Cache Aplikasi</span>
          </button>
        </div>

        {/* Edit Profile + Team Directory */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Edit Profil Saya</h3>

            <form onSubmit={handleUpdateProfile} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Status / Posisi Jabatan</label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Contoh: SPV Infrastruktur, Staff IT..."
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <p className="text-[11px] text-slate-400 mb-1.5">Pilih cepat status posisi atau ketik manual di atas:</p>
                <div className="flex flex-wrap gap-1.5">
                  {POSITION_SUGGESTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPosition(item)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                        position === item
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">No. HP / WhatsApp</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Unit Cabang</label>
                  <input
                    type="text"
                    required
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {profileNotice && (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{profileNotice}</p>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="min-h-[44px] px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl transition"
                >
                  {savingProfile ? 'Menyimpan...' : 'Simpan Profil'}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password with Email OTP */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Keamanan & Ganti Password (OTP Email)</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Verifikasi OTP dikirim ke <strong>{currentUser.email}</strong>. Sesi JWT keluar otomatis setiap 30 menit atau setelah password diganti.
                </p>
              </div>

              {pwStep === 'idle' && (
                <button
                  type="button"
                  onClick={handleRequestPasswordOtp}
                  disabled={pwLoading}
                  className="min-h-[40px] px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold rounded-xl shrink-0 transition"
                >
                  {pwLoading ? 'Mengirim OTP...' : 'Kirim OTP Ganti Password'}
                </button>
              )}
            </div>

            {pwNotice && (
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200">
                <p>{pwNotice}</p>
                {pwPreviewOtp && !smtpConfigured && (
                  <p className="mt-1 font-mono font-bold text-sm">Kode OTP Server: {pwPreviewOtp}</p>
                )}
              </div>
            )}

            {pwError && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{pwError}</p>}

            {pwStep === 'confirm' && (
              <form onSubmit={handleConfirmPasswordChange} className="space-y-3 text-xs pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kode OTP (6 Digit)</label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={pwOtp}
                      onChange={(e) => setPwOtp(e.target.value)}
                      placeholder="000000"
                      className="w-full min-h-[42px] px-3 py-2 text-center tracking-widest font-mono font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Password Baru</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={pwNew}
                      onChange={(e) => setPwNew(e.target.value)}
                      placeholder="Min. 6 karakter"
                      className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Konfirmasi Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={pwConfirm}
                      onChange={(e) => setPwConfirm(e.target.value)}
                      placeholder="Ketik ulang"
                      className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleRequestPasswordOtp}
                    disabled={pwLoading}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Kirim Ulang OTP</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setPwStep('idle'); setPwError(''); setPwNotice(''); }}
                      className="min-h-[40px] px-3 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-semibold"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={pwLoading}
                      className="min-h-[40px] px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold rounded-xl transition"
                    >
                      {pwLoading ? 'Memperbarui...' : 'Konfirmasi & Ganti Password'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Role Permission Matrix */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Hak Akses Role Sistem</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {ROLE_OPTIONS.map((r) => (
                <div
                  key={r.value}
                  className={`p-3 rounded-xl border ${
                    currentUser.role === r.value
                      ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-400/60'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <p className="font-bold text-slate-900 dark:text-white">{r.label}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{r.summary}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Team Members */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Daftar Akun Tim ({users.length})</h3>
                <p className="text-xs text-slate-500">Pembuatan akun baru memerlukan verifikasi OTP email.</p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Akun</span>
              </button>
            </div>

            {teamNotice && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{teamNotice}</p>}

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((usr) => (
                <div key={usr.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    {usr.avatarUrl ? (
                      <img src={usr.avatarUrl} alt={usr.name} className="w-9 h-9 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 shrink-0">
                        {usr.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white truncate">
                        {usr.name}
                        {usr.position && (
                          <span className="ml-1.5 font-medium text-blue-600 dark:text-blue-400">
                            · {usr.position}
                          </span>
                        )}
                      </p>
                      <p className="text-slate-500 truncate">{usr.email} · {usr.branch}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {usr.isVerified ? (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Verified</span>
                    ) : (
                      <button
                        onClick={() => handleResendOtp(usr.email)}
                        className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[11px] font-semibold"
                      >
                        Verifikasi OTP
                      </button>
                    )}

                    {currentUser.role === 'Super Admin' ? (
                      <>
                        <select
                          value={usr.role}
                          onChange={(e) => handleChangeRole(usr.id, e.target.value as UserRole)}
                          className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold"
                        >
                          <option value="Super Admin">Super Admin</option>
                          <option value="Manager">Manager</option>
                          <option value="SPV">SPV</option>
                          <option value="IT Lead">IT Lead</option>
                          <option value="Staff">Staff</option>
                          {usr.role === 'Field Tech' && <option value="Field Tech">Field Tech (Legacy)</option>}
                          {usr.role === 'Regional Manager' && <option value="Regional Manager">Regional Manager (Legacy)</option>}
                        </select>
                        {usr.id !== currentUser.id && (
                          <button
                            onClick={() => setConfirmDeleteUserId(usr.id)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                            title="Hapus Akun"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {normalizeRoleLabel(usr.role)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90dvh] overflow-y-auto">
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Daftarkan Akun Tim Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap</label>
                <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Password Awal (min. 6 karakter)</label>
                <input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Role Akses</label>
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)} className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <option value="Staff">Staff</option>
                    <option value="IT Lead">IT Lead</option>
                    {currentUser.role === 'Super Admin' && (
                      <>
                        <option value="SPV">SPV</option>
                        <option value="Manager">Manager</option>
                        <option value="Super Admin">Super Admin</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Cabang</label>
                  <input type="text" required value={newBranch} onChange={(e) => setNewBranch(e.target.value)} placeholder="Cabang Medan" className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Posisi / Jabatan</label>
                  <input type="text" value={newPosition} onChange={(e) => setNewPosition(e.target.value)} placeholder="SPV / Staff IT" className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">No. HP / WA</label>
                  <input type="text" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="w-full min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl" />
                </div>
              </div>

              {registerError && <p className="text-xs font-medium text-rose-600">{registerError}</p>}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowAddModal(false)} className="min-h-[44px] px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 rounded-xl">Batal</button>
                <button type="submit" disabled={registering} className="min-h-[44px] px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl">
                  {registering ? 'Memproses...' : 'Buat & Kirim OTP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Hapus Akun Pengguna?</h3>
            <p className="text-xs text-slate-500">Akun ini akan dihapus permanen dan tidak bisa masuk kembali.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteUserId(null)} className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
                Batal
              </button>
              <button onClick={() => handleDeleteUser(confirmDeleteUserId)} className="min-h-[40px] px-4 py-2 rounded-xl bg-rose-600 text-xs font-semibold text-white">
                Hapus Akun
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Verification Modal */}
      {verifyTargetEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Mail className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Verifikasi Email OTP</h3>
              </div>
              <button onClick={() => setVerifyTargetEmail(null)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">Akun: <strong className="text-slate-800 dark:text-slate-200">{verifyTargetEmail}</strong></p>

            {otpNotice && (
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200">
                <p>{otpNotice}</p>
                {previewOtp && !smtpConfigured && (
                  <p className="mt-1 font-mono font-bold text-sm">Kode OTP Server: {previewOtp}</p>
                )}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <input
                type="text"
                maxLength={6}
                required
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                placeholder="000000"
                className="w-full py-3 text-center tracking-[0.35em] text-xl font-mono font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
              <button
                type="submit"
                disabled={verifying}
                className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl"
              >
                {verifying ? 'Memverifikasi...' : 'Verifikasi & Aktifkan'}
              </button>
              <button
                type="button"
                onClick={() => handleResendOtp(verifyTargetEmail)}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 py-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Kirim Ulang Kode</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
