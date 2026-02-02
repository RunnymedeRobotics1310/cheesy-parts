// User and Auth types

export type Permission = 'readonly' | 'editor' | 'admin';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  permission: Permission;
  enabled?: boolean;
  createdAt?: string;
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterResponse {
  message: string;
  user: Omit<User, 'permission'>;
}

// Project types

export interface Project {
  id: string;
  name: string;
  part_number_prefix: string;
  hide_dashboards: boolean;
  created_at: string;
  updated_at: string;
}

// Part types

export type PartType = 'part' | 'assembly';

export type PartStatus =
  | 'designing'
  | 'material'
  | 'ordered'
  | 'drawing'
  | 'ready'
  | 'cnc'
  | 'laser'
  | 'lathe'
  | 'mill'
  | 'printer'
  | 'router'
  | 'manufacturing'
  | 'outsourced'
  | 'welding'
  | 'scotchbrite'
  | 'anodize'
  | 'powder'
  | 'coating'
  | 'assembly'
  | 'done';

export type PartPriority = 0 | 1 | 2;

export interface Part {
  id: string;
  project_id: string;
  part_number: number;
  type: PartType;
  name: string;
  parent_part_id: string | null;
  status: PartStatus;
  notes: string;
  source_material: string;
  have_material: boolean;
  quantity: string;
  cut_length: string;
  priority: PartPriority;
  drawing_created: boolean;
  created_at: string;
  updated_at: string;
  project?: Project;
}

// Status and priority display maps
export const PART_STATUS_MAP: Record<PartStatus, string> = {
  designing: 'Design in progress',
  material: 'Material needs to be ordered',
  ordered: 'Waiting for materials',
  drawing: 'Needs drawing',
  ready: 'Ready to manufacture',
  cnc: 'Ready for CNC',
  laser: 'Ready for laser',
  lathe: 'Ready for lathe',
  mill: 'Ready for mill',
  printer: 'Ready for 3D printer',
  router: 'Ready for router',
  manufacturing: 'Manufacturing in progress',
  outsourced: 'Waiting for outsourced manufacturing',
  welding: 'Waiting for welding',
  scotchbrite: 'Waiting for Scotch-Brite',
  anodize: 'Ready for anodize',
  powder: 'Ready for powder coating',
  coating: 'Waiting for coating',
  assembly: 'Waiting for assembly',
  done: 'Done',
};

export const PART_STATUSES = Object.keys(PART_STATUS_MAP) as PartStatus[];

export const PART_PRIORITY_MAP: Record<PartPriority, string> = {
  0: 'High',
  1: 'Normal',
  2: 'Low',
};

// Order types

export type OrderStatus = 'open' | 'ordered' | 'received';

export interface Order {
  id: string;
  project_id: string;
  vendor_name: string;
  status: OrderStatus;
  ordered_at: string | null;
  paid_for_by: string | null;
  tax_cost: number;
  shipping_cost: number;
  notes: string;
  reimbursed: boolean;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  project?: Project;
}

export interface OrderItem {
  id: string;
  project_id: string;
  order_id: string | null;
  quantity: number;
  part_number: string;
  description: string;
  unit_cost: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

// Dashboard types

export interface DashboardData {
  project: Pick<Project, 'name' | 'part_number_prefix'>;
  partsByStatus: Record<PartStatus, Part[]>;
  statusMap: Record<PartStatus, string>;
  totalParts: number;
}

// Order statistics

export interface OrderStats {
  byVendor: Record<string, {
    orders: (Order & { totalCost: number })[];
    totalCost: number;
  }>;
  byPurchaser: Record<string, {
    reimbursed: number;
    outstanding: number;
  }>;
}

// Utility function to format part number
export function formatPartNumber(project: Pick<Project, 'part_number_prefix'>, part: Pick<Part, 'type' | 'part_number'>): string {
  const typePrefix = part.type === 'assembly' ? 'A' : 'P';
  const paddedNumber = String(part.part_number).padStart(4, '0');
  return `${project.part_number_prefix}-${typePrefix}-${paddedNumber}`;
}
