'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/AppShell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, activeOrg, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth/login');
    } else if (!activeOrg || activeOrg.setupStatus !== 'COMPLETED') {
      router.replace('/onboarding');
    }
  }, [user, activeOrg, loading, router]);

  if (loading || !user || !activeOrg) {
    return <div className="p-10 text-center text-sm text-slate-500">Verifying Organization access...</div>;
  }

  return <AppShell>{children}</AppShell>;
}
