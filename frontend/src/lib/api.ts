// API client for Cheesy Parts

import type {
  User,
  LoginResponse,
  RegisterResponse,
  Project,
  Part,
  PartStatus,
  Order,
  OrderItem,
  DashboardData,
  OrderStats,
} from './types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const AUTH_TOKEN_KEY = 'cheesy_parts_token';
const AUTH_SESSION_KEY = 'cheesy_parts_session';

// Get stored auth token
function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

// Store auth token
export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

// Clear auth token
export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

// Session storage helpers
export function setAuthSession(session: { token: string; user: User }): void {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  setAuthToken(session.token);
}

export function getAuthSession(): { token: string; user: User } | null {
  const stored = localStorage.getItem(AUTH_SESSION_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_SESSION_KEY);
  clearAuthToken();
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Auth API
export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const result = await fetchApi<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (result.token && result.user) {
      setAuthSession({ token: result.token, user: result.user });
    }
    return result;
  },

  register: (email: string, password: string, firstName: string, lastName: string) =>
    fetchApi<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName, lastName }),
    }),

  me: () => fetchApi<User>('/auth/me'),

  changePassword: (oldPassword: string, newPassword: string) =>
    fetchApi<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    }),

  logout: () => {
    clearAuthSession();
  },
};

// Users API (Admin only)
export const usersApi = {
  getAll: () => fetchApi<User[]>('/users'),

  getById: (id: string) => fetchApi<User>(`/users/${id}`),

  create: (user: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    userPermission: string;
    enabled?: boolean;
  }) =>
    fetchApi<User>('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    }),

  update: (id: string, user: Partial<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    permission: string;
    enabled: boolean;
  }>) =>
    fetchApi<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/users/${id}`, { method: 'DELETE' }),
};

// Projects API
export const projectsApi = {
  getAll: () => fetchApi<Project[]>('/projects'),

  getById: (id: string) => fetchApi<Project>(`/projects/${id}`),

  create: (project: { name: string; partNumberPrefix: string }) =>
    fetchApi<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    }),

  update: (id: string, project: Partial<{
    name: string;
    partNumberPrefix: string;
    hideDashboards: boolean;
  }>) =>
    fetchApi<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(project),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/projects/${id}`, { method: 'DELETE' }),
};

// Parts API
export const partsApi = {
  getByProject: (projectId: string, sort?: string) => {
    const query = sort ? `?sort=${sort}` : '';
    return fetchApi<Part[]>(`/projects/${projectId}/parts${query}`);
  },

  getById: (id: string) => fetchApi<Part>(`/parts/${id}`),

  create: (projectId: string, part: {
    type: 'part' | 'assembly';
    name: string;
    parentPartId?: string;
  }) =>
    fetchApi<Part>(`/projects/${projectId}/parts`, {
      method: 'POST',
      body: JSON.stringify(part),
    }),

  update: (id: string, part: Partial<{
    name: string;
    status: PartStatus;
    notes: string;
    sourceMaterial: string;
    haveMaterial: boolean;
    quantity: string;
    cutLength: string;
    priority: number;
    drawingCreated: boolean;
  }>) =>
    fetchApi<Part>(`/parts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(part),
    }),

  updateStatus: (id: string, status: PartStatus) =>
    fetchApi<Part>(`/parts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/parts/${id}`, { method: 'DELETE' }),
};

// Dashboard API
export const dashboardApi = {
  get: (projectId: string, status?: PartStatus) => {
    const query = status ? `?status=${status}` : '';
    return fetchApi<DashboardData>(`/projects/${projectId}/dashboard${query}`);
  },
};

// Orders API
export const ordersApi = {
  getByProject: (projectId: string, status?: string) => {
    const query = status ? `?status=${status}` : '';
    return fetchApi<Order[]>(`/projects/${projectId}/orders${query}`);
  },

  getAllByProject: (projectId: string, filters?: { vendor?: string; purchaser?: string }) => {
    const params = new URLSearchParams();
    if (filters?.vendor) params.set('vendor', filters.vendor);
    if (filters?.purchaser) params.set('purchaser', filters.purchaser);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchApi<Order[]>(`/projects/${projectId}/orders/all${query}`);
  },

  getById: (id: string) => fetchApi<Order>(`/orders/${id}`),

  update: (id: string, order: Partial<{
    status: string;
    orderedAt: string;
    paidForBy: string;
    taxCost: number;
    shippingCost: number;
    notes: string;
    reimbursed: boolean;
  }>) =>
    fetchApi<Order>(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(order),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/orders/${id}`, { method: 'DELETE' }),

  getStats: (projectId: string) =>
    fetchApi<OrderStats>(`/projects/${projectId}/orders/stats`),
};

// Order Items API
export const orderItemsApi = {
  getUnclassified: (projectId: string) =>
    fetchApi<OrderItem[]>(`/projects/${projectId}/order-items/unclassified`),

  create: (projectId: string, item: {
    vendor?: string;
    quantity: number;
    partNumber?: string;
    description?: string;
    unitCost: number;
    notes?: string;
  }) =>
    fetchApi<OrderItem>(`/projects/${projectId}/order-items`, {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  update: (id: string, item: Partial<{
    vendor: string;
    quantity: number;
    partNumber: string;
    description: string;
    unitCost: number;
    notes: string;
  }>) =>
    fetchApi<OrderItem>(`/order-items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(item),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/order-items/${id}`, { method: 'DELETE' }),
};

// Vendors API (for autocomplete)
export const vendorsApi = {
  getAll: () => fetchApi<string[]>('/vendors'),
};

// Settings API
export interface Settings {
  hide_unused_fields: boolean;
}

export const settingsApi = {
  get: () => fetchApi<Settings>('/settings'),

  update: (settings: { hideUnusedFields: boolean }) =>
    fetchApi<Settings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
};
