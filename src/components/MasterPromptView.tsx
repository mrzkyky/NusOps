import React, { useState } from 'react';
import { FileCode, Copy, Check, Terminal, Layers, ShieldCheck, Cpu, Smartphone } from 'lucide-react';

export const MasterPromptView: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const masterPromptText = `[MASTER PROMPT: NUSANTARAOPS ENTERPRISE (SAMBA-V)]
Role & Objective: Build a robust, lightweight, high-performance national infrastructure monitoring, ticketing, and field visit management dashboard (combining SAMBA, ticketing system, and daily report visit logging like AC maintenance, server rack checks, and device telemetry) with full Progressive Web App (PWA) installability on mobile phones.

Key Functional Requirements:
1. National Infrastructure & Device Monitoring: Real-time status (Online, Warning, Offline), CPU, RAM, Disk, Temperature metrics for servers, core routers, switches, UPS power, and AC cooling units across Indonesian regional branches (Jabodetabek, Jawa Barat, Jawa Timur, Sumatera, Sulawesi, Bali).
2. Incident & Request Ticketing System: Priority levels (Critical, High, Medium, Low), status tracking (Open, In Progress, Resolved), assignee management, and interactive comment logs.
3. Field Visit & Daily Report Management: Centralized visit logs for central teams visiting branch units (e.g., "Cuci AC & Cek Filter", "Server Rack Clean & Thermal Check", UPS load tests), photographic documentation, findings, recommendations, and realization cost tracking.
4. Account Management & Email Verification: User profile editing, avatar update, and secure account creation workflow with simulated 6-digit email OTP verification.
5. PWA Installability & Mobile Optimization: Fully installable as a native-like PWA on Android & iOS mobile phones using VitePWA with offline indicators and touch-optimized responsive navigation.
6. Design Aesthetics: Clean professional SaaS design with custom Light/Dark mode support, zero-pill metadata discipline, tabular numerals for telemetry data, and intuitive single-row top bar contract.
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(masterPromptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8 space-y-6 max-w-5xl mx-auto min-w-0 overflow-x-hidden">
      <div>
        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Master Prompt & Tech Stack Architecture</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Dokumentasi arsitektur full-stack dan Master Prompt untuk NusantaraOps.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Terminal className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">Full-Stack Runtime</h4>
          <p className="text-xs text-slate-500 leading-relaxed">React 19, TypeScript, Tailwind CSS v4, Express API, SQLite (better-sqlite3), dan Nodemailer SMTP.</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">PWA Mobile Support</h4>
          <p className="text-xs text-slate-500 leading-relaxed">Dikonfigurasi menggunakan `vite-plugin-pwa` untuk instalasi instan di Android & iOS home screen beserta offline caching.</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">Enterprise Features</h4>
          <p className="text-xs text-slate-500 leading-relaxed">Manajemen perangkat nasional, sistem tiket insiden real-time, laporan visit unit & cuci AC, serta verifikasi email OTP akun.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <FileCode className="w-4 h-4 text-blue-500" />
            <span>Master Prompt Resmi NusantaraOps SAMBA-V</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Tersalin!' : 'Salin Master Prompt'}</span>
          </button>
        </div>

        <div className="p-4 sm:p-6 bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed overflow-x-auto">
          <pre className="whitespace-pre-wrap break-words">{masterPromptText}</pre>
        </div>
      </div>
    </div>
  );
};
