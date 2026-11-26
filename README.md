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
