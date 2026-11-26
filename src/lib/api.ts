import type { TicketAttachment } from '../types';

const AUTH_TOKEN_KEY = 'nusantara_auth_token';
const AUTH_EXPIRES_KEY = 'nusantara_auth_expires';
let memoryAuthToken: string | null = null;
let memoryExpiresAt: number | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function decodeJwtExpMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '==='.slice((base64.length + 3) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null, expiresAt?: number | null): void {
  memoryAuthToken = token;
  const resolvedExpires = token ? (expiresAt ?? decodeJwtExpMs(token)) : null;
  memoryExpiresAt = resolvedExpires;
  try {
    if (token) {
      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      if (resolvedExpires) {
        sessionStorage.setItem(AUTH_EXPIRES_KEY, String(resolvedExpires));
      } else {
        sessionStorage.removeItem(AUTH_EXPIRES_KEY);
      }
    } else {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      sessionStorage.removeItem(AUTH_EXPIRES_KEY);
    }
  } catch {
    // Ignore storage access errors in restricted sandboxes
  }
}

export function getAuthToken(): string | null {
  if (memoryAuthToken) return memoryAuthToken;
  try {
    const stored = sessionStorage.getItem(AUTH_TOKEN_KEY);
    if (stored) {
      memoryAuthToken = stored;
      return stored;
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

export function getSessionExpiresAt(): number | null {
  if (memoryExpiresAt) return memoryExpiresAt;
  try {
    const raw = sessionStorage.getItem(AUTH_EXPIRES_KEY);
    if (raw) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        memoryExpiresAt = parsed;
        return parsed;
      }
    }
  } catch {
    // Ignore storage access errors
  }
  const token = getAuthToken();
  if (token) {
    const decoded = decodeJwtExpMs(token);
    if (decoded) {
      memoryExpiresAt = decoded;
      return decoded;
    }
  }
  return null;
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && url !== '/api/auth/login') {
      setAuthToken(null);
      if (url !== '/api/auth/session') {
        unauthorizedHandler?.();
      }
    }
    throw new Error(data.error || `Request gagal (${res.status})`);
  }
  return data as T;
}

export async function compressAndUploadImage(file: File, maxDimension = 1280): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('File gambar tidak valid'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });

  const resp = await apiFetch<{ url: string }>('/api/uploads', {
    method: 'POST',
    body: JSON.stringify({ dataUrl, fileName: file.name }),
  });
  return resp.url;
}

export async function uploadAttachmentFile(file: File): Promise<TicketAttachment> {
  if (file.type.startsWith('image/')) {
    const url = await compressAndUploadImage(file, 1280);
    return {
      url,
      name: file.name,
      mimeType: 'image/jpeg',
      size: file.size,
    };
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran lampiran maksimal 5MB.');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file lampiran'));
    reader.readAsDataURL(file);
  });

  const resp = await apiFetch<{ url: string; name?: string; mimeType?: string; size?: number }>('/api/uploads', {
    method: 'POST',
    body: JSON.stringify({ dataUrl, fileName: file.name }),
  });

  return {
    url: resp.url,
    name: resp.name || file.name,
    mimeType: resp.mimeType || file.type || 'application/octet-stream',
    size: resp.size || file.size,
  };
}

export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return 'Belum pernah dicek';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return iso;
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return `${Math.max(1, diffSec)} dtk lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} jam lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function forceUpdatePwaApp(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (reg) => {
          await reg.update().catch(() => {});
          await reg.unregister().catch(() => {});
        })
      );
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } finally {
    window.location.reload();
  }
}
