# NusantaraOps Enterprise

Platform monitoring infrastruktur nasional, tiketing insiden, dan laporan field visit berbasis React, Express, SQLite, dan PWA.

---

## 1. Upload Project ke GitHub (`NusantaraOps.git`)

Dari folder project hasil download/export di komputer lokal Anda:

```bash
git init
git add .
git commit -m "feat: initial NusantaraOps Enterprise with Docker support"
git branch -M main
git remote add origin https://github.com/mrzkyky/NusantaraOps.git
git push -u origin main
```

---

## 2. Deploy di Server Menggunakan Docker

Pastikan server sudah terpasang **Docker** dan **Docker Compose**.

### A. Clone & Konfigurasi Environment

```bash
git clone https://github.com/mrzkyky/NusantaraOps.git
cd NusantaraOps
cp .env.example .env
```

Edit file `.env` sesuai kebutuhan server Anda:

```env
APP_PORT=3000
APP_URL=https://domain-atau-ip-server-anda
SESSION_SECRET=isi-string-acak-minimal-32-karakter

# Opsional: untuk kirim OTP verifikasi & reset password via email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=emailanda@gmail.com
SMTP_PASS=app-password-16-digit
SMTP_FROM="NusantaraOps <emailanda@gmail.com>"
```

> Tips generate `SESSION_SECRET` acak di Linux:
> `openssl rand -hex 32`

### B. Jalankan Aplikasi

```bash
docker compose up -d --build
```

Aplikasi berjalan di `http://IP-SERVER:3000`.

---

## 3. Monitoring Container & Kesehatan Aplikasi

### Healthcheck Endpoint
- URL: `GET /api/health`
- Status `200 OK` menandakan server dan koneksi database SQLite sehat:
  ```json
  { "status": "ok", "service": "nusantaraops", "db": "connected" }
  ```

### Perintah Monitoring Cepat di Server
```bash
# Cek status & health container
docker compose ps

# Pantau log real-time
docker compose logs -f nusantaraops

# Cek pemakaian CPU & RAM container
docker stats nusantaraops-app
```

### Dashboard Monitoring Opsional (Dozzle + Uptime Kuma)
Jika ingin dashboard web untuk memantau log real-time (**Dozzle**) dan status uptime/notifikasi (**Uptime Kuma**):

```bash
docker compose --profile monitoring up -d
```

- Log viewer (**Dozzle**): `http://IP-SERVER:8080`
- Uptime monitor (**Uptime Kuma**): `http://IP-SERVER:3001` (tambahkan monitor HTTP ke `http://nusantaraops:3000/api/health`)

---

## 4. Update Aplikasi dari GitHub

Setiap kali ada pembaruan di repository:

```bash
git pull origin main
docker compose up -d --build
```

Data database (`nusantaraops_data`) dan file upload (`nusantaraops_uploads`) tersimpan di Docker Volume sehingga **aman dan tidak terhapus** saat rebuild.

---

## 5. Backup Database & Uploads

```bash
# Backup volume database SQLite
docker run --rm -v nusantaraops_nusantaraops_data:/data -v "$(pwd)":/backup alpine \
  tar czf /backup/nusantaraops-data-$(date +%F).tar.gz -C /data .

# Backup volume foto & lampiran
docker run --rm -v nusantaraops_nusantaraops_uploads:/uploads -v "$(pwd)":/backup alpine \
  tar czf /backup/nusantaraops-uploads-$(date +%F).tar.gz -C /uploads .
```

---

## 6. Agar Aplikasi Bisa Diinstall di HP (PWA) & Notifikasi Browser Aktif

Browser (Chrome Android, Safari iOS, dan Edge) **mewajibkan HTTPS** agar fitur **Install App (PWA)** dan **Notifikasi Browser** bisa berjalan (kecuali jika dibuka lewat `http://localhost`). Jika Anda mengakses server memakai `http://IP-SERVER:3000`, tombol install hanya akan memunculkan panduan karena protokolnya belum HTTPS.

Pilihan tercepat mengaktifkan HTTPS di depan Docker port `3000`:

1. **Cloudflare Tunnel (Gratis, tidak perlu buka port router):** arahkan tunnel ke `http://localhost:3000` (WebSocket `/ws` otomatis didukung).
2. **Caddy (HTTPS Otomatis jika punya domain):**
   ```caddyfile
   ops.domainanda.com {
     reverse_proxy 127.0.0.1:3000
   }
   ```
3. **Nginx + Certbot (pastikan header WebSocket aktif agar notifikasi real-time berjalan):**
   ```nginx
   location / {
     proxy_pass http://127.0.0.1:3000;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "upgrade";
     proxy_set_header Host $host;
     proxy_set_header X-Forwarded-Proto $scheme;
     proxy_set_header X-Forwarded-Host $host;
   }
   ```

