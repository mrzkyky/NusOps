export type UserRole =
  | 'Super Admin'
  | 'Manager'
  | 'SPV'
  | 'IT Lead'
  | 'Staff'
  | 'Field Tech'
  | 'Regional Manager';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  position: string;
  branch: string;
  avatarUrl: string;
  isVerified: boolean;
  phone: string;
  createdAt?: string;
}

export type DeviceStatus = 'online' | 'warning' | 'offline';

export interface InfrastructureDevice {
  id: string;
  name: string;
  type: 'Server' | 'Core Router' | 'Switch' | 'UPS Power' | 'AC Cooling Unit';
  region: 'Jabodetabek' | 'Jawa Barat' | 'Jawa Timur' | 'Sumatera Utara' | 'Sulawesi Selatan' | 'Bali Nusra' | 'Kalimantan';
  branchUnit: string;
  ipAddress: string;
  port: number;
  probeUrl: string;
  status: DeviceStatus;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  temperature: number;
  latencyMs: number | null;
  lastPingAt: string | null;
  uptimePct: number;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeviceProbeLog {
  id: string;
  device_id: string;
  status: DeviceStatus;
  latency_ms: number | null;
  message: string;
  checked_at: string;
}

export type TicketPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type TicketStatus = 'Open' | 'In Progress' | 'Pending Review' | 'Resolved';

export interface TicketAttachment {
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface TicketComment {
  id: string;
  authorId: string;
  authorName: string;
  avatarUrl: string;
  message: string;
  timestamp: string;
  attachments?: TicketAttachment[];
}

export interface Ticket {
  id: string;
  code: string;
  title: string;
  category: 'Server Hardware' | 'Network & Routing' | 'AC & Cooling' | 'UPS Power' | 'Security & Access';
  priority: TicketPriority;
  status: TicketStatus;
  branchUnit: string;
  deviceId: string;
  reportedById: string;
  reportedBy: string;
  assignedToId: string;
  assignedTo: string;
  createdAt: string;
  updatedAt?: string;
  description: string;
  photoUrl: string;
  comments: TicketComment[];
}

export type VisitCategory =
  | 'AC Cleaning & Service'
  | 'Server Rack Audit'
  | 'UPS Battery Load Test'
  | 'Network Cable Management'
  | 'General Infrastructure Check';

export interface VisitChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface FieldVisitReport {
  id: string;
  code: string;
  branchUnit: string;
  region: string;
  visitDate: string;
  teamLeadId: string;
  teamLead: string;
  members: string[];
  category: VisitCategory;
  checklist: VisitChecklistItem[];
  summary: string;
  findings: string;
  recommendations: string;
  status: 'Submitted' | 'Approved' | 'Revision Required';
  reviewerNote: string;
  photos: string[];
  costRp: number;
  createdAt?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: 'task_assigned' | 'ticket_comment';
  title: string;
  message: string;
  ticketId: string;
  ticketCode: string;
  assignedByName: string;
  isRead: boolean;
  createdAt: string;
}

