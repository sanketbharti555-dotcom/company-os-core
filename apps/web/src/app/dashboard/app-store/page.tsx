'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

const BADGE_STYLE: Record<string, string> = {
  TESTING_FREE: 'bg-purple-100 text-purple-800',
  BETA_FREE: 'bg-amber-100 text-amber-800',
  PAID_ADDON: 'bg-emerald-100 text-emerald-800',
  INCLUDED_IN_PLAN: 'bg-blue-100 text-blue-800',
  UPGRADE_REQUIRED: 'bg-rose-100 text-rose-800',
};

export default function AppStorePage() {
  const [data, setData] = useState<{ subscription: any; modules: any[] }>({
    subscription: null,
    modules: [],
  });
  const [msg, setMsg] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = () =>
    apiFetch<any>('/core/marketplace/modules').then(setData).catch(() => {});

  useEffect(() => {
    load();
  }, []);

  async function handleInstall(moduleKey: string) {
    setBusyKey(moduleKey);
    setMsg('');
    try {
      await apiFetch(`/core/marketplace/modules/${moduleKey}/install`, { method: 'POST' });
      setMsg(`Module "${moduleKey.toUpperCase()}" installed! Workspaces unlocked & Google Sheet provisioned in your Drive folder.`);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDisable(moduleKey: string) {
    setBusyKey(moduleKey);
    try {
      await apiFetch(`/core/marketplace/modules/${moduleKey}/disable`, { method: 'POST' });
      setMsg(`Module "${moduleKey.toUpperCase()}" disabled. Existing data remains safe & read-only.`);
      load();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Company OS App Store (1-Click Modules)</h1>
          <p className="text-sm text-slate-500">
            Enable modules for your Organization with one click — zero coding, auto Google Drive Sheet setup.
          </p>
        </div>
        {data.subscription && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-xs">
            <span className="font-bold text-brand-900">Current Plan: {data.subscription.plan}</span>
            <span className="ml-2 rounded-full bg-white px-2 py-0.5 font-semibold text-brand-700">
              {data.subscription.status}
            </span>
          </div>
        )}
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.modules.map((m) => (
          <div key={m.moduleKey} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold uppercase text-slate-400">
                  {m.moduleKey} · v{m.version}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${BADGE_STYLE[m.accessReason] || 'bg-slate-100'}`}>
                  {m.accessReason.replace(/_/g, ' ')}
                </span>
              </div>
              <h2 className="mt-2 text-lg font-bold text-slate-900">{m.name}</h2>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">{m.description}</p>
              {m.expiresAt && (
                <p className="mt-2 text-[11px] font-medium text-amber-700">
                  Access valid until: {new Date(m.expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                {m.canInstall ? 'Ready to Enable' : `Requires ${m.requiredPlan} (₹${m.addonPriceInr}/mo)`}
              </span>
              {m.isInstalled ? (
                <button
                  disabled={busyKey === m.moduleKey}
                  onClick={() => handleDisable(m.moduleKey)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Disable
                </button>
              ) : m.canInstall ? (
                <button
                  disabled={busyKey === m.moduleKey}
                  onClick={() => handleInstall(m.moduleKey)}
                  className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {busyKey === m.moduleKey ? 'Installing...' : '1-Click Install'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setMsg(`Upgrade to ${m.requiredPlan} Plan (₹${m.addonPriceInr}/mo) via Razorpay Checkout to unlock ${m.name}.`)
                  }
                  className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
                >
                  Upgrade Plan
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
