'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface SubStatus {
  plan: string;
  status: string;
  provider: string;
  isBypass: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

export function TrialBanner() {
  const [sub, setSub] = useState<SubStatus | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<SubStatus>('/core/marketplace/subscription-status')
      .then((res) => {
        if (active) setSub(res);
      })
      .catch(() => {
        // Silently ignore if user hasn't finished org setup yet
      });
    return () => {
      active = false;
    };
  }, []);

  if (!sub) return null;

  // Internal / Testing Bypass Banner (subtle emerald pill bar)
  if (sub.isBypass) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-900 px-4 py-2 text-xs text-emerald-100">
        <div className="flex items-center gap-2">
          <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300">
            UNLIMITED BYPASS
          </span>
          <span>
            This organization has unrestricted Enterprise access enabled by Platform Super-Admin.
          </span>
        </div>
        <Link href="/dashboard/app-store" className="font-semibold text-emerald-300 hover:underline">
          Open App Store →
        </Link>
      </div>
    );
  }

  // Expired / Past Due Banner
  if (sub.isExpired || sub.status === 'PAST_DUE' || sub.status === 'CANCELLED') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 bg-rose-600 px-4 py-2.5 text-xs font-medium text-white shadow-sm">
        <div className="flex items-center gap-2">
          <span className="rounded bg-white/20 px-2 py-0.5 font-bold uppercase">
            Trial / Plan Expired
          </span>
          <span>
            Your Free Trial or 30-day subscription has ended. Upgrade now to keep full access to all
            modules and Google Sheets sync.
          </span>
        </div>
        <Link
          href="/dashboard/app-store"
          className="rounded-md bg-white px-3 py-1 font-bold text-rose-700 hover:bg-rose-50"
        >
          Renew / Upgrade Plan
        </Link>
      </div>
    );
  }

  // Active Free Trial Countdown Banner
  if (sub.status === 'TRIALING') {
    const days = sub.daysRemaining ?? 0;
    const urgent = days <= 5;
    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs font-medium text-white shadow-sm ${
          urgent ? 'bg-amber-600' : 'bg-indigo-600'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="rounded bg-white/20 px-2 py-0.5 font-bold uppercase">FREE TRIAL</span>
          <span>
            {days === 1
              ? 'Your Free Trial ends tomorrow (1 day remaining).'
              : `Your Free Trial ends in ${days} days.`}
            {' '}Enjoy full Core + Google Drive Sync while testing!
          </span>
        </div>
        <Link
          href="/dashboard/app-store"
          className={`rounded-md bg-white px-3 py-1 font-bold hover:opacity-90 ${
            urgent ? 'text-amber-700' : 'text-indigo-700'
          }`}
        >
          Upgrade Plan →
        </Link>
      </div>
    );
  }

  // Active Paid Subscription nearing 30-day renewal (<= 5 days left)
  if (sub.status === 'ACTIVE' && sub.daysRemaining !== null && sub.daysRemaining <= 5) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-600 px-4 py-2 text-xs font-medium text-white">
        <span>
          Your <strong>{sub.plan}</strong> subscription renews in{' '}
          <strong>{sub.daysRemaining} days</strong>.
        </span>
        <Link
          href="/dashboard/app-store"
          className="rounded-md bg-white px-3 py-1 font-bold text-amber-700 hover:bg-amber-50"
        >
          Manage Subscription
        </Link>
      </div>
    );
  }

  return null;
}
