import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Company,
  User,
  PurchaseOrder,
  Shipment,
  Container,
  Bale,
  InspectorAssignment,
  POUserAssignment,
  PONote,
  UserRole,
} from '@/types/qc';

// ==================== QUERY KEYS ====================
export const queryKeys = {
  // Companies
  companies: ['companies'] as const,
  company: (id: string) => ['companies', id] as const,

  // Users
  users: (companyId?: string, role?: string) => ['users', { companyId, role }] as const,
  user: (id: string) => ['users', id] as const,

  // Purchase Orders
  purchaseOrders: (companyId?: string, status?: string) => ['purchaseOrders', { companyId, status }] as const,
  purchaseOrder: (id: string) => ['purchaseOrders', id] as const,

  // Shipments
  shipments: (poId?: string) => ['shipments', { poId }] as const,
  shipment: (id: string) => ['shipments', id] as const,

  // Containers
  containers: (shipmentId?: string) => ['containers', { shipmentId }] as const,
  container: (id: string) => ['containers', id] as const,

  // Bales
  bales: (params?: { containerId?: string; shipmentId?: string; poId?: string; inspectorId?: string }) =>
    ['bales', params] as const,
  bale: (id: string) => ['bales', id] as const,

  // Assignments
  assignments: (containerId?: string) => ['assignments', { containerId }] as const,

  // PO Assignments
  poAssignments: (poId?: string, userId?: string) => ['poAssignments', { poId, userId }] as const,

  // PO Notes
  poNotes: (poId: string) => ['poNotes', { poId }] as const,
  poNote: (id: string) => ['poNotes', id] as const,

  // Stats
  containerStats: (id: string) => ['stats', 'container', id] as const,
  shipmentStats: (id: string) => ['stats', 'shipment', id] as const,
  poStats: (id: string) => ['stats', 'po', id] as const,
  userStats: (id: string) => ['stats', 'user', id] as const,
};

// ==================== COMPANY HOOKS ====================
export function useCompanies(options?: Omit<UseQueryOptions<Company[]>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.companies,
    queryFn: () => api.companies.list() as Promise<Company[]>,
    ...options,
  });
}

export function useCompany(id: string, options?: Omit<UseQueryOptions<Company>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.company(id),
    queryFn: () => api.companies.get(id) as Promise<Company>,
    enabled: !!id,
    ...options,
  });
}

export function useCreateCompany(options?: UseMutationOptions<Company, Error, Omit<Company, 'id' | 'createdAt' | 'updatedAt'>>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.companies.create(data) as Promise<Company>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies });
    },
    ...options,
  });
}

export function useUpdateCompany(options?: UseMutationOptions<Company, Error, { id: string; data: Partial<Company> }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Company> }) =>
      api.companies.update(id, data) as Promise<Company>,
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.company(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.companies });
    },
    ...options,
  });
}

// ==================== USER HOOKS ====================
export function useUsers(companyId?: string, role?: UserRole, options?: Omit<UseQueryOptions<User[]>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.users(companyId, role),
    queryFn: () => api.users.list(companyId, role) as Promise<User[]>,
    ...options,
  });
}

// ==================== AUTH HOOKS ====================
interface LoginCredentials {
  companyId: string;
  email: string;
  pin: string;
}

interface LoginResponse {
  user: {
    id: string;
    companyId: string;
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    assignedPoIds: string[];
  };
  company: Company;
}

export function useLogin(options?: UseMutationOptions<LoginResponse, Error, LoginCredentials>) {
  return useMutation({
    mutationFn: ({ companyId, email, pin }: LoginCredentials) =>
      api.auth.login(companyId, email, pin) as Promise<LoginResponse>,
    ...options,
  });
}

// Minimal user type for login dropdown
interface LoginUser {
  id: string;
  name: string;
  role: string;
  email: string;
}

export function useLoginUsers(companyId?: string, role?: string, options?: Omit<UseQueryOptions<LoginUser[]>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: ['loginUsers', { companyId, role }] as const,
    queryFn: () => api.auth.loginUsers(companyId!, role) as Promise<LoginUser[]>,
    enabled: !!companyId,
    ...options,
  });
}

export function useUser(id: string, options?: Omit<UseQueryOptions<User>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.user(id),
    queryFn: () => api.users.get(id) as Promise<User>,
    enabled: !!id,
    ...options,
  });
}

// Create user payload - includes 'pin' which is hashed on the backend
interface CreateUserPayload {
  companyId: string;
  name: string;
  email: string;
  pin: string;
  role?: UserRole;
  isActive?: boolean;
}

export function useCreateUser(options?: UseMutationOptions<User, Error, CreateUserPayload>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserPayload) =>
      api.users.create(data) as Promise<User>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    ...options,
  });
}

export function useUpdateUser(options?: UseMutationOptions<User, Error, { id: string; data: Partial<User> }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User> }) =>
      api.users.update(id, data) as Promise<User>,
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user(id) });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    ...options,
  });
}

export function useDeleteUser(options?: UseMutationOptions<void, Error, string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.users.delete(id) as Promise<void>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    ...options,
  });
}

// ==================== PURCHASE ORDER HOOKS ====================
export function usePurchaseOrders(companyId?: string, status?: string, options?: Omit<UseQueryOptions<PurchaseOrder[]>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.purchaseOrders(companyId, status),
    queryFn: () => api.purchaseOrders.list(companyId, status) as Promise<PurchaseOrder[]>,
    ...options,
  });
}

export function usePurchaseOrder(id: string, options?: Omit<UseQueryOptions<PurchaseOrder>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.purchaseOrder(id),
    queryFn: () => api.purchaseOrders.get(id) as Promise<PurchaseOrder>,
    enabled: !!id,
    ...options,
  });
}

export function useCreatePurchaseOrder(options?: UseMutationOptions<PurchaseOrder, Error, Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.purchaseOrders.create(data) as Promise<PurchaseOrder>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
    },
    ...options,
  });
}

export function useUpdatePurchaseOrder(options?: UseMutationOptions<PurchaseOrder, Error, { id: string; data: Partial<PurchaseOrder> }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PurchaseOrder> }) =>
      api.purchaseOrders.update(id, data) as Promise<PurchaseOrder>,
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrder(id) });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
    },
    ...options,
  });
}

// ==================== SHIPMENT HOOKS ====================
export function useShipments(poId?: string, options?: Omit<UseQueryOptions<Shipment[]>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.shipments(poId),
    queryFn: () => api.shipments.list(poId) as Promise<Shipment[]>,
    ...options,
  });
}

export function useShipment(id: string, options?: Omit<UseQueryOptions<Shipment>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.shipment(id),
    queryFn: () => api.shipments.get(id) as Promise<Shipment>,
    enabled: !!id,
    ...options,
  });
}

export function useCreateShipment(options?: UseMutationOptions<Shipment, Error, Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.shipments.create(data) as Promise<Shipment>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
    ...options,
  });
}

export function useUpdateShipment(options?: UseMutationOptions<Shipment, Error, { id: string; data: Partial<Shipment> }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Shipment> }) =>
      api.shipments.update(id, data) as Promise<Shipment>,
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shipment(id) });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
    ...options,
  });
}

// ==================== CONTAINER HOOKS ====================
export function useContainers(shipmentId?: string, options?: Omit<UseQueryOptions<Container[]>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.containers(shipmentId),
    queryFn: () => api.containers.list(shipmentId) as Promise<Container[]>,
    ...options,
  });
}

export function useContainer(id: string, options?: Omit<UseQueryOptions<Container>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.container(id),
    queryFn: () => api.containers.get(id) as Promise<Container>,
    enabled: !!id,
    ...options,
  });
}

export function useCreateContainer(options?: UseMutationOptions<Container, Error, Omit<Container, 'id' | 'createdAt' | 'updatedAt'>>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Container, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.containers.create(data) as Promise<Container>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
    ...options,
  });
}

export function useUpdateContainer(options?: UseMutationOptions<Container, Error, { id: string; data: Partial<Container> }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Container> }) =>
      api.containers.update(id, data) as Promise<Container>,
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.container(id) });
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
    ...options,
  });
}

// ==================== BALE HOOKS ====================
interface BaleListParams {
  containerId?: string;
  shipmentId?: string;
  poId?: string;
  inspectorId?: string;
  limit?: number;
}

export function useBales(params?: BaleListParams, options?: Omit<UseQueryOptions<Bale[]>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.bales(params),
    queryFn: () => api.bales.list(params) as Promise<Bale[]>,
    ...options,
  });
}

export function useBale(id: string, options?: Omit<UseQueryOptions<Bale>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.bale(id),
    queryFn: () => api.bales.get(id) as Promise<Bale>,
    enabled: !!id,
    ...options,
  });
}

export function useCreateBale(options?: UseMutationOptions<Bale, Error, Omit<Bale, 'id' | 'createdAt' | 'updatedAt'>>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Bale, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.bales.create(data) as Promise<Bale>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bales'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    ...options,
  });
}

export function useCreateBalesBulk(options?: UseMutationOptions<Bale[], Error, Omit<Bale, 'id' | 'createdAt' | 'updatedAt'>[]>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bales: Omit<Bale, 'id' | 'createdAt' | 'updatedAt'>[]) =>
      api.bales.createBulk(bales) as Promise<Bale[]>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bales'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    ...options,
  });
}

export function useUpdateBale(options?: UseMutationOptions<Bale, Error, { id: string; data: Partial<Bale> }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Bale> }) =>
      api.bales.update(id, data) as Promise<Bale>,
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bale(id) });
      queryClient.invalidateQueries({ queryKey: ['bales'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    ...options,
  });
}

export function useDeleteBale(options?: UseMutationOptions<void, Error, string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.bales.delete(id) as Promise<void>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bales'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    ...options,
  });
}

// ==================== INSPECTOR ASSIGNMENT HOOKS ====================
export function useAssignments(containerId?: string, options?: Omit<UseQueryOptions<InspectorAssignment[]>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.assignments(containerId),
    queryFn: () => api.assignments.list(containerId) as Promise<InspectorAssignment[]>,
    ...options,
  });
}

export function useCreateAssignment(options?: UseMutationOptions<InspectorAssignment, Error, Omit<InspectorAssignment, 'id' | 'createdAt'>>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<InspectorAssignment, 'id' | 'createdAt'>) =>
      api.assignments.create(data) as Promise<InspectorAssignment>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
    ...options,
  });
}

export function useDeleteAssignment(options?: UseMutationOptions<void, Error, string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.assignments.delete(id) as Promise<void>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
    ...options,
  });
}

// ==================== PO USER ASSIGNMENT HOOKS ====================
export function usePOAssignments(poId?: string, userId?: string, options?: Omit<UseQueryOptions<POUserAssignment[]>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.poAssignments(poId, userId),
    queryFn: () => api.poAssignments.list(poId, userId) as Promise<POUserAssignment[]>,
    ...options,
  });
}

export function useCreatePOAssignment(options?: UseMutationOptions<POUserAssignment, Error, { poId: string; userId: string }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { poId: string; userId: string }) =>
      api.poAssignments.create(data) as Promise<POUserAssignment>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poAssignments'] });
    },
    ...options,
  });
}

export function useDeletePOAssignment(options?: UseMutationOptions<void, Error, string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.poAssignments.delete(id) as Promise<void>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poAssignments'] });
    },
    ...options,
  });
}

// ==================== PO NOTES HOOKS ====================
export function usePONotes(poId: string, options?: Omit<UseQueryOptions<PONote[]>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.poNotes(poId),
    queryFn: () => api.poNotes.list(poId) as Promise<PONote[]>,
    enabled: !!poId,
    ...options,
  });
}

export function useCreatePONote(options?: UseMutationOptions<PONote, Error, { poId: string; userId: string; content: string }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { poId: string; userId: string; content: string }) =>
      api.poNotes.create(data) as Promise<PONote>,
    onSuccess: (_, { poId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.poNotes(poId) });
    },
    ...options,
  });
}

export function useUpdatePONote(options?: UseMutationOptions<PONote, Error, { id: string; content: string; poId: string }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string; poId: string }) =>
      api.poNotes.update(id, { content }) as Promise<PONote>,
    onSuccess: (_, { poId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.poNotes(poId) });
    },
    ...options,
  });
}

export function useDeletePONote(options?: UseMutationOptions<void, Error, { id: string; poId: string }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; poId: string }) => api.poNotes.delete(id) as Promise<void>,
    onSuccess: (_, { poId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.poNotes(poId) });
    },
    ...options,
  });
}

// ==================== STATS HOOKS ====================
interface ContainerStats {
  total: number;
  accepted: number;
  rejected: number;
  totalWeight: number;
  acceptedWeight: number;
}

interface ShipmentStats extends ContainerStats {
  containerCount: number;
}

interface POStats extends ShipmentStats {
  shipmentCount: number;
  deliveredMT: number;
}

interface UserStats {
  total: number;
  accepted: number;
  rejected: number;
  todayCount: number;
}

export function useContainerStats(id: string, options?: Omit<UseQueryOptions<ContainerStats>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.containerStats(id),
    queryFn: () => api.stats.container(id) as Promise<ContainerStats>,
    enabled: !!id,
    ...options,
  });
}

export function useShipmentStats(id: string, options?: Omit<UseQueryOptions<ShipmentStats>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.shipmentStats(id),
    queryFn: () => api.stats.shipment(id) as Promise<ShipmentStats>,
    enabled: !!id,
    ...options,
  });
}

export function usePOStats(id: string, options?: Omit<UseQueryOptions<POStats>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.poStats(id),
    queryFn: () => api.stats.po(id) as Promise<POStats>,
    enabled: !!id,
    ...options,
  });
}

export function useUserStats(id: string, options?: Omit<UseQueryOptions<UserStats>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.userStats(id),
    queryFn: () => api.stats.user(id) as Promise<UserStats>,
    enabled: !!id,
    ...options,
  });
}
