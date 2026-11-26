import React, { useState } from 'react';
import { Building2, Mail, Lock, User, MapPin, Phone, ShieldCheck, ArrowRight, RefreshCw, CheckCircle2, KeyRound } from 'lucide-react';
import { apiFetch, forceUpdatePwaApp, setAuthToken } from '../lib/api';
import { UserProfile } from '../types';

interface AuthGateProps {
  hasUsers: boolean;
  smtpConfigured: boolean;
  notice?: string;
  onAuthenticated: (user: UserProfile, expiresAt?: number | null) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  hasUsers,
  smtpConfigured,
  notice,
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<'setup' | 'login' | 'register' | 'verify' | 'forgot'>(
    hasUsers ? 'login' : 'setup'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [previewOtp, setPreviewOtp] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [branch, setBranch] = useState(hasUsers ? '' : 'Pusat Jakarta');
  const [position, setPosition] = useState(hasUsers ? '' : 'Super Admin Pusat');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // Forgot / Reset Password fields
  const [forgotStep, setForgotStep] = useState<'request' | 'confirm'>('request');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ user: UserProfile; token?: string; expiresAt?: number }>('/api/auth/setup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, branch, position, phone }),
      });
      if (res.token) setAuthToken(res.token, res.expiresAt);
      onAuthenticated(res.user, res.expiresAt ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat akun admin');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await apiFetch<{ user: UserProfile; token?: string; expiresAt?: number }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res.token) setAuthToken(res.token, res.expiresAt);
      onAuthenticated(res.user, res.expiresAt ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login gagal';
      setError(msg);
      if (msg.toLowerCase().includes('verifikasi')) {
        setMode('verify');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setPreviewOtp('');
    setLoading(true);
    try {
      const res = await apiFetch<{
        user: UserProfile;
        emailSent: boolean;
        previewOtp?: string;
        message: string;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, branch, position, phone, role: 'Staff' }),
      });
      setInfo(res.message);
      if (res.previewOtp) setPreviewOtp(res.previewOtp);
      setMode('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pendaftaran gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ user: UserProfile; token?: string; expiresAt?: number; message: string }>(
        '/api/auth/verify-email',
        {
          method: 'POST',
          body: JSON.stringify({ email, code: otpCode, autoSignIn: true }),
        }
      );
      if (res.token) setAuthToken(res.token, res.expiresAt);
      onAuthenticated(res.user, res.expiresAt ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kode verifikasi salah');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await apiFetch<{ message: string; previewOtp?: string }>('/api/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setInfo(res.message);
      if (res.previewOtp) setPreviewOtp(res.previewOtp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim ulang OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestResetOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setInfo('');
    setPreviewOtp('');
    setLoading(true);
    try {
      const res = await apiFetch<{
        emailSent: boolean;
        previewOtp?: string;
        message: string;
      }>('/api/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setInfo(res.message);
      if (res.previewOtp) setPreviewOtp(res.previewOtp);
      setForgotStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim OTP reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Password baru minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Konfirmasi password baru tidak cocok.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>('/api/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ email, code: resetOtp, newPassword }),
      });
      setResetOtp('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPassword('');
      setPreviewOtp('');
      setForgotStep('request');
      setInfo(res.message);
      setMode('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengganti password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">NusantaraOps</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Monitoring Infrastruktur, Tiket & Laporan Visit</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
          {notice && !info && mode === 'login' && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 font-medium">
              {notice}
            </div>
          )}

          {mode === 'setup' && (
            <>
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Aktivasi Workspace Pertama Kali</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Buat Akun Super Admin Baru</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Belum ada akun admin terdaftar. Buat akun Super Admin utama untuk mulai mengelola perangkat, tiket, dan laporan tim nasional.
              </p>

              <form onSubmit={handleSetup} className="mt-5 space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nama Super Admin"
                      className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@perusahaan.id"
                      className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Unit / Cabang</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">No. WhatsApp</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+62 812..."
                        className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Posisi / Jabatan</label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Contoh: SPV Infrastruktur / Manager IT"
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Password Baru (min. 6 karakter)</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password admin"
                      className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {error && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[46px] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl transition active:scale-[0.99]"
                >
                  <span>{loading ? 'Menyimpan...' : 'Aktifkan & Masuk Dashboard'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </>
          )}

          {mode === 'login' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Masuk ke NusantaraOps</h2>
                <button
                  type="button"
                  onClick={() => { setError(''); setInfo(''); setMode('register'); }}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Daftar Akun
                </button>
              </div>

              {info && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 font-medium">
                  {info}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@perusahaan.id"
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setInfo('');
                        setPreviewOtp('');
                        setForgotStep('request');
                        setMode('forgot');
                      }}
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Lupa / Ganti Password?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {error && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl transition active:scale-[0.99]"
                >
                  {loading ? 'Memeriksa...' : 'Masuk (Sesi JWT 30 Menit)'}
                </button>
              </form>
            </>
          )}

          {mode === 'forgot' && (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <KeyRound className="w-5 h-5" />
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ganti Password via Email</h2>
                </div>
                <button
                  type="button"
                  onClick={() => { setError(''); setInfo(''); setMode('login'); }}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Kembali
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Sistem akan mengirim kode OTP 6 digit ke email terdaftar Anda untuk verifikasi perubahan password.
              </p>

              {info && (
                <div className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200">
                  <p>{info}</p>
                  {previewOtp && !smtpConfigured && (
                    <p className="mt-1.5 font-mono font-bold text-sm">Kode OTP Server: {previewOtp}</p>
                  )}
                </div>
              )}

              {forgotStep === 'request' ? (
                <form onSubmit={handleRequestResetOtp} className="mt-4 space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Akun</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@perusahaan.id"
                      className="w-full px-3.5 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {error && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl transition"
                  >
                    {loading ? 'Mengirim OTP...' : 'Kirim Kode OTP ke Email'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleConfirmResetPassword} className="mt-4 space-y-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kode OTP 6 Digit</label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value)}
                      placeholder="000000"
                      className="w-full py-2.5 text-center tracking-[0.35em] text-lg font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Password Baru (min. 6 karakter)</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Masukkan password baru"
                      className="w-full px-3.5 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Ulangi Password Baru</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Ketik ulang password baru"
                      className="w-full px-3.5 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {error && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[46px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold rounded-xl transition"
                  >
                    {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
                  </button>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => handleRequestResetOtp()}
                      disabled={loading}
                      className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Kirim Ulang OTP</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForgotStep('request')}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      Ganti Email
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {mode === 'register' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Daftar Akun Tim</h2>
                <button
                  type="button"
                  onClick={() => { setError(''); setMode('login'); }}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Sudah punya akun
                </button>
              </div>

              <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Cabang / Unit</label>
                    <input
                      type="text"
                      required
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="Cabang Bandung"
                      className="w-full px-3.5 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">No. HP / WA</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+62..."
                      className="w-full px-3.5 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Posisi / Jabatan (Opsional)</label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Contoh: Staff IT Support / Teknisi Lapangan / SPV"
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Password (min. 6 karakter)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                {error && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl transition"
                >
                  {loading ? 'Mendaftarkan...' : 'Daftar & Verifikasi Email'}
                </button>
              </form>
            </>
          )}

          {mode === 'verify' && (
            <>
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                <Mail className="w-5 h-5" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Verifikasi Email OTP</h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Masukkan 6 digit kode verifikasi untuk <strong>{email}</strong>.
              </p>

              {info && (
                <div className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200">
                  <p>{info}</p>
                  {previewOtp && !smtpConfigured && (
                    <p className="mt-1.5 font-mono font-bold text-sm">Kode OTP Server: {previewOtp}</p>
                  )}
                </div>
              )}

              <form onSubmit={handleVerify} className="mt-4 space-y-4 text-xs">
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="000000"
                  className="w-full py-3 text-center tracking-[0.35em] text-xl font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                />

                {error && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[46px] flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{loading ? 'Memverifikasi...' : 'Verifikasi & Masuk'}</span>
                </button>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Kirim Ulang Kode</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    Kembali ke Login
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => { void forceUpdatePwaApp(); }}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Perbarui Cache & Muat Ulang Aplikasi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
