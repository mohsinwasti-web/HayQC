const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

class ApiError extends Error {
  constructor(message: string, public status: number, public data?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

// Response envelope type - all app routes return { data: T }
interface ApiResponse<T> {
  data: T;
}

// Helper to get auth token from localStorage
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('hayqc_auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.token ?? null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Build headers with optional Bearer token
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Add Authorization header if token exists
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: "include",
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new ApiError(
      // Try app-route format first, fallback to generic message (Better Auth uses this)
      json?.error?.message || json?.message || `Request failed with status ${response.status}`,
      response.status,
      json?.error || json
    );
  }

  // 1. Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  // 2. JSON responses: parse and unwrap { data }
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    const json: ApiResponse<T> = await response.json();
    return json.data;
  }

  // 3. Non-JSON: return undefined (caller should use api.raw() for these)
  return undefined as T;
}

// Raw request for non-JSON endpoints (uploads, downloads, streams)
async function rawRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Build headers with optional Bearer token
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Add Authorization header if token exists
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: "include",
  };
  return fetch(url, config);
}

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),

  // Escape hatch for non-JSON endpoints
  raw: rawRequest,

  // ==================== COMPANIES ====================
  companies: {
    list: () => api.get('/api/companies'),
    get: (id: string) => api.get(`/api/companies/${id}`),
    create: (data: unknown) => api.post('/api/companies', data),
    update: (id: string, data: unknown) => api.put(`/api/companies/${id}`, data),
    delete: (id: string) => api.delete(`/api/companies/${id}`),
  },

  // ==================== USERS ====================
  users: {
    list: (companyId?: string, role?: string) => {
      const params = new URLSearchParams();
      if (companyId) params.append('companyId', companyId);
      if (role) params.append('role', role);
      const query = params.toString() ? `?${params.toString()}` : '';
      return api.get(`/api/users${query}`);
    },
    get: (id: string) => api.get(`/api/users/${id}`),
    create: (data: unknown) => api.post('/api/users', data),
    update: (id: string, data: unknown) => api.put(`/api/users/${id}`, data),
    delete: (id: string) => api.delete(`/api/users/${id}`),
    getByEmail: (email: string) => api.get(`/api/users/by-email/${encodeURIComponent(email)}`),
  },

  // ==================== INSPECTORS (Legacy - redirects to users) ====================
  inspectors: {
    list: (companyId?: string) => api.get(`/api/users${companyId ? `?companyId=${companyId}&role=INSPECTOR` : '?role=INSPECTOR'}`),
    get: (id: string) => api.get(`/api/users/${id}`),
    create: (data: unknown) => api.post('/api/users', data),
    update: (id: string, data: unknown) => api.put(`/api/users/${id}`, data),
    delete: (id: string) => api.delete(`/api/users/${id}`),
  },

  // ==================== AUTH ====================
  auth: {
    login: (companyId: string, userId: string, pin: string) =>
      api.post('/api/auth/login', { companyId, userId, pin }),
    loginUsers: (companyId: string, role?: string) => {
      const params = new URLSearchParams();
      params.append('companyId', companyId);
      if (role) params.append('role', role);
      return api.get(`/api/auth/login-users?${params.toString()}`);
    },
  },


  // ==================== PURCHASE ORDERS ====================
  purchaseOrders: {
    list: (companyId?: string, status?: string) => {
      const params = new URLSearchParams();
      if (companyId) params.append('companyId', companyId);
      if (status) params.append('status', status);
      const query = params.toString() ? `?${params.toString()}` : '';
      return api.get(`/api/purchase-orders${query}`);
    },
    get: (id: string) => api.get(`/api/purchase-orders/${id}`),
    create: (data: unknown) => api.post('/api/purchase-orders', data),
    update: (id: string, data: unknown) => api.put(`/api/purchase-orders/${id}`, data),
    delete: (id: string) => api.delete(`/api/purchase-orders/${id}`),
  },

  // ==================== SHIPMENTS ====================
  shipments: {
    list: (poId?: string) => api.get(`/api/shipments${poId ? `?poId=${poId}` : ''}`),
    get: (id: string) => api.get(`/api/shipments/${id}`),
    create: (data: unknown) => api.post('/api/shipments', data),
    update: (id: string, data: unknown) => api.put(`/api/shipments/${id}`, data),
    delete: (id: string) => api.delete(`/api/shipments/${id}`),
  },

  // ==================== CONTAINERS ====================
  containers: {
    list: (shipmentId?: string) => api.get(`/api/containers${shipmentId ? `?shipmentId=${shipmentId}` : ''}`),
    get: (id: string) => api.get(`/api/containers/${id}`),
    create: (data: unknown) => api.post('/api/containers', data),
    update: (id: string, data: unknown) => api.put(`/api/containers/${id}`, data),
    delete: (id: string) => api.delete(`/api/containers/${id}`),
  },

  // ==================== ASSIGNMENTS ====================
  assignments: {
    list: (containerId?: string) => api.get(`/api/assignments${containerId ? `?containerId=${containerId}` : ''}`),
    create: (data: unknown) => api.post('/api/assignments', data),
    delete: (id: string) => api.delete(`/api/assignments/${id}`),
  },

  // ==================== BALES ====================
  bales: {
    list: (params?: { containerId?: string; shipmentId?: string; poId?: string; inspectorId?: string; limit?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.containerId) searchParams.append('containerId', params.containerId);
      if (params?.shipmentId) searchParams.append('shipmentId', params.shipmentId);
      if (params?.poId) searchParams.append('poId', params.poId);
      if (params?.inspectorId) searchParams.append('inspectorId', params.inspectorId);
      if (params?.limit) searchParams.append('limit', params.limit.toString());
      const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return api.get(`/api/bales${query}`);
    },
    get: (id: string) => api.get(`/api/bales/${id}`),
    create: (data: unknown) => api.post('/api/bales', data),
    update: (id: string, data: unknown) => api.put(`/api/bales/${id}`, data),
    delete: (id: string) => api.delete(`/api/bales/${id}`),
    createBulk: (bales: unknown[]) => api.post('/api/bales/bulk', { bales }),
  },

  // ==================== STATISTICS ====================
  stats: {
    container: (id: string) => api.get(`/api/stats/container/${id}`),
    shipment: (id: string) => api.get(`/api/stats/shipment/${id}`),
    po: (id: string) => api.get(`/api/stats/po/${id}`),
    inspector: (id: string) => api.get(`/api/stats/inspector/${id}`),
    user: (id: string) => api.get(`/api/stats/user/${id}`),
  },

  // ==================== PO USER ASSIGNMENTS ====================
  poAssignments: {
    list: (poId?: string, userId?: string) => {
      const params = new URLSearchParams();
      if (poId) params.append('poId', poId);
      if (userId) params.append('userId', userId);
      const query = params.toString() ? `?${params.toString()}` : '';
      return api.get(`/api/po-assignments${query}`);
    },
    create: (data: { poId: string; userId: string }) => api.post('/api/po-assignments', data),
    delete: (id: string) => api.delete(`/api/po-assignments/${id}`),
    getByPo: (poId: string) => api.get(`/api/po-assignments?poId=${poId}`),
    getByUser: (userId: string) => api.get(`/api/po-assignments?userId=${userId}`),
  },

  // ==================== PO NOTES ====================
  poNotes: {
    list: (poId: string) => api.get(`/api/po-notes?poId=${poId}`),
    get: (id: string) => api.get(`/api/po-notes/${id}`),
    create: (data: { poId: string; userId: string; content: string }) => api.post('/api/po-notes', data),
    update: (id: string, data: { content: string }) => api.put(`/api/po-notes/${id}`, data),
    delete: (id: string) => api.delete(`/api/po-notes/${id}`),
  },

  // ==================== HEALTH ====================
  health: () => api.get('/health'),
};

// Sample endpoint types (extend as needed)
export interface SampleResponse {
  message: string;
  timestamp: string;
}

export { ApiError };
