import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { UserRole, Company } from '@/types/qc';
import { api } from '@/lib/api';

// Auth state shape matches API login response
interface AuthUser {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  assignedPoIds: string[];
}

interface AuthState {
  user: AuthUser;
  company: Company;
}

interface AuthContextType {
  // Auth state
  auth: AuthState | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Convenience accessors
  user: AuthUser | null;
  company: Company | null;
  companyId: string | null;
  userId: string | null;
  role: UserRole | null;

  // Auth actions
  setAuth: (auth: AuthState) => void;
  logout: () => void;
  refreshSession: () => Promise<void>;

  // RBAC permission helpers
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canViewAllPOs: boolean;
  canAddNotes: boolean;
  isAssignedToPO: (poId: string) => boolean;
  isSupervisor: boolean;
  isInspector: boolean;
  isCustomer: boolean;
  isSupplier: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from cookie via /api/auth/me
  const refreshSession = useCallback(async () => {
    try {
      const data = await api.auth.me() as AuthState;
      if (data?.user?.id && data?.company?.id) {
        setAuthState(data);
      } else {
        setAuthState(null);
      }
    } catch {
      // Not authenticated or session expired
      setAuthState(null);
    }
  }, []);

  // Load initial auth state from cookie on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        await refreshSession();
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, [refreshSession]);

  // Set auth (called after successful login)
  const setAuth = useCallback((newAuth: AuthState) => {
    setAuthState(newAuth);
  }, []);

  // Clear auth state and call backend logout
  const logout = useCallback(async () => {
    setAuthState(null);
    // Clear the cookie on the backend
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
      await fetch(`${backendUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      // Ignore logout errors
      console.warn('Logout request failed:', e);
    }
  }, []);

  // Derived state
  const user = auth?.user ?? null;
  const company = auth?.company ?? null;
  const companyId = user?.companyId ?? null;
  const userId = user?.id ?? null;
  const role = user?.role ?? null;

  // Role checks
  const isSupervisor = role === 'SUPERVISOR';
  const isInspector = role === 'INSPECTOR';
  const isCustomer = role === 'CUSTOMER';
  const isSupplier = role === 'SUPPLIER';

  // RBAC Permissions based on spec:
  // Supervisor: create/edit/delete everything
  // Inspector: view all company POs, can create bales
  // Customer/Supplier: ONLY see assigned POs; can add notes; can edit/delete ONLY their own notes

  const canCreate = isSupervisor || isInspector;
  const canEdit = isSupervisor;
  const canDelete = isSupervisor;
  const canViewAllPOs = isSupervisor || isInspector;
  const canAddNotes = true; // All roles can add notes to POs they can view

  // Check if user is assigned to a specific PO (for Customer/Supplier)
  const isAssignedToPO = useCallback(
    (poId: string): boolean => {
      if (!user) return false;
      // Supervisors and Inspectors can view all POs
      if (isSupervisor || isInspector) return true;
      // Customer/Supplier check assigned POs
      return user.assignedPoIds?.includes(poId) ?? false;
    },
    [user, isSupervisor, isInspector]
  );

  const value: AuthContextType = {
    auth,
    isAuthenticated: !!auth,
    isLoading,
    user,
    company,
    companyId,
    userId,
    role,
    setAuth,
    logout,
    refreshSession,
    canCreate,
    canEdit,
    canDelete,
    canViewAllPOs,
    canAddNotes,
    isAssignedToPO,
    isSupervisor,
    isInspector,
    isCustomer,
    isSupplier,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
