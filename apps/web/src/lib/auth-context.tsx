'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiFetch } from './api';

export interface OrgSummary {
  id: string;
  code: string;
  name: string;
  slug: string;
  setupStatus: string;
  isOwner: boolean;
  employeeCode: string | null;
}

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  hasGoogleConnected: boolean;
  isPlatformAdmin?: boolean;
}

interface AuthContextValue {
  user: UserSummary | null;
  activeOrg: OrgSummary | null;
  organizations: OrgSummary[];
  loading: boolean;
  saveSession: (data: {
    accessToken: string;
    refreshToken?: string;
    user: UserSummary;
    activeOrganization: OrgSummary | null;
    organizations: OrgSummary[];
  }) => void;
  refreshMe: () => Promise<void>;
  switchOrg: (tenantId: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [activeOrg, setActiveOrg] = useState<OrgSummary | null>(null);
  const [organizations, setOrganizations] = useState<OrgSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const saveSession = useCallback(
    (data: {
      accessToken: string;
      refreshToken?: string;
      user: UserSummary;
      activeOrganization: OrgSummary | null;
      organizations: OrgSummary[];
    }) => {
      localStorage.setItem('cos_access_token', data.accessToken);
      if (data.refreshToken) localStorage.setItem('cos_refresh_token', data.refreshToken);
      if (data.activeOrganization?.id) {
        localStorage.setItem('cos_tenant_id', data.activeOrganization.id);
      } else {
        localStorage.removeItem('cos_tenant_id');
      }
      setUser(data.user);
      setActiveOrg(data.activeOrganization);
      setOrganizations(data.organizations || []);
    },
    [],
  );

  const refreshMe = useCallback(async () => {
    const token = localStorage.getItem('cos_access_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch<{
        accessToken: string;
        refreshToken: string;
        user: UserSummary;
        activeOrganization: OrgSummary | null;
        organizations: OrgSummary[];
      }>('/auth/me');
      saveSession(data);
    } catch {
      localStorage.removeItem('cos_access_token');
      localStorage.removeItem('cos_tenant_id');
      setUser(null);
      setActiveOrg(null);
    } finally {
      setLoading(false);
    }
  }, [saveSession]);

  const switchOrg = useCallback(
    async (tenantId: string) => {
      const data = await apiFetch<{
        accessToken: string;
        refreshToken: string;
        user: UserSummary;
        activeOrganization: OrgSummary | null;
        organizations: OrgSummary[];
      }>('/auth/switch-org', {
        method: 'POST',
        body: JSON.stringify({ tenantId }),
      });
      saveSession(data);
      window.location.href = '/dashboard';
    },
    [saveSession],
  );

  const logout = useCallback(() => {
    localStorage.removeItem('cos_access_token');
    localStorage.removeItem('cos_refresh_token');
    localStorage.removeItem('cos_tenant_id');
    setUser(null);
    setActiveOrg(null);
    setOrganizations([]);
    window.location.href = '/auth/login';
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  return (
    <AuthContext.Provider
      value={{ user, activeOrg, organizations, loading, saveSession, refreshMe, switchOrg, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
