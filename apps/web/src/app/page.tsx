'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const { user, activeOrg, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth/login');
    } else if (!activeOrg || activeOrg.setupStatus !== 'COMPLETED') {
      router.replace('/onboarding');
    } else {
      router.replace('/dashboard');
    }
  }, [user, activeOrg, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-600">Loading Company OS Core...</p>
      </div>
    </div>
  );
}
