import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { UserRole, Company } from '@/types/qc';

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
  token?: string; // JWT token for backup auth
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
  token: string | null;

  // Auth actions
  setAuth: (auth: AuthState) => void;
  logout: () => void;

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

const AUTH_STORAGE_KEY = 'hayqc_auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial auth state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AuthState;
        // Validate stored auth has required fields
        if (parsed.user?.id && parsed.company?.id) {
          setAuthState(parsed);
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }
    } catch (e) {
      console.error('Failed to load auth state:', e);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set auth and persist to localStorage
  const setAuth = useCallback((newAuth: AuthState) => {
    setAuthState(newAuth);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuth));
    } catch (e) {
      console.error('Failed to persist auth state:', e);
    }
  }, []);

  // Clear auth state and localStorage, call backend logout
  const logout = useCallback(async () => {
    setAuthState(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
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
  const token = auth?.token ?? null;

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
    token,
    setAuth,
    logout,
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
