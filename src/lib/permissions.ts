import { UserRole } from '../types';

export const ROLE_OPTIONS: { value: UserRole; label: string; summary: string }[] = [
  {
    value: 'Super Admin',
    label: 'Super Admin',
    summary: 'Akses penuh: kelola akun & role, buat/tugaskan/hapus tiket, kelola/hapus perangkat, dan approval laporan visit.',
  },
  {
    value: 'Manager',
    label: 'Manager',
    summary: 'Buat & pantau tiket, tugaskan tim, kelola perangkat, serta review & approve laporan visit.',
  },
  {
    value: 'SPV',
    label: 'SPV',
    summary: 'Setara Manager: buat & pantau tiket, tugaskan teknisi, kelola perangkat, dan approve laporan visit.',
  },
  {
    value: 'IT Lead',
    label: 'IT Lead',
    summary: 'Pantau & kelola perangkat cabang, update progres tiket, dan buat laporan visit harian.',
  },
  {
    value: 'Staff',
    label: 'Staff',
    summary: 'Pantau status perangkat, jalankan live probe, update progres tiket, dan buat laporan visit harian.',
  },
];

export function normalizeRoleLabel(role: UserRole | string): string {
  if (role === 'Regional Manager') return 'Manager (Regional)';
  if (role === 'Field Tech') return 'Staff (Field Tech)';
  return role;
}

export function canCreateOrManageTickets(role?: UserRole | string): boolean {
  return role === 'Super Admin' || role === 'Manager' || role === 'SPV' || role === 'Regional Manager';
}

export function canManageDevices(role?: UserRole | string): boolean {
  return (
    role === 'Super Admin' ||
    role === 'Manager' ||
    role === 'SPV' ||
    role === 'IT Lead' ||
    role === 'Regional Manager'
  );
}

export function canDeleteDevices(role?: UserRole | string): boolean {
  return role === 'Super Admin';
}

export function canApproveVisits(role?: UserRole | string): boolean {
  return role === 'Super Admin' || role === 'Manager' || role === 'SPV' || role === 'Regional Manager';
}

export function canManageUsers(role?: UserRole | string): boolean {
  return role === 'Super Admin';
}
