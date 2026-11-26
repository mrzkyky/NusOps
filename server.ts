import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import dns from 'node:dns/promises';
import http from 'node:http';
import os from 'node:os';
import nodemailer from 'nodemailer';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(process.cwd(), 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'nusantaraops.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    position TEXT NOT NULL DEFAULT '',
    branch TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    is_verified INTEGER NOT NULL DEFAULT 0,
    verification_code TEXT,
    verification_expires_at INTEGER,
    reset_code TEXT,
    reset_expires_at INTEGER,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    region TEXT NOT NULL,
    branch_unit TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 80,
    probe_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'online',
    cpu_usage REAL NOT NULL DEFAULT 0,
    memory_usage REAL NOT NULL DEFAULT 0,
    disk_usage REAL NOT NULL DEFAULT 0,
    temperature REAL NOT NULL DEFAULT 0,
    latency_ms INTEGER,
    last_ping_at TEXT,
    uptime_pct REAL NOT NULL DEFAULT 100,
    notes TEXT NOT NULL DEFAULT '',
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS device_logs (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    status TEXT NOT NULL,
    latency_ms INTEGER,
    message TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    branch_unit TEXT NOT NULL,
    device_id TEXT NOT NULL DEFAULT '',
    reported_by_id TEXT NOT NULL,
    reported_by_name TEXT NOT NULL,
    assigned_to_id TEXT NOT NULL DEFAULT '',
    assigned_to_name TEXT NOT NULL DEFAULT 'Belum Ditugaskan',
    description TEXT NOT NULL,
    photo_url TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ticket_comments (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_avatar TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    attachments_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    branch_unit TEXT NOT NULL,
    region TEXT NOT NULL,
    visit_date TEXT NOT NULL,
    team_lead_id TEXT NOT NULL,
    team_lead_name TEXT NOT NULL,
    members_json TEXT NOT NULL DEFAULT '[]',
    category TEXT NOT NULL,
    checklist_json TEXT NOT NULL DEFAULT '[]',
    summary TEXT NOT NULL,
    findings TEXT NOT NULL,
    recommendations TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Submitted',
    reviewer_note TEXT NOT NULL DEFAULT '',
    photos_json TEXT NOT NULL DEFAULT '[]',
    cost_rp INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    ticket_id TEXT NOT NULL DEFAULT '',
    ticket_code TEXT NOT NULL DEFAULT '',
    assigned_by_name TEXT NOT NULL DEFAULT '',
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS regions (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    code TEXT NOT NULL DEFAULT '',
    pic_name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const regionsInitialized = db
  .prepare("SELECT value FROM app_settings WHERE key = 'regions_initialized'")
  .get() as { value: string } | undefined;

if (!regionsInitialized) {
  const existingRegionCount = (db.prepare('SELECT COUNT(*) as cnt FROM regions').get() as { cnt: number }).cnt;
  if (existingRegionCount === 0) {
    const starterRegions = [
      { code: 'JKT', name: 'Jabodetabek', description: 'Kantor Pusat & Cabang Jabodetabek' },
      { code: 'JBR', name: 'Jawa Barat', description: 'Area Bandung, Bekasi Timur, Cirebon' },
      { code: 'JTG', name: 'Jawa Tengah', description: 'Area Semarang, Solo, Tegal, Brebes' },
      { code: 'JTM', name: 'Jawa Timur', description: 'Area Surabaya, Malang, Sidoarjo' },
      { code: 'SUM', name: 'Sumatera Utara', description: 'Area Medan & Sumatera Bagian Utara' },
      { code: 'SUL', name: 'Sulawesi Selatan', description: 'Area Makassar & Indonesia Timur' },
      { code: 'BLI', name: 'Bali Nusra', description: 'Area Denpasar & Nusa Tenggara' },
      { code: 'KLM', name: 'Kalimantan', description: 'Area Balikpapan, Samarinda, Banjarmasin' },
    ];
    const nowInit = new Date().toISOString();
    const insertRegion = db.prepare(
      'INSERT OR IGNORE INTO regions (id, name, code, pic_name, description, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const r of starterRegions) {
      insertRegion.run(`reg-${crypto.randomUUID()}`, r.name, r.code, '', r.description, nowInit);
    }
  }
  db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('regions_initialized', '1')").run();
}

// Safe migration for existing databases
const userColumns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
if (!userColumns.some((col) => col.name === 'position')) {
  db.exec("ALTER TABLE users ADD COLUMN position TEXT NOT NULL DEFAULT ''");
}
if (!userColumns.some((col) => col.name === 'reset_code')) {
  db.exec('ALTER TABLE users ADD COLUMN reset_code TEXT');
}
if (!userColumns.some((col) => col.name === 'reset_expires_at')) {
  db.exec('ALTER TABLE users ADD COLUMN reset_expires_at INTEGER');
}
const commentColumns = db.prepare('PRAGMA table_info(ticket_comments)').all() as { name: string }[];
if (!commentColumns.some((col) => col.name === 'attachments_json')) {
  db.exec("ALTER TABLE ticket_comments ADD COLUMN attachments_json TEXT NOT NULL DEFAULT '[]'");
}

// Security & Crypto Helpers
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

const SESSION_COOKIE = 'nusantara_session';
const SESSION_TTL_SECONDS = 30 * 60; // 30 menit
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

function getJwtSecret(): string {
  if (process.env.SESSION_SECRET?.trim()) {
    return process.env.SESSION_SECRET.trim();
  }
  const secretPath = path.join(DATA_DIR, '.jwt_secret');
  if (fs.existsSync(secretPath)) {
    const existing = fs.readFileSync(secretPath, 'utf8').trim();
    if (existing) return existing;
  }
  const generated = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(secretPath, generated, { mode: 0o600 });
  return generated;
}

const JWT_SECRET = getJwtSecret();

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

interface JwtPayload {
  sub: string;
  role: string;
  jti: string;
  iat: number;
  exp: number;
}

function signJwtToken(userId: string, role: string): { token: string; jti: string; expiresAt: number } {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + SESSION_TTL_SECONDS;
  const jti = crypto.randomUUID();
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({ sub: userId, role, jti, iat, exp }));
  const signingInput = `${header}.${payload}`;
  const sig = base64UrlEncode(crypto.createHmac('sha256', JWT_SECRET).update(signingInput).digest());
  return {
    token: `${signingInput}.${sig}`,
    jti,
    expiresAt: exp * 1000,
  };
}

function verifyJwtToken(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  try {
    const expectedSig = base64UrlEncode(
      crypto.createHmac('sha256', JWT_SECRET).update(`${headerB64}.${payloadB64}`).digest()
    );
    const sigBuf = Buffer.from(sigB64);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const header = JSON.parse(base64UrlDecode(headerB64).toString('utf8')) as { alg?: string; typ?: string };
    if (header.alg !== 'HS256') return null;

    const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8')) as JwtPayload;
    if (!payload.sub || !payload.jti || !payload.exp) return null;
    if (payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function issueJwtSession(res: Response, req: Request, userId: string, role: string): { token: string; expiresAt: number } {
  // Clean up stale expired sessions for tidy database
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  const { token, jti, expiresAt } = signJwtToken(userId, role);
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    hashToken(jti),
    userId,
    expiresAt
  );
  setSessionCookie(res, token, req);
  return { token, expiresAt };
}

function setSessionCookie(res: Response, token: string, req: Request) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '');
  const isHttps = req.secure || forwardedProto.split(',')[0].trim() === 'https';
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (isHttps) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res: Response, req: Request) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '');
  const isHttps = req.secure || forwardedProto.split(',')[0].trim() === 'https';
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'Max-Age=0'];
  if (isHttps) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

// SMTP Email Helper
function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendOtpEmail(
  to: string,
  name: string,
  code: string,
  purpose: 'verify' | 'reset'
): Promise<{ sent: boolean; error?: string }> {
  if (!isSmtpConfigured()) {
    return { sent: false };
  }
  const isReset = purpose === 'reset';
  const subject = isReset
    ? `[NusantaraOps] Kode OTP Ganti Password: ${code}`
    : `[NusantaraOps] Kode Verifikasi Akun Anda: ${code}`;
  const title = isReset ? 'Permintaan Ganti Password' : 'Verifikasi Email NusantaraOps';
  const bodyCopy = isReset
    ? 'Gunakan kode OTP berikut untuk mengganti password akun NusantaraOps Anda (berlaku 15 menit):'
    : 'Gunakan kode OTP berikut untuk mengaktifkan akun Anda (berlaku 15 menit):';
  const footerNote = isReset
    ? 'Jika Anda tidak meminta perubahan password, segera amankan akun Anda dan abaikan email ini.'
    : 'Jika Anda tidak merasa mendaftar, abaikan email ini.';

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="margin: 0 0 8px; color: #0f172a;">${title}</h2>
          <p style="color: #475569; font-size: 14px;">Halo <strong>${name.replace(/[<>&"']/g, '')}</strong>,</p>
          <p style="color: #475569; font-size: 14px;">${bodyCopy}</p>
          <div style="font-size: 28px; font-weight: 700; letter-spacing: 6px; text-align: center; padding: 16px; background: #f1f5f9; border-radius: 8px; color: #1d4ed8; margin: 20px 0;">
            ${code}
          </div>
          <p style="color: #94a3b8; font-size: 12px;">${footerNote}</p>
        </div>
      `,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'SMTP error' };
  }
}

async function sendVerificationEmail(to: string, name: string, code: string): Promise<{ sent: boolean; error?: string }> {
  return sendOtpEmail(to, name, code, 'verify');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendTaskAssignmentEmail(params: {
  to: string;
  assigneeName: string;
  assignerName: string;
  assignerRole: string;
  isReassign?: boolean;
  ticket: {
    code: string;
    title: string;
    category: string;
    priority: string;
    branchUnit: string;
    description: string;
  };
}): Promise<{ sent: boolean; error?: string }> {
  if (!isSmtpConfigured()) {
    return { sent: false };
  }

  const actionLabel = params.isReassign ? 'Penugasan Ulang Tiket' : 'Penugasan Tugas Baru';
  const subject = `[NusantaraOps] ${actionLabel}: ${params.ticket.code} - ${params.ticket.title}`;
  const appUrl = (process.env.APP_URL || '').trim();
  const safeUrl = /^https?:\/\//i.test(appUrl) ? appUrl : '';

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: params.to,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 14px; background: #ffffff;">
          <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.04em;">NusantaraOps Enterprise</p>
          <h2 style="margin: 0 0 12px; color: #0f172a; font-size: 18px;">${actionLabel}: ${escapeHtml(params.ticket.code)}</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.5;">
            Halo <strong>${escapeHtml(params.assigneeName)}</strong>, Anda baru saja ditugaskan oleh <strong>${escapeHtml(params.assignerName)}</strong> (${escapeHtml(params.assignerRole)}).
          </p>
          <div style="margin: 16px 0; padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 13px; color: #334155;">
            <p style="margin: 0 0 6px;"><strong>Judul:</strong> ${escapeHtml(params.ticket.title)}</p>
            <p style="margin: 0 0 6px;"><strong>Prioritas:</strong> ${escapeHtml(params.ticket.priority)} &middot; <strong>Kategori:</strong> ${escapeHtml(params.ticket.category)}</p>
            <p style="margin: 0 0 6px;"><strong>Cabang / Unit:</strong> ${escapeHtml(params.ticket.branchUnit)}</p>
            <p style="margin: 8px 0 0; color: #475569;"><strong>Deskripsi:</strong><br/>${escapeHtml(params.ticket.description).replace(/\n/g, '<br/>')}</p>
          </div>
          ${
            safeUrl
              ? `<p style="margin: 18px 0 0;"><a href="${escapeHtml(safeUrl)}" style="display: inline-block; padding: 10px 18px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 13px;">Buka NusantaraOps</a></p>`
              : ''
          }
          <p style="color: #94a3b8; font-size: 11px; margin-top: 18px;">Notifikasi otomatis dari sistem tiketing & operasional NusantaraOps.</p>
        </div>
      `,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SMTP error';
    console.warn('[TaskEmail] Gagal mengirim email penugasan:', message);
    return { sent: false, error: message };
  }
}

// SSRF Protection for Network Probes
function isBlockedAddress(ip: string): boolean {
  if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) {
    return true;
  }
  const v4Match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!v4Match) return false;
  const [a, b] = [Number(v4Match[1]), Number(v4Match[2])];
  if (a === 0 || a === 127) return true; // 0.0.0.0/8, 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 metadata / link-local
  return false;
}

interface ProbeMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  temperature?: number;
  status?: 'online' | 'warning' | 'offline';
}

interface ProbeResult {
  reachable: boolean;
  latencyMs: number | null;
  message: string;
  metrics?: ProbeMetrics;
}

async function probeTarget(hostOrIp: string, port: number, probeUrl: string): Promise<ProbeResult> {
  const start = Date.now();
  try {
    let targetHost = hostOrIp.trim();
    let targetPort = port || 80;

    if (probeUrl.trim()) {
      const parsed = new URL(probeUrl.trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { reachable: false, latencyMs: null, message: 'Protokol URL harus http atau https.' };
      }
      targetHost = parsed.hostname;
      targetPort = parsed.port ? Number(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80);
    }

    if (!targetHost || targetHost.toLowerCase() === 'localhost') {
      return { reachable: false, latencyMs: null, message: 'Alamat localhost diblokir untuk keamanan server.' };
    }

    if (net.isIP(targetHost)) {
      if (isBlockedAddress(targetHost)) {
        return { reachable: false, latencyMs: null, message: 'Alamat loopback/metadata diblokir oleh kebijakan keamanan.' };
      }
    } else {
      const resolved = await dns.lookup(targetHost);
      if (isBlockedAddress(resolved.address)) {
        return { reachable: false, latencyMs: null, message: 'Hasil DNS mengarah ke alamat internal terlarang.' };
      }
    }

    // If probeUrl is set, run HTTP GET fetch and parse optional JSON telemetry
    if (probeUrl.trim()) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      try {
        const resp = await fetch(probeUrl.trim(), { method: 'GET', signal: controller.signal, redirect: 'manual' });
        clearTimeout(timeout);
        const latencyMs = Date.now() - start;
        const contentType = (resp.headers.get('content-type') || '').toLowerCase();
        let metrics: ProbeMetrics | undefined;

        if (contentType.includes('application/json')) {
          try {
            const rawText = await resp.text();
            if (rawText.length <= 32768) {
              const json = JSON.parse(rawText) as Record<string, unknown>;
              const pickNum = (...keys: string[]) => {
                for (const k of keys) {
                  const val = Number(json[k]);
                  if (Number.isFinite(val)) return Math.round(val * 10) / 10;
                }
                return undefined;
              };
              const cpuUsage = pickNum('cpuUsage', 'cpu', 'cpu_usage');
              const memoryUsage = pickNum('memoryUsage', 'ramUsage', 'ram', 'memory', 'memory_usage');
              const diskUsage = pickNum('diskUsage', 'disk', 'disk_usage');
              const temperature = pickNum('temperature', 'temp');
              const rawStatus = typeof json.status === 'string' ? json.status.toLowerCase() : '';
              const parsedStatus =
                rawStatus === 'warning' || rawStatus === 'degraded'
                  ? 'warning'
                  : rawStatus === 'offline' || rawStatus === 'error' || rawStatus === 'down'
                  ? 'offline'
                  : rawStatus === 'online' || rawStatus === 'ok' || rawStatus === 'healthy'
                  ? 'online'
                  : undefined;

              if (
                cpuUsage !== undefined ||
                memoryUsage !== undefined ||
                diskUsage !== undefined ||
                temperature !== undefined ||
                parsedStatus !== undefined
              ) {
                metrics = {
                  ...(cpuUsage !== undefined ? { cpuUsage } : {}),
                  ...(memoryUsage !== undefined ? { memoryUsage } : {}),
                  ...(diskUsage !== undefined ? { diskUsage } : {}),
                  ...(temperature !== undefined ? { temperature } : {}),
                  ...(parsedStatus !== undefined ? { status: parsedStatus } : {}),
                };
              }
            }
          } catch {
            // Non-JSON or malformed JSON body still counts as HTTP reachability
          }
        }

        return {
          reachable: resp.status < 500 && metrics?.status !== 'offline',
          latencyMs,
          message: `HTTP ${resp.status} merespons dalam ${latencyMs} ms${metrics ? ' (+ metrik live)' : ''}`,
          metrics,
        };
      } catch (err) {
        clearTimeout(timeout);
        return {
          reachable: false,
          latencyMs: null,
          message: err instanceof Error ? `HTTP Probe gagal: ${err.message}` : 'HTTP Probe timeout',
        };
      }
    }

    return await new Promise((resolve) => {
      const socket = new net.Socket();
      let settled = false;
      socket.setTimeout(3500);

      socket.on('connect', () => {
        if (settled) return;
        settled = true;
        const latencyMs = Date.now() - start;
        socket.destroy();
        resolve({
          reachable: true,
          latencyMs,
          message: `TCP port ${targetPort} terbuka (${latencyMs} ms)`,
        });
      });

      socket.on('timeout', () => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve({
          reachable: false,
          latencyMs: null,
          message: `Timeout setelah 3500 ms ke ${targetHost}:${targetPort} (host tidak terjangkau dari server)`,
        });
      });

      socket.on('error', (err) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve({
          reachable: false,
          latencyMs: null,
          message: `Koneksi gagal: ${err.message}`,
        });
      });

      socket.connect(targetPort, targetHost);
    });
  } catch (err) {
    return {
      reachable: false,
      latencyMs: null,
      message: err instanceof Error ? err.message : 'Probe error',
    };
  }
}

interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: string;
  position: string;
  branch: string;
  phone: string;
  avatarUrl: string;
  isVerified: boolean;
  createdAt: string;
}

function toSafeUser(row: Record<string, unknown>): SafeUser {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: String(row.role),
    position: String(row.position || ''),
    branch: String(row.branch),
    phone: String(row.phone || ''),
    avatarUrl: String(row.avatar_url || ''),
    isVerified: Boolean(row.is_verified),
    createdAt: String(row.created_at),
  };
}

const ALLOWED_ROLES = [
  'Super Admin',
  'Manager',
  'SPV',
  'IT Lead',
  'Staff',
  'Field Tech',
  'Regional Manager',
];

function isTicketManagerRole(role: string): boolean {
  return role === 'Super Admin' || role === 'Manager' || role === 'SPV' || role === 'Regional Manager';
}

function isDeviceManagerRole(role: string): boolean {
  return (
    role === 'Super Admin' ||
    role === 'Manager' ||
    role === 'SPV' ||
    role === 'IT Lead' ||
    role === 'Regional Manager'
  );
}

function isVisitApproverRole(role: string): boolean {
  return role === 'Super Admin' || role === 'Manager' || role === 'SPV' || role === 'Regional Manager';
}

interface AuthRequest extends Request {
  user?: SafeUser;
}

function verifyRawSessionToken(rawToken?: string): { user: SafeUser; expiresAt: number } | null {
  if (!rawToken) return null;

  const jwtPayload = verifyJwtToken(rawToken);
  if (!jwtPayload) return null;

  const tokenHash = hashToken(jwtPayload.jti);
  const sessionRow = db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?')
    .get(tokenHash) as { user_id: string; expires_at: number } | undefined;

  if (!sessionRow) return null;
  if (sessionRow.expires_at <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(sessionRow.user_id) as Record<string, unknown> | undefined;
  if (!userRow) return null;
  return {
    user: toSafeUser(userRow),
    expiresAt: Math.min(sessionRow.expires_at, jwtPayload.exp * 1000),
  };
}

function getAuthenticatedSession(req: Request): { user: SafeUser; expiresAt: number } | null {
  const cookies = parseCookies(req.headers.cookie);
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7).trim()
    : '';
  const rawToken = cookies[SESSION_COOKIE] || bearer;
  return verifyRawSessionToken(rawToken);
}

function getAuthenticatedUser(req: Request): SafeUser | null {
  return getAuthenticatedSession(req)?.user || null;
}

// --- REAL-TIME WEBSOCKET HUB ---
const wsClientsByUser = new Map<string, Set<WebSocket>>();

function addWsClient(userId: string, ws: WebSocket) {
  let set = wsClientsByUser.get(userId);
  if (!set) {
    set = new Set<WebSocket>();
    wsClientsByUser.set(userId, set);
  }
  set.add(ws);
}

function removeWsClient(userId: string, ws: WebSocket) {
  const set = wsClientsByUser.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    wsClientsByUser.delete(userId);
  }
}

function sendWsToUser(userId: string, event: string, data: unknown) {
  const set = wsClientsByUser.get(userId);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify({ event, data });
  for (const client of set) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function broadcastWs(event: string, data: unknown) {
  const payload = JSON.stringify({ event, data });
  for (const set of wsClientsByUser.values()) {
    for (const client of set) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}

function mapNotification(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: String(row.type),
    title: String(row.title),
    message: String(row.message),
    ticketId: String(row.ticket_id || ''),
    ticketCode: String(row.ticket_code || ''),
    assignedByName: String(row.assigned_by_name || ''),
    isRead: Boolean(row.is_read),
    createdAt: String(row.created_at),
  };
}

function createAndPushNotification(params: {
  recipientId: string;
  type: 'task_assigned' | 'ticket_comment' | 'device_offline' | 'visit_submitted' | 'visit_reviewed';
  title: string;
  message: string;
  ticketId: string;
  ticketCode: string;
  assignedByName: string;
}) {
  const id = `ntf-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, ticket_id, ticket_code, assigned_by_name, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    id,
    params.recipientId,
    params.type,
    params.title,
    params.message,
    params.ticketId,
    params.ticketCode,
    params.assignedByName,
    now
  );

  const created = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as Record<string, unknown>;
  const mapped = mapNotification(created);
  sendWsToUser(params.recipientId, 'notification:created', { notification: mapped });
  return mapped;
}

function dispatchTaskAssignmentAlerts(params: {
  recipientId: string;
  assigner: SafeUser;
  ticket: ReturnType<typeof mapTicket>;
  isReassign?: boolean;
}) {
  const title = params.isReassign
    ? `Penugasan Ulang: ${params.ticket.code}`
    : `Tugas Baru: ${params.ticket.code}`;
  const message = `${params.assigner.name} (${params.assigner.position || params.assigner.role}) menugaskan "${params.ticket.title}" di ${params.ticket.branchUnit} (${params.ticket.priority}).`;

  createAndPushNotification({
    recipientId: params.recipientId,
    type: 'task_assigned',
    title,
    message,
    ticketId: params.ticket.id,
    ticketCode: params.ticket.code,
    assignedByName: params.assigner.name,
  });

  const recipient = db
    .prepare('SELECT email, name, is_verified FROM users WHERE id = ?')
    .get(params.recipientId) as { email: string; name: string; is_verified: number } | undefined;

  if (recipient && recipient.is_verified && recipient.email) {
    void sendTaskAssignmentEmail({
      to: recipient.email,
      assigneeName: recipient.name,
      assignerName: params.assigner.name,
      assignerRole: params.assigner.position || params.assigner.role,
      isReassign: params.isReassign,
      ticket: {
        code: params.ticket.code,
        title: params.ticket.title,
        category: params.ticket.category,
        priority: params.ticket.priority,
        branchUnit: params.ticket.branchUnit,
        description: params.ticket.description,
      },
    });
  }
}

function requireCsrfCheck(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const hasRequestedWith = req.headers['x-requested-with'] === 'XMLHttpRequest';
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const originMatches = origin && host ? new URL(origin).host === String(host).split(',')[0].trim() : false;
  if (!hasRequestedWith && !originMatches) {
    res.status(403).json({ error: 'CSRF check failed' });
    return;
  }
  next();
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Sesi tidak valid atau belum login.' });
    return;
  }
  if (!user.isVerified) {
    res.status(403).json({ error: 'Akun belum terverifikasi email.' });
    return;
  }
  req.user = user;
  next();
}

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  next();
}, express.static(UPLOAD_DIR));

app.use('/api', requireCsrfCheck);

// --- HEALTHCHECK & MONITORING ---
app.get('/api/health', (_req: Request, res: Response) => {
  try {
    db.prepare('SELECT 1').get();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      status: 'ok',
      service: 'nusantaraops',
      db: 'connected',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      service: 'nusantaraops',
      db: 'disconnected',
      error: err instanceof Error ? err.message : 'Database check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// --- AUTH ROUTES ---
app.get('/api/auth/session', (req: Request, res: Response) => {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  const authSession = getAuthenticatedSession(req);
  res.json({
    hasUsers: countRow.cnt > 0,
    currentUser: authSession?.user || null,
    expiresAt: authSession?.expiresAt || null,
    smtpConfigured: isSmtpConfigured(),
  });
});

app.post('/api/auth/setup', (req: Request, res: Response) => {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (countRow.cnt > 0) {
    res.status(409).json({ error: 'Akun admin awal sudah dibuat. Silakan login.' });
    return;
  }

  const { name, email, password, branch, phone, position } = req.body as Record<string, string>;
  if (!name?.trim() || !email?.trim() || !password || password.length < 6 || !branch?.trim()) {
    res.status(400).json({ error: 'Nama, email, cabang, dan password (minimal 6 karakter) wajib diisi.' });
    return;
  }

  const id = `usr-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, position, branch, phone, avatar_url, is_verified, created_at)
    VALUES (?, ?, ?, ?, 'Super Admin', ?, ?, ?, '', 1, ?)
  `).run(
    id,
    name.trim(),
    normalizedEmail,
    hashPassword(password),
    (position || 'Super Admin Pusat').trim(),
    branch.trim(),
    (phone || '').trim(),
    now
  );

  const { token, expiresAt } = issueJwtSession(res, req, id, 'Super Admin');

  const created = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json({ user: toSafeUser(created), token, expiresAt });
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { name, email, password, role, position, branch, phone } = req.body as Record<string, string>;
  if (!name?.trim() || !email?.trim() || !password || password.length < 6 || !branch?.trim()) {
    res.status(400).json({ error: 'Nama, email, cabang, dan password (minimal 6 karakter) wajib diisi.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: 'Email tersebut sudah terdaftar.' });
    return;
  }

  // Only an authenticated Super Admin can assign elevated roles directly; public self-signup defaults safely to Staff
  const caller = getAuthenticatedUser(req);
  let assignedRole = ALLOWED_ROLES.includes(role) ? role : 'Staff';
  if (!caller || caller.role !== 'Super Admin') {
    if (assignedRole === 'Super Admin' || assignedRole === 'Manager' || assignedRole === 'SPV' || assignedRole === 'Regional Manager') {
      assignedRole = 'Staff';
    }
  }

  const id = `usr-${crypto.randomUUID()}`;
  const otp = String(crypto.randomInt(100000, 999999));
  const expiresAt = Date.now() + 1000 * 60 * 15;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, position, branch, phone, avatar_url, is_verified, verification_code, verification_expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', 0, ?, ?, ?)
  `).run(
    id,
    name.trim(),
    normalizedEmail,
    hashPassword(password),
    assignedRole,
    (position || '').trim(),
    branch.trim(),
    (phone || '').trim(),
    otp,
    expiresAt,
    now
  );

  const mailResult = await sendVerificationEmail(normalizedEmail, name.trim(), otp);
  const created = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;

  res.status(201).json({
    user: toSafeUser(created),
    emailSent: mailResult.sent,
    smtpConfigured: isSmtpConfigured(),
    ...(mailResult.sent ? {} : { previewOtp: otp }),
    message: mailResult.sent
      ? `Kode verifikasi 6 digit telah dikirim ke ${normalizedEmail}.`
      : `SMTP belum dikonfigurasi pada server. Gunakan kode verifikasi berikut untuk mengaktifkan akun.`,
  });
});

app.post('/api/auth/verify-email', (req: Request, res: Response) => {
  const { email, code, autoSignIn } = req.body as { email?: string; code?: string; autoSignIn?: boolean };
  if (!email?.trim() || !code?.trim()) {
    res.status(400).json({ error: 'Email dan kode verifikasi wajib diisi.' });
    return;
  }

  const userRow = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email.trim().toLowerCase()) as Record<string, unknown> | undefined;

  if (!userRow) {
    res.status(404).json({ error: 'Akun tidak ditemukan.' });
    return;
  }
  if (userRow.is_verified) {
    res.json({ user: toSafeUser(userRow), message: 'Akun sudah terverifikasi.' });
    return;
  }
  if (!userRow.verification_code || String(userRow.verification_code) !== code.trim()) {
    res.status(400).json({ error: 'Kode verifikasi salah.' });
    return;
  }
  if (Number(userRow.verification_expires_at) < Date.now()) {
    res.status(400).json({ error: 'Kode verifikasi kedaluwarsa. Kirim ulang kode baru.' });
    return;
  }

  db.prepare('UPDATE users SET is_verified = 1, verification_code = NULL, verification_expires_at = NULL WHERE id = ?').run(
    String(userRow.id)
  );

  let issuedToken: string | undefined;
  let expiresAt: number | undefined;
  if (autoSignIn) {
    const issued = issueJwtSession(res, req, String(userRow.id), String(userRow.role));
    issuedToken = issued.token;
    expiresAt = issued.expiresAt;
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(String(userRow.id)) as Record<string, unknown>;
  res.json({
    user: toSafeUser(updated),
    ...(issuedToken ? { token: issuedToken, expiresAt } : {}),
    message: 'Email berhasil diverifikasi.',
  });
});

app.post('/api/auth/resend-otp', async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email?.trim()) {
    res.status(400).json({ error: 'Email wajib diisi.' });
    return;
  }
  const userRow = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email.trim().toLowerCase()) as Record<string, unknown> | undefined;

  if (!userRow) {
    res.status(404).json({ error: 'Akun tidak ditemukan.' });
    return;
  }

  const otp = String(crypto.randomInt(100000, 999999));
  const expiresAt = Date.now() + 1000 * 60 * 15;
  db.prepare('UPDATE users SET verification_code = ?, verification_expires_at = ? WHERE id = ?').run(
    otp,
    expiresAt,
    String(userRow.id)
  );

  const mailResult = await sendVerificationEmail(String(userRow.email), String(userRow.name), otp);
  res.json({
    emailSent: mailResult.sent,
    smtpConfigured: isSmtpConfigured(),
    ...(mailResult.sent ? {} : { previewOtp: otp }),
    message: mailResult.sent ? 'Kode OTP baru dikirim ke email.' : 'Kode OTP baru berhasil dibuat.',
  });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email?.trim() || !password) {
    res.status(400).json({ error: 'Email dan password wajib diisi.' });
    return;
  }

  const userRow = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email.trim().toLowerCase()) as Record<string, unknown> | undefined;

  if (!userRow || !verifyPassword(password, String(userRow.password_hash))) {
    res.status(401).json({ error: 'Email atau password salah.' });
    return;
  }

  if (!userRow.is_verified) {
    res.status(403).json({ error: 'Email belum diverifikasi. Selesaikan verifikasi OTP terlebih dahulu.', needsVerification: true });
    return;
  }

  const { token, expiresAt } = issueJwtSession(res, req, String(userRow.id), String(userRow.role));

  res.json({ user: toSafeUser(userRow), token, expiresAt });
});

app.post('/api/auth/password-reset/request', async (req: Request, res: Response) => {
  const caller = getAuthenticatedUser(req);
  const { email } = req.body as { email?: string };
  const targetEmail = (email?.trim() || caller?.email || '').toLowerCase();

  if (!targetEmail) {
    res.status(400).json({ error: 'Email akun wajib diisi.' });
    return;
  }

  const userRow = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(targetEmail) as Record<string, unknown> | undefined;

  if (!userRow) {
    res.status(404).json({ error: 'Email tersebut tidak terdaftar.' });
    return;
  }

  const otp = String(crypto.randomInt(100000, 999999));
  const expiresAt = Date.now() + 1000 * 60 * 15;
  db.prepare('UPDATE users SET reset_code = ?, reset_expires_at = ? WHERE id = ?').run(
    otp,
    expiresAt,
    String(userRow.id)
  );

  const mailResult = await sendOtpEmail(String(userRow.email), String(userRow.name), otp, 'reset');
  res.json({
    emailSent: mailResult.sent,
    smtpConfigured: isSmtpConfigured(),
    ...(mailResult.sent ? {} : { previewOtp: otp }),
    message: mailResult.sent
      ? `Kode OTP ganti password telah dikirim ke ${targetEmail}.`
      : 'SMTP belum dikonfigurasi pada server. Gunakan kode OTP di bawah untuk mengganti password.',
  });
});

app.post('/api/auth/password-reset/confirm', (req: Request, res: Response) => {
  const caller = getAuthenticatedUser(req);
  const { email, code, newPassword } = req.body as {
    email?: string;
    code?: string;
    newPassword?: string;
  };
  const targetEmail = (email?.trim() || caller?.email || '').toLowerCase();

  if (!targetEmail || !code?.trim() || !newPassword || newPassword.length < 6) {
    res.status(400).json({ error: 'Email, kode OTP, dan password baru (minimal 6 karakter) wajib diisi.' });
    return;
  }

  const userRow = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(targetEmail) as Record<string, unknown> | undefined;

  if (!userRow) {
    res.status(404).json({ error: 'Akun tidak ditemukan.' });
    return;
  }
  if (!userRow.reset_code || String(userRow.reset_code) !== code.trim()) {
    res.status(400).json({ error: 'Kode OTP ganti password salah.' });
    return;
  }
  if (Number(userRow.reset_expires_at) < Date.now()) {
    res.status(400).json({ error: 'Kode OTP sudah kedaluwarsa. Minta kode OTP baru.' });
    return;
  }

  db.prepare(`
    UPDATE users
    SET password_hash = ?, reset_code = NULL, reset_expires_at = NULL
    WHERE id = ?
  `).run(hashPassword(newPassword), String(userRow.id));

  // Revoke existing sessions so user logs in fresh with the new password
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(String(userRow.id));
  clearSessionCookie(res, req);

  res.json({ ok: true, message: 'Password berhasil diperbarui. Silakan masuk menggunakan password baru Anda.' });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const cookies = parseCookies(req.headers.cookie);
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7).trim()
    : '';
  const rawToken = cookies[SESSION_COOKIE] || bearer;
  if (rawToken) {
    const payload = verifyJwtToken(rawToken);
    if (payload?.jti) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(payload.jti));
    } else {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(rawToken));
    }
  }
  clearSessionCookie(res, req);
  res.json({ ok: true });
});

// --- FILE UPLOADS ---
const UPLOAD_MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/csv': '.csv',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

app.post('/api/uploads', requireAuth, (req: AuthRequest, res: Response) => {
  const { dataUrl, fileName: originalName } = req.body as { dataUrl?: string; fileName?: string };
  if (!dataUrl || typeof dataUrl !== 'string') {
    res.status(400).json({ error: 'Data file tidak valid.' });
    return;
  }

  const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    res.status(400).json({ error: 'Format data upload tidak valid.' });
    return;
  }

  let mime = match[1].toLowerCase();
  // Fallback for .log or generic text files when browser uses application/octet-stream
  if (mime === 'application/octet-stream' && typeof originalName === 'string' && originalName.toLowerCase().endsWith('.log')) {
    mime = 'text/plain';
  }

  const ext = UPLOAD_MIME_EXT[mime];
  if (!ext) {
    res.status(400).json({ error: 'Format didukung: JPG, PNG, WebP, PDF, TXT/LOG, CSV, DOC/DOCX, XLS/XLSX, atau ZIP.' });
    return;
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    res.status(413).json({ error: 'Ukuran file maksimal 5MB.' });
    return;
  }

  const fileName = `${crypto.randomUUID()}${ext}`;
  const resolvedPath = path.resolve(UPLOAD_DIR, fileName);
  if (!resolvedPath.startsWith(UPLOAD_DIR + path.sep)) {
    res.status(400).json({ error: 'Path upload tidak valid.' });
    return;
  }

  const safeName = typeof originalName === 'string' && originalName.trim()
    ? path.basename(originalName.trim()).slice(0, 120)
    : fileName;

  fs.writeFileSync(resolvedPath, buffer);
  res.status(201).json({
    url: `/uploads/${fileName}`,
    name: safeName,
    mimeType: mime,
    size: buffer.length,
  });
});

// --- USERS & PROFILE ---
app.get('/api/users', requireAuth, (_req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as Record<string, unknown>[];
  res.json({ users: rows.map(toSafeUser) });
});

app.patch('/api/users/me', requireAuth, (req: AuthRequest, res: Response) => {
  const { name, phone, branch, position, avatarUrl } = req.body as Record<string, string>;
  const current = req.user!;

  const safeAvatar = avatarUrl !== undefined
    ? (avatarUrl.startsWith('/uploads/') || avatarUrl === '' ? avatarUrl : current.avatarUrl)
    : current.avatarUrl;

  db.prepare('UPDATE users SET name = ?, phone = ?, branch = ?, position = ?, avatar_url = ? WHERE id = ?').run(
    name?.trim() || current.name,
    phone !== undefined ? phone.trim() : current.phone,
    branch?.trim() || current.branch,
    position !== undefined ? position.trim() : current.position,
    safeAvatar,
    current.id
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(current.id) as Record<string, unknown>;
  res.json({ user: toSafeUser(updated) });
});

app.patch('/api/users/:id/role', requireAuth, (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'Super Admin') {
    res.status(403).json({ error: 'Hanya Super Admin yang dapat mengubah role pengguna.' });
    return;
  }
  const { role } = req.body as { role?: string };
  if (!role || !ALLOWED_ROLES.includes(role)) {
    res.status(400).json({ error: 'Role tidak valid.' });
    return;
  }
  if (req.params.id === req.user!.id && role !== 'Super Admin') {
    res.status(400).json({ error: 'Super Admin aktif tidak bisa menurunkan role akunnya sendiri.' });
    return;
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!updated) {
    res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    return;
  }
  res.json({ user: toSafeUser(updated) });
});

app.delete('/api/users/:id', requireAuth, (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'Super Admin') {
    res.status(403).json({ error: 'Hanya Super Admin yang dapat menghapus akun pengguna.' });
    return;
  }
  if (req.params.id === req.user!.id) {
    res.status(400).json({ error: 'Tidak dapat menghapus akun yang sedang login.' });
    return;
  }
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    return;
  }
  res.json({ ok: true });
});

// --- REGIONS (WILAYAH) ---
function mapRegion(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    code: String(row.code || ''),
    picName: String(row.pic_name || ''),
    description: String(row.description || ''),
    createdAt: String(row.created_at),
  };
}

app.get('/api/regions', requireAuth, (_req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM regions ORDER BY name ASC').all() as Record<string, unknown>[];
  res.json({ regions: rows.map(mapRegion) });
});

app.post('/api/regions', requireAuth, (req: AuthRequest, res: Response) => {
  if (!isTicketManagerRole(req.user!.role)) {
    res.status(403).json({ error: 'Hanya Super Admin, Manager, atau SPV yang dapat menambah wilayah.' });
    return;
  }
  const { name, code, picName, description } = req.body as Record<string, string>;
  const cleanName = (name || '').trim();
  if (!cleanName) {
    res.status(400).json({ error: 'Nama wilayah wajib diisi.' });
    return;
  }
  const existing = db.prepare('SELECT id FROM regions WHERE LOWER(name) = LOWER(?)').get(cleanName);
  if (existing) {
    res.status(409).json({ error: 'Wilayah dengan nama tersebut sudah terdaftar.' });
    return;
  }

  const id = `reg-${crypto.randomUUID()}`;
  const cleanCode = (code || cleanName.replace(/[^A-Za-z]/g, '').slice(0, 3)).toUpperCase();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO regions (id, name, code, pic_name, description, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, cleanName, cleanCode, (picName || '').trim(), (description || '').trim(), now);

  const created = db.prepare('SELECT * FROM regions WHERE id = ?').get(id) as Record<string, unknown>;
  const mapped = mapRegion(created);
  broadcastWs('region:created', { region: mapped });
  res.status(201).json({ region: mapped });
});

app.patch('/api/regions/:id', requireAuth, (req: AuthRequest, res: Response) => {
  if (!isTicketManagerRole(req.user!.role)) {
    res.status(403).json({ error: 'Hanya Super Admin, Manager, atau SPV yang dapat mengubah wilayah.' });
    return;
  }
  const existing = db.prepare('SELECT * FROM regions WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Wilayah tidak ditemukan.' });
    return;
  }

  const { name, code, picName, description } = req.body as Record<string, string>;
  const nextName = name !== undefined ? name.trim() : String(existing.name);
  if (!nextName) {
    res.status(400).json({ error: 'Nama wilayah tidak boleh kosong.' });
    return;
  }

  const duplicate = db
    .prepare('SELECT id FROM regions WHERE LOWER(name) = LOWER(?) AND id != ?')
    .get(nextName, req.params.id);
  if (duplicate) {
    res.status(409).json({ error: 'Nama wilayah sudah digunakan.' });
    return;
  }

  db.prepare('UPDATE regions SET name = ?, code = ?, pic_name = ?, description = ? WHERE id = ?').run(
    nextName,
    code !== undefined ? code.trim().toUpperCase() : existing.code,
    picName !== undefined ? picName.trim() : existing.pic_name,
    description !== undefined ? description.trim() : existing.description,
    req.params.id
  );

  if (nextName !== String(existing.name)) {
    db.prepare('UPDATE devices SET region = ? WHERE region = ?').run(nextName, String(existing.name));
    db.prepare('UPDATE visits SET region = ? WHERE region = ?').run(nextName, String(existing.name));
  }

  const updated = db.prepare('SELECT * FROM regions WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  const mapped = mapRegion(updated);
  broadcastWs('region:updated', { region: mapped, previousName: String(existing.name) });
  res.json({ region: mapped });
});

app.delete('/api/regions/:id', requireAuth, (req: AuthRequest, res: Response) => {
  if (!isTicketManagerRole(req.user!.role)) {
    res.status(403).json({ error: 'Hanya Super Admin, Manager, atau SPV yang dapat menghapus wilayah.' });
    return;
  }
  const info = db.prepare('DELETE FROM regions WHERE id = ?').run(req.params.id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Wilayah tidak ditemukan.' });
    return;
  }
  broadcastWs('region:deleted', { id: req.params.id });
  res.json({ ok: true });
});

// --- SYSTEM HOST METRICS ---
app.get('/api/system/host-metrics', requireAuth, (_req: AuthRequest, res: Response) => {
  const cpus = os.cpus();
  const loadAvg = os.loadavg()[0] || 0;
  const cpuPct = Math.min(100, Math.round((loadAvg / Math.max(1, cpus.length)) * 100));
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memPct = totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 100) : 0;

  let diskPct = 0;
  try {
    const fsStat = fs.statfsSync(process.cwd());
    const totalBlocks = Number(fsStat.blocks || 0);
    const freeBlocks = Number(fsStat.bavail || fsStat.bfree || 0);
    if (totalBlocks > 0) {
      diskPct = Math.round(((totalBlocks - freeBlocks) / totalBlocks) * 100);
    }
  } catch {
    diskPct = 0;
  }

  res.json({
    hostname: os.hostname(),
    platform: `${os.platform()} ${os.arch()}`,
    cpuUsage: cpuPct,
    memoryUsage: memPct,
    diskUsage: diskPct,
    uptimeSeconds: Math.floor(os.uptime()),
  });
});

// --- DEVICES (INFRASTRUCTURE) ---
function mapDevice(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    type: String(row.type),
    region: String(row.region),
    branchUnit: String(row.branch_unit),
    ipAddress: String(row.ip_address),
    port: Number(row.port),
    probeUrl: String(row.probe_url || ''),
    status: String(row.status),
    cpuUsage: Number(row.cpu_usage),
    memoryUsage: Number(row.memory_usage),
    diskUsage: Number(row.disk_usage),
    temperature: Number(row.temperature),
    latencyMs: row.latency_ms === null || row.latency_ms === undefined ? null : Number(row.latency_ms),
    lastPingAt: row.last_ping_at ? String(row.last_ping_at) : null,
    uptimePct: Number(row.uptime_pct),
    notes: String(row.notes || ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function probeAndRecordDevice(existing: Record<string, unknown>) {
  const deviceId = String(existing.id);
  const prevStatus = String(existing.status || 'online');
  const probeResult = await probeTarget(
    String(existing.ip_address),
    Number(existing.port) || 80,
    String(existing.probe_url || '')
  );

  const now = new Date().toISOString();
  const nextStatus: 'online' | 'warning' | 'offline' = !probeResult.reachable
    ? 'offline'
    : probeResult.metrics?.status || 'online';

  db.prepare(`
    INSERT INTO device_logs (id, device_id, status, latency_ms, message, checked_at) VALUES (?, ?, ?, ?, ?, ?)
  `).run(`log-${crypto.randomUUID()}`, deviceId, nextStatus, probeResult.latencyMs, probeResult.message, now);

  // Keep latest 100 logs per device
  db.prepare(`
    DELETE FROM device_logs
    WHERE device_id = ? AND id NOT IN (
      SELECT id FROM device_logs WHERE device_id = ? ORDER BY checked_at DESC LIMIT 100
    )
  `).run(deviceId, deviceId);

  const statsRow = db
    .prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('online', 'warning') THEN 1 ELSE 0 END) as up
      FROM device_logs WHERE device_id = ?
    `)
    .get(deviceId) as { total: number; up: number };

  const uptimePct = statsRow.total > 0 ? Math.round((statsRow.up / statsRow.total) * 1000) / 10 : 100;

  const nextCpu = probeResult.metrics?.cpuUsage ?? Number(existing.cpu_usage);
  const nextMem = probeResult.metrics?.memoryUsage ?? Number(existing.memory_usage);
  const nextDisk = probeResult.metrics?.diskUsage ?? Number(existing.disk_usage);
  const nextTemp = probeResult.metrics?.temperature ?? Number(existing.temperature);

  db.prepare(`
    UPDATE devices
    SET status = ?, latency_ms = ?, last_ping_at = ?, uptime_pct = ?, cpu_usage = ?, memory_usage = ?, disk_usage = ?, temperature = ?, updated_at = ?
    WHERE id = ?
  `).run(nextStatus, probeResult.latencyMs, now, uptimePct, nextCpu, nextMem, nextDisk, nextTemp, now, deviceId);

  const updatedRow = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId) as Record<string, unknown>;
  const mappedDevice = mapDevice(updatedRow);
  broadcastWs('device:updated', { device: mappedDevice });

  // Alert admins/managers if device transitions to offline
  if (prevStatus !== 'offline' && nextStatus === 'offline') {
    const managers = db
      .prepare("SELECT id FROM users WHERE is_verified = 1 AND role IN ('Super Admin', 'Manager', 'SPV', 'IT Lead', 'Regional Manager')")
      .all() as { id: string }[];
    for (const mgr of managers) {
      createAndPushNotification({
        recipientId: mgr.id,
        type: 'device_offline',
        title: `Perangkat DOWN: ${mappedDevice.name}`,
        message: `${mappedDevice.name} (${mappedDevice.branchUnit} · ${mappedDevice.region}) tidak merespons: ${probeResult.message}`,
        ticketId: '',
        ticketCode: mappedDevice.id,
        assignedByName: 'Monitor Otomatis',
      });
    }
  }

  return { device: mappedDevice, probeResult };
}

app.get('/api/devices', requireAuth, (_req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM devices ORDER BY updated_at DESC').all() as Record<string, unknown>[];
  res.json({ devices: rows.map(mapDevice) });
});

app.post('/api/devices', requireAuth, (req: AuthRequest, res: Response) => {
  if (!isDeviceManagerRole(req.user!.role)) {
    res.status(403).json({ error: 'Role Anda hanya memiliki izin memantau perangkat, tidak dapat menambah perangkat.' });
    return;
  }
  const { name, type, region, branchUnit, ipAddress, port, probeUrl, status, cpuUsage, memoryUsage, diskUsage, temperature, notes } = req.body;
  if (!name?.trim() || !type || !region || !branchUnit?.trim() || !ipAddress?.trim()) {
    res.status(400).json({ error: 'Nama, tipe, wilayah, unit cabang, dan IP address wajib diisi.' });
    return;
  }

  const id = `dev-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO devices (id, name, type, region, branch_unit, ip_address, port, probe_url, status, cpu_usage, memory_usage, disk_usage, temperature, uptime_pct, notes, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100, ?, ?, ?, ?)
  `).run(
    id,
    name.trim(),
    type,
    String(region).trim(),
    branchUnit.trim(),
    ipAddress.trim(),
    Number(port) || 80,
    (probeUrl || '').trim(),
    status || 'online',
    Number(cpuUsage) || 0,
    Number(memoryUsage) || 0,
    Number(diskUsage) || 0,
    Number(temperature) || 0,
    (notes || '').trim(),
    req.user!.id,
    now,
    now
  );

  const created = db.prepare('SELECT * FROM devices WHERE id = ?').get(id) as Record<string, unknown>;
  const mapped = mapDevice(created);
  broadcastWs('device:created', { device: mapped });
  res.status(201).json({ device: mapped });
});

app.post('/api/devices/probe-all', requireAuth, async (_req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM devices ORDER BY updated_at DESC').all() as Record<string, unknown>[];
  const results = [];
  for (let i = 0; i < rows.length; i += 5) {
    const batch = rows.slice(i, i + 5);
    const batchOut = await Promise.all(batch.map((row) => probeAndRecordDevice(row)));
    results.push(...batchOut);
  }
  res.json({ devices: results.map((r) => r.device), probedCount: results.length });
});

app.patch('/api/devices/:id', requireAuth, (req: AuthRequest, res: Response) => {
  if (!isDeviceManagerRole(req.user!.role)) {
    res.status(403).json({ error: 'Role Anda hanya memiliki izin memantau perangkat, tidak dapat mengubah konfigurasi.' });
    return;
  }
  const existing = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Perangkat tidak ditemukan.' });
    return;
  }

  const { name, type, region, branchUnit, ipAddress, port, probeUrl, status, cpuUsage, memoryUsage, diskUsage, temperature, notes } = req.body;
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE devices
    SET name = ?, type = ?, region = ?, branch_unit = ?, ip_address = ?, port = ?, probe_url = ?, status = ?, cpu_usage = ?, memory_usage = ?, disk_usage = ?, temperature = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run(
    name !== undefined ? String(name).trim() : existing.name,
    type !== undefined ? type : existing.type,
    region !== undefined ? String(region).trim() : existing.region,
    branchUnit !== undefined ? String(branchUnit).trim() : existing.branch_unit,
    ipAddress !== undefined ? String(ipAddress).trim() : existing.ip_address,
    port !== undefined ? Number(port) || 80 : existing.port,
    probeUrl !== undefined ? String(probeUrl).trim() : existing.probe_url,
    status !== undefined ? status : existing.status,
    cpuUsage !== undefined ? Number(cpuUsage) : existing.cpu_usage,
    memoryUsage !== undefined ? Number(memoryUsage) : existing.memory_usage,
    diskUsage !== undefined ? Number(diskUsage) : existing.disk_usage,
    temperature !== undefined ? Number(temperature) : existing.temperature,
    notes !== undefined ? String(notes).trim() : existing.notes,
    now,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  const mapped = mapDevice(updated);
  broadcastWs('device:updated', { device: mapped });
  res.json({ device: mapped });
});

app.delete('/api/devices/:id', requireAuth, (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'Super Admin') {
    res.status(403).json({ error: 'Hanya Super Admin yang dapat menghapus perangkat dari sistem.' });
    return;
  }
  const info = db.prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Perangkat tidak ditemukan.' });
    return;
  }
  broadcastWs('device:deleted', { id: req.params.id });
  res.json({ ok: true });
});

app.post('/api/devices/:id/probe', requireAuth, async (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Perangkat tidak ditemukan.' });
    return;
  }

  const { device, probeResult } = await probeAndRecordDevice(existing);
  const logs = db.prepare('SELECT * FROM device_logs WHERE device_id = ? ORDER BY checked_at DESC LIMIT 10').all(req.params.id);

  res.json({ device, probeResult, logs });
});

app.get('/api/devices/:id/logs', requireAuth, (req: AuthRequest, res: Response) => {
  const logs = db.prepare('SELECT * FROM device_logs WHERE device_id = ? ORDER BY checked_at DESC LIMIT 20').all(req.params.id);
  res.json({ logs });
});

// --- TICKETS ---
function mapTicket(row: Record<string, unknown>) {
  const comments = db
    .prepare('SELECT * FROM ticket_comments WHERE ticket_id = ? ORDER BY created_at ASC')
    .all(String(row.id)) as Record<string, unknown>[];

  return {
    id: String(row.id),
    code: String(row.code),
    title: String(row.title),
    category: String(row.category),
    priority: String(row.priority),
    status: String(row.status),
    branchUnit: String(row.branch_unit),
    deviceId: String(row.device_id || ''),
    reportedById: String(row.reported_by_id),
    reportedBy: String(row.reported_by_name),
    assignedToId: String(row.assigned_to_id || ''),
    assignedTo: String(row.assigned_to_name || 'Belum Ditugaskan'),
    description: String(row.description),
    photoUrl: String(row.photo_url || ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    comments: comments.map((c) => {
      let parsedAttachments: { url: string; name: string; mimeType: string; size: number }[] = [];
      try {
        const raw = JSON.parse(String(c.attachments_json || '[]'));
        if (Array.isArray(raw)) parsedAttachments = raw;
      } catch {
        parsedAttachments = [];
      }
      return {
        id: String(c.id),
        authorId: String(c.author_id),
        authorName: String(c.author_name),
        avatarUrl: String(c.author_avatar || ''),
        message: String(c.message),
        timestamp: String(c.created_at),
        attachments: parsedAttachments,
      };
    }),
  };
}

// --- NOTIFICATIONS ---
app.get('/api/notifications', requireAuth, (req: AuthRequest, res: Response) => {
  const rows = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 40')
    .all(req.user!.id) as Record<string, unknown>[];
  const notifications = rows.map(mapNotification);
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  res.json({ notifications, unreadCount });
});

app.patch('/api/notifications/:id/read', requireAuth, (req: AuthRequest, res: Response) => {
  const info = db
    .prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user!.id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Notifikasi tidak ditemukan.' });
    return;
  }
  res.json({ ok: true });
});

app.post('/api/notifications/read-all', requireAuth, (req: AuthRequest, res: Response) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user!.id);
  res.json({ ok: true });
});

app.get('/api/tickets', requireAuth, (_req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM tickets ORDER BY updated_at DESC').all() as Record<string, unknown>[];
  res.json({ tickets: rows.map(mapTicket) });
});

app.post('/api/tickets', requireAuth, (req: AuthRequest, res: Response) => {
  if (!isTicketManagerRole(req.user!.role)) {
    res.status(403).json({ error: 'Hanya Super Admin, Manager, atau SPV yang dapat membuat tiket baru.' });
    return;
  }
  const { title, category, priority, branchUnit, deviceId, assignedToId, description, photoUrl } = req.body;
  if (!title?.trim() || !category || !priority || !branchUnit?.trim() || !description?.trim()) {
    res.status(400).json({ error: 'Judul, kategori, prioritas, unit cabang, dan deskripsi wajib diisi.' });
    return;
  }

  let assignedName = 'Belum Ditugaskan';
  let safeAssignedId = '';
  if (assignedToId) {
    const assignee = db.prepare('SELECT id, name FROM users WHERE id = ?').get(assignedToId) as { id: string; name: string } | undefined;
    if (assignee) {
      safeAssignedId = assignee.id;
      assignedName = assignee.name;
    }
  }

  const safePhoto = typeof photoUrl === 'string' && photoUrl.startsWith('/uploads/') ? photoUrl : '';
  const id = `tkt-${crypto.randomUUID()}`;
  const code = `INC-${new Date().getFullYear()}-${String(crypto.randomInt(1000, 9999))}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO tickets (id, code, title, category, priority, status, branch_unit, device_id, reported_by_id, reported_by_name, assigned_to_id, assigned_to_name, description, photo_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    code,
    title.trim(),
    category,
    priority,
    branchUnit.trim(),
    deviceId || '',
    req.user!.id,
    req.user!.name,
    safeAssignedId,
    assignedName,
    description.trim(),
    safePhoto,
    now,
    now
  );

  const created = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as Record<string, unknown>;
  const mappedTicket = mapTicket(created);
  broadcastWs('ticket:created', { ticket: mappedTicket });

  if (safeAssignedId) {
    dispatchTaskAssignmentAlerts({
      recipientId: safeAssignedId,
      assigner: req.user!,
      ticket: mappedTicket,
      isReassign: false,
    });
  }

  res.status(201).json({ ticket: mappedTicket });
});

app.patch('/api/tickets/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Tiket tidak ditemukan.' });
    return;
  }

  const { title, category, priority, status, branchUnit, assignedToId, description } = req.body;
  const isManager = isTicketManagerRole(req.user!.role);

  if (String(existing.status) === 'Resolved' && !isManager) {
    res.status(403).json({
      error: 'Tiket yang sudah selesai (Resolved) dikunci. Hanya Super Admin, Manager, atau SPV yang dapat mengubah statusnya.',
    });
    return;
  }

  if (
    !isManager &&
    (title !== undefined ||
      category !== undefined ||
      priority !== undefined ||
      branchUnit !== undefined ||
      assignedToId !== undefined ||
      description !== undefined)
  ) {
    res.status(403).json({ error: 'Hanya Super Admin, Manager, atau SPV yang dapat mengubah penugasan atau detail tiket.' });
    return;
  }

  let nextAssignedId = String(existing.assigned_to_id || '');
  let nextAssignedName = String(existing.assigned_to_name || 'Belum Ditugaskan');

  if (assignedToId !== undefined) {
    if (!assignedToId) {
      nextAssignedId = '';
      nextAssignedName = 'Belum Ditugaskan';
    } else {
      const assignee = db.prepare('SELECT id, name FROM users WHERE id = ?').get(assignedToId) as { id: string; name: string } | undefined;
      if (assignee) {
        nextAssignedId = assignee.id;
        nextAssignedName = assignee.name;
      }
    }
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE tickets
    SET title = ?, category = ?, priority = ?, status = ?, branch_unit = ?, assigned_to_id = ?, assigned_to_name = ?, description = ?, updated_at = ?
    WHERE id = ?
  `).run(
    title !== undefined ? String(title).trim() : existing.title,
    category !== undefined ? category : existing.category,
    priority !== undefined ? priority : existing.priority,
    status !== undefined ? status : existing.status,
    branchUnit !== undefined ? String(branchUnit).trim() : existing.branch_unit,
    nextAssignedId,
    nextAssignedName,
    description !== undefined ? String(description).trim() : existing.description,
    now,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  const mappedTicket = mapTicket(updated);
  broadcastWs('ticket:updated', { ticket: mappedTicket });

  if (nextAssignedId && nextAssignedId !== String(existing.assigned_to_id || '')) {
    dispatchTaskAssignmentAlerts({
      recipientId: nextAssignedId,
      assigner: req.user!,
      ticket: mappedTicket,
      isReassign: Boolean(existing.assigned_to_id),
    });
  }

  res.json({ ticket: mappedTicket });
});

app.delete('/api/tickets/:id', requireAuth, (req: AuthRequest, res: Response) => {
  if (!isTicketManagerRole(req.user!.role)) {
    res.status(403).json({ error: 'Hanya Super Admin, Manager, atau SPV yang dapat menghapus tiket.' });
    return;
  }
  const info = db.prepare('DELETE FROM tickets WHERE id = ?').run(req.params.id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Tiket tidak ditemukan.' });
    return;
  }
  broadcastWs('ticket:deleted', { id: req.params.id });
  res.json({ ok: true });
});

app.post('/api/tickets/:id/comments', requireAuth, (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT id, status FROM tickets WHERE id = ?').get(req.params.id) as
    | { id: string; status: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Tiket tidak ditemukan.' });
    return;
  }
  if (existing.status === 'Resolved') {
    res.status(403).json({
      error: 'Tiket sudah selesai & ditutup (Resolved). Siapapun tidak dapat mengirim pesan atau lampiran lagi.',
    });
    return;
  }
  const { message, attachments, nextStatus } = req.body as {
    message?: string;
    attachments?: { url?: string; name?: string; mimeType?: string; size?: number }[];
    nextStatus?: string;
  };

  const safeAttachments = Array.isArray(attachments)
    ? attachments
        .filter((a) => a && typeof a.url === 'string' && a.url.startsWith('/uploads/'))
        .slice(0, 6)
        .map((a) => ({
          url: String(a.url),
          name: String(a.name || 'lampiran').slice(0, 120),
          mimeType: String(a.mimeType || 'application/octet-stream').slice(0, 100),
          size: Math.max(0, Number(a.size) || 0),
        }))
    : [];

  const cleanMessage = (message || '').trim();
  if (!cleanMessage && safeAttachments.length === 0) {
    res.status(400).json({ error: 'Tulis catatan progres atau lampirkan foto/file terlebih dahulu.' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO ticket_comments (id, ticket_id, author_id, author_name, author_avatar, message, attachments_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `cm-${crypto.randomUUID()}`,
    req.params.id,
    req.user!.id,
    req.user!.name,
    req.user!.avatarUrl,
    cleanMessage || (safeAttachments.length > 0 ? 'Melampirkan bukti pengerjaan.' : ''),
    JSON.stringify(safeAttachments),
    now
  );

  const validStatuses = ['Open', 'In Progress', 'Pending Review', 'Resolved'];
  if (nextStatus && validStatuses.includes(nextStatus)) {
    db.prepare('UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, now, req.params.id);
  } else {
    db.prepare('UPDATE tickets SET updated_at = ? WHERE id = ?').run(now, req.params.id);
  }

  const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  const mappedTicket = mapTicket(updated);
  broadcastWs('ticket:updated', { ticket: mappedTicket });

  if (mappedTicket.assignedToId && mappedTicket.assignedToId !== req.user!.id) {
    createAndPushNotification({
      recipientId: mappedTicket.assignedToId,
      type: 'ticket_comment',
      title: `Update Tiket ${mappedTicket.code}`,
      message: `${req.user!.name} mengirim update pada "${mappedTicket.title}": ${(cleanMessage || 'Lampiran bukti baru').slice(0, 110)}`,
      ticketId: mappedTicket.id,
      ticketCode: mappedTicket.code,
      assignedByName: req.user!.name,
    });
  }

  res.status(201).json({ ticket: mappedTicket });
});

// --- FIELD VISITS & DAILY REPORTS ---
function mapVisit(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    code: String(row.code),
    branchUnit: String(row.branch_unit),
    region: String(row.region),
    visitDate: String(row.visit_date),
    teamLeadId: String(row.team_lead_id),
    teamLead: String(row.team_lead_name),
    members: JSON.parse(String(row.members_json || '[]')),
    category: String(row.category),
    checklist: JSON.parse(String(row.checklist_json || '[]')),
    summary: String(row.summary),
    findings: String(row.findings),
    recommendations: String(row.recommendations),
    status: String(row.status),
    reviewerNote: String(row.reviewer_note || ''),
    photos: JSON.parse(String(row.photos_json || '[]')),
    costRp: Number(row.cost_rp),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

app.get('/api/visits', requireAuth, (_req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM visits ORDER BY created_at DESC').all() as Record<string, unknown>[];
  res.json({ visits: rows.map(mapVisit) });
});

app.post('/api/visits', requireAuth, (req: AuthRequest, res: Response) => {
  const { branchUnit, region, visitDate, members, category, checklist, summary, findings, recommendations, photos, costRp } = req.body;
  if (!branchUnit?.trim() || !region || !category || !summary?.trim() || !findings?.trim()) {
    res.status(400).json({ error: 'Unit cabang, wilayah, kategori, ringkasan, dan temuan lapangan wajib diisi.' });
    return;
  }

  const safePhotos = Array.isArray(photos)
    ? photos.filter((p): p is string => typeof p === 'string' && p.startsWith('/uploads/'))
    : [];
  const safeMembers = Array.isArray(members)
    ? members.filter((m): m is string => typeof m === 'string' && Boolean(m.trim())).map((m) => m.trim())
    : [];
  const safeChecklist = Array.isArray(checklist) ? checklist : [];

  const id = `vst-${crypto.randomUUID()}`;
  const prefix = String(region).replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'IDN';
  const code = `VST-${prefix}-${String(crypto.randomInt(100, 999))}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO visits (id, code, branch_unit, region, visit_date, team_lead_id, team_lead_name, members_json, category, checklist_json, summary, findings, recommendations, status, photos_json, cost_rp, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', ?, ?, ?, ?)
  `).run(
    id,
    code,
    branchUnit.trim(),
    region,
    visitDate || now.slice(0, 10),
    req.user!.id,
    req.user!.name,
    JSON.stringify(safeMembers),
    category,
    JSON.stringify(safeChecklist),
    summary.trim(),
    findings.trim(),
    (recommendations || '').trim(),
    JSON.stringify(safePhotos),
    Math.max(0, Number(costRp) || 0),
    now,
    now
  );

  const created = db.prepare('SELECT * FROM visits WHERE id = ?').get(id) as Record<string, unknown>;
  const mappedVisit = mapVisit(created);
  broadcastWs('visit:created', { visit: mappedVisit });

  // Notify approvers (Super Admin / Manager / SPV) in real time when a new Daily Visit is submitted
  const approvers = db
    .prepare("SELECT id FROM users WHERE is_verified = 1 AND role IN ('Super Admin', 'Manager', 'SPV', 'Regional Manager') AND id != ?")
    .all(req.user!.id) as { id: string }[];
  for (const appUser of approvers) {
    createAndPushNotification({
      recipientId: appUser.id,
      type: 'visit_submitted',
      title: `Laporan Visit Baru: ${mappedVisit.code}`,
      message: `${req.user!.name} melaporkan visit ${mappedVisit.category} di ${mappedVisit.branchUnit} (${mappedVisit.region}).`,
      ticketId: '',
      ticketCode: mappedVisit.id,
      assignedByName: req.user!.name,
    });
  }

  res.status(201).json({ visit: mappedVisit });
});

app.patch('/api/visits/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT * FROM visits WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Laporan visit tidak ditemukan.' });
    return;
  }

  const { branchUnit, region, visitDate, members, category, checklist, summary, findings, recommendations, status, reviewerNote, photos, costRp } = req.body;
  const isApprover = isVisitApproverRole(req.user!.role);
  const isOwner = String(existing.team_lead_id) === req.user!.id;

  if ((status !== undefined || reviewerNote !== undefined) && !isApprover) {
    res.status(403).json({ error: 'Hanya Super Admin, Manager, atau SPV yang dapat menyetujui atau merevisi status laporan visit.' });
    return;
  }

  if (!isApprover && !isOwner) {
    res.status(403).json({ error: 'Anda hanya dapat mengedit laporan visit yang Anda buat sendiri.' });
    return;
  }

  const nextPhotos = Array.isArray(photos)
    ? JSON.stringify(photos.filter((p): p is string => typeof p === 'string' && p.startsWith('/uploads/')))
    : existing.photos_json;
  const nextMembers = Array.isArray(members)
    ? JSON.stringify(members.filter((m): m is string => typeof m === 'string' && Boolean(m.trim())))
    : existing.members_json;
  const nextChecklist = Array.isArray(checklist) ? JSON.stringify(checklist) : existing.checklist_json;

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE visits
    SET branch_unit = ?, region = ?, visit_date = ?, members_json = ?, category = ?, checklist_json = ?, summary = ?, findings = ?, recommendations = ?, status = ?, reviewer_note = ?, photos_json = ?, cost_rp = ?, updated_at = ?
    WHERE id = ?
  `).run(
    branchUnit !== undefined ? String(branchUnit).trim() : existing.branch_unit,
    region !== undefined ? String(region).trim() : existing.region,
    visitDate !== undefined ? visitDate : existing.visit_date,
    nextMembers,
    category !== undefined ? category : existing.category,
    nextChecklist,
    summary !== undefined ? String(summary).trim() : existing.summary,
    findings !== undefined ? String(findings).trim() : existing.findings,
    recommendations !== undefined ? String(recommendations).trim() : existing.recommendations,
    status !== undefined ? status : existing.status,
    reviewerNote !== undefined ? String(reviewerNote).trim() : existing.reviewer_note,
    nextPhotos,
    costRp !== undefined ? Math.max(0, Number(costRp) || 0) : existing.cost_rp,
    now,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM visits WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  const mappedVisit = mapVisit(updated);
  broadcastWs('visit:updated', { visit: mappedVisit });

  if (
    status !== undefined &&
    status !== String(existing.status) &&
    mappedVisit.teamLeadId &&
    mappedVisit.teamLeadId !== req.user!.id
  ) {
    createAndPushNotification({
      recipientId: mappedVisit.teamLeadId,
      type: 'visit_reviewed',
      title: `Visit ${mappedVisit.code}: ${mappedVisit.status}`,
      message: `${req.user!.name} memperbarui status visit ${mappedVisit.branchUnit} menjadi ${mappedVisit.status}${mappedVisit.reviewerNote ? ` — "${mappedVisit.reviewerNote}"` : ''}.`,
      ticketId: '',
      ticketCode: mappedVisit.id,
      assignedByName: req.user!.name,
    });
  }

  res.json({ visit: mappedVisit });
});

app.delete('/api/visits/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT * FROM visits WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Laporan visit tidak ditemukan.' });
    return;
  }
  const isOwnerNotApproved = String(existing.team_lead_id) === req.user!.id && String(existing.status) !== 'Approved';
  if (req.user!.role !== 'Super Admin' && !isVisitApproverRole(req.user!.role) && !isOwnerNotApproved) {
    res.status(403).json({ error: 'Anda tidak memiliki izin menghapus laporan visit ini.' });
    return;
  }
  db.prepare('DELETE FROM visits WHERE id = ?').run(req.params.id);
  broadcastWs('visit:deleted', { id: req.params.id });
  res.json({ ok: true });
});

// --- BOOT SERVER WITH VITE MIDDLEWARE IN DEV OR STATIC IN PROD ---
async function startServer() {
  const httpServer = http.createServer(app);

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
        ws: hmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });

    if (hmrDisabled) {
      app.get('/@vite/client', (_req, res) => {
        res.setHeader('Cache-Control', 'no-cache');
        res.type('application/javascript').send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
let lastInsertedStyle;
function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = void 0; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]').forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {}
  };
}
function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return pathname + "?" + queryToInject + (search ? "&" + search.slice(1) : "") + (hash || "");
}
class ErrorOverlay extends HTMLElement {}
export { ErrorOverlay, createHotContext, injectQuery, removeStyle, updateStyle };
`);
      });
    }

    app.use((req, res, next) => {
      if (
        req.path === '/' ||
        req.path === '/index.html' ||
        req.path === '/dev-sw.js' ||
        req.path === '/sw.js' ||
        req.path === '/manifest.webmanifest' ||
        req.path === '/registerSW.js'
      ) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          const base = path.basename(filePath);
          if (
            base === 'index.html' ||
            base === 'sw.js' ||
            base === 'registerSW.js' ||
            base === 'manifest.webmanifest'
          ) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const wss = new WebSocketServer({ noServer: true });
  const heartbeatInterval = setInterval(() => {
    for (const set of wsClientsByUser.values()) {
      for (const ws of set) {
        const flagged = ws as WebSocket & { isAlive?: boolean };
        if (flagged.isAlive === false) {
          flagged.terminate();
          continue;
        }
        flagged.isAlive = false;
        flagged.ping();
      }
    }
  }, 25000);
  heartbeatInterval.unref();

  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const parsedUrl = new URL(req.url || '/', 'http://localhost');
      if (parsedUrl.pathname !== '/ws') return;

      const cookies = parseCookies(req.headers.cookie);
      const queryToken = parsedUrl.searchParams.get('token') || '';
      const rawToken = cookies[SESSION_COOKIE] || queryToken;
      const authSession = verifyRawSessionToken(rawToken);
      if (!authSession || !authSession.user.isVerified) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        const flagged = ws as WebSocket & { isAlive?: boolean };
        flagged.isAlive = true;
        ws.on('pong', () => {
          flagged.isAlive = true;
        });

        const userId = authSession.user.id;
        addWsClient(userId, ws);
        ws.send(JSON.stringify({ event: 'ws:connected', data: { userId } }));

        ws.on('close', () => {
          removeWsClient(userId, ws);
        });
        ws.on('error', () => {
          removeWsClient(userId, ws);
        });
      });
    } catch {
      socket.destroy();
    }
  });

  // Background automatic device monitoring every 2 minutes
  let autoProbeRunning = false;
  const autoProbeInterval = setInterval(async () => {
    if (autoProbeRunning) return;
    autoProbeRunning = true;
    try {
      const rows = db.prepare('SELECT * FROM devices').all() as Record<string, unknown>[];
      for (let i = 0; i < rows.length; i += 4) {
        const batch = rows.slice(i, i + 4);
        await Promise.all(batch.map((r) => probeAndRecordDevice(r)));
      }
    } catch {
      // Ignore transient scheduler errors
    } finally {
      autoProbeRunning = false;
    }
  }, 120000);
  autoProbeInterval.unref();

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`NusantaraOps server running on http://0.0.0.0:${PORT}`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, closing server & SQLite cleanly...`);
    clearInterval(heartbeatInterval);
    clearInterval(autoProbeInterval);
    wss.close();
    httpServer.close(() => {
      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
        db.close();
      } catch {
        // ignore close errors during shutdown
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
