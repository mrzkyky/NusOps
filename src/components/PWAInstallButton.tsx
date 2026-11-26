import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X, ExternalLink, CheckCircle2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && window.__deferredPWAPrompt) {
      return window.__deferredPWAPrompt as BeforeInstallPromptEvent;
    }
    return null;
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      window.__deferredPWAPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.__deferredPWAPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) {
      setShowGuideModal(true);
      return;
    }
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.__deferredPWAPrompt = null;
    }
  };

  if (isInstalled) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-400 bg-emerald-950/50 rounded-xl border border-emerald-800/60">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>Aplikasi Terinstall</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={install}
        className={
          compact
            ? 'flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 sm:px-3 py-1.5 min-h-[36px] text-xs font-semibold text-white hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0'
            : 'w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors whitespace-nowrap'
        }
      >
        {isIOS ? <Smartphone className="w-4 h-4 shrink-0" /> : <Download className="w-4 h-4 shrink-0" />}
        {compact ? (
          <>
            <span className="sm:hidden">Install</span>
            <span className="hidden sm:inline">{deferredPrompt ? 'Install Aplikasi HP' : isIOS ? 'Install di iOS' : 'Install Aplikasi'}</span>
          </>
        ) : (
          <span>{deferredPrompt ? 'Install Aplikasi HP' : isIOS ? 'Install di iOS' : 'Install Aplikasi'}</span>
        )}
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-left">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isIOS ? 'Cara Install di iPhone / iPad' : 'Cara Install Aplikasi di HP / Desktop'}
              </h3>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {isInIframe && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
                  Anda sedang membuka halaman di dalam frame preview. Browser memblokir instalasi PWA dari dalam iframe—buka URL aplikasi di tab browser baru terlebih dahulu.
                </div>
              )}

              {isIOS ? (
                <ol className="list-decimal pl-4 space-y-1.5">
                  <li>Buka aplikasi ini langsung di <strong>Safari</strong> (bukan di dalam preview atau browser lain).</li>
                  <li>Ketuk tombol <strong>Share</strong> (ikon kotak panah ke atas) di toolbar bawah.</li>
                  <li>Pilih <strong>Add to Home Screen</strong> (Tambahkan ke Layar Utama), lalu ketuk <strong>Add</strong>.</li>
                </ol>
              ) : (
                <ol className="list-decimal pl-4 space-y-1.5">
                  <li>Pastikan aplikasi dibuka langsung di tab <strong>Google Chrome / Edge</strong> (bukan di dalam iframe preview).</li>
                  <li>Jika sebelumnya sempat tersimpan sebagai pintasan biasa, hapus pintasan lama di layar utama HP lalu muat ulang halaman ini.</li>
                  <li>Ketuk menu browser (titik tiga di kanan atas) lalu pilih <strong>Install App</strong> / <strong>Tambahkan ke layar utama</strong> → <strong>Install</strong>.</li>
                </ol>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              {isInIframe && (
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka di Tab Baru</span>
                </a>
              )}
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
