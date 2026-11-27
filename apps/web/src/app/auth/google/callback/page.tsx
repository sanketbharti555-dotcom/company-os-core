'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

function CallbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { refreshMe } = useAuth();

  useEffect(() => {
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    if (accessToken) {
      localStorage.setItem('cos_access_token', accessToken);
      if (refreshToken) localStorage.setItem('cos_refresh_token', refreshToken);
      refreshMe().then(() => router.replace('/'));
    } else {
      router.replace('/auth/login?error=Google+authentication+failed');
    }
  }, [params, refreshMe, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm font-medium text-slate-600">Completing Google Sign-In &amp; Drive Link...</p>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <CallbackInner />
    </Suspense>
  );
}
