'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

function formatCountdown(sub: any) {
  if (!sub) return { text: 'No Sub', tone: 'text-slate-400' };
  if (sub.provider === 'BYPASS') return { text: '∞ Unlimited Bypass', tone: 'text-emerald-400 font-bold' };
  if (sub.status === 'PAST_DUE' || sub.status === 'CANCELLED') {
    return { text: 'EXPIRED / LOCKED', tone: 'text-rose-400 font-bold' };
  }
  const end = sub.status === 'TRIALING' ? sub.trialEndsAt : sub.currentPeriodEnd;
  if (!end) return { text: sub.status, tone: 'text-slate-300' };
  const diffDays = Math.ceil((new Date(end).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return { text: 'EXPIRED', tone: 'text-rose-400 font-bold' };
  return {
    text: `${diffDays}d left (${sub.status === 'TRIALING' ? 'Trial' : 'Paid'})`,
    tone: diffDays <= 5 ? 'text-amber-400 font-semibold' : 'text-sky-300',
  };
}

export default function PlatformAdminPage() {
  const [overview, setOverview] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [tab, setTab] = useState<'tenants' | 'catalog'>('tenants');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Quick Override Form State
  const [overrideForm, setOverrideForm] = useState({
    tenantId: '',
    moduleKey: 'crm',
    accessType: 'BETA_FREE',
    expiryDays: '30',
    note: 'Pilot Beta Partner',
  });

  const loadAll = async () => {
    setError('');
    try {
      const [ov, ts, cat] = await Promise.all([
        apiFetch<any>('/platform-admin/overview'),
        apiFetch<any[]>('/platform-admin/tenants'),
        apiFetch<any[]>('/platform-admin/catalog'),
      ]);
      setOverview(ov);
      setTenants(ts);
      setCatalog(cat);
      if (ts.length && !overrideForm.tenantId) {
        setOverrideForm((prev) => ({ ...prev, tenantId: ts[0].id }));
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  async function handlePlanChange(tenantId: string, plan: string, status: string) {
    await apiFetch(`/platform-admin/tenants/${tenantId}/subscription`, {
      method: 'PATCH',
      body: JSON.stringify({ plan, status }),
    });
    setMsg(`Updated subscription to ${plan} (${status}).`);
    loadAll();
  }

  async function handleQuickTrial(
    tenantId: string,
    mode: 'DAYS' | 'UNLIMITED' | 'EXPIRE',
    days?: number,
  ) {
    await apiFetch(`/platform-admin/tenants/${tenantId}/trial`, {
      method: 'PATCH',
      body: JSON.stringify({ mode, days }),
    });
    if (mode === 'UNLIMITED') setMsg('Enabled ∞ Unlimited Enterprise Bypass for this organization!');
    else if (mode === 'EXPIRE') setMsg('Marked organization subscription as EXPIRED (Soft Lock).');
    else setMsg(`Set Free Trial to ${days} days from today.`);
    loadAll();
  }

  function handleCopySignupLink() {
    const url = `${window.location.origin}/auth/signup`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setMsg(`Copied Self-Serve Signup Link: ${url}`);
    setTimeout(() => setCopiedLink(false), 2500);
  }

  async function handleGrantOverride(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch('/platform-admin/overrides', {
      method: 'POST',
      body: JSON.stringify({
        ...overrideForm,
        expiryDays: overrideForm.expiryDays ? Number(overrideForm.expiryDays) : null,
      }),
    });
    setMsg(`Granted ${overrideForm.accessType} on "${overrideForm.moduleKey}"!`);
    loadAll();
  }

  async function handleCatalogStage(moduleKey: string, releaseStage: string) {
    await apiFetch(`/platform-admin/catalog/${moduleKey}`, {
      method: 'PATCH',
      body: JSON.stringify({ releaseStage }),
    });
    setMsg(`Module "${moduleKey}" rollout stage changed to ${releaseStage}.`);
    loadAll();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-400">
              SAAS FOUNDER CONTROL PLANE · v2.1
            </span>
            <h1 className="mt-2 text-2xl font-bold text-white">
              Platform Super-Admin — Trials, Bypass, Beta &amp; Subscriptions
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopySignupLink}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500"
            >
              {copiedLink ? '✓ Signup Link Copied!' : 'Copy Client Signup Link'}
            </button>
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              ← Back to Org Dashboard
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-950/60 p-4 text-sm text-rose-200">
            {error}
          </div>
        )}
        {msg && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/60 p-3 text-sm text-emerald-200">
            {msg}
          </div>
        )}

        {/* SaaS KPI Row */}
        {overview && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {[
              { label: 'Total Organizations', value: overview.tenants },
              { label: 'Active Paid / Bypass', value: overview.activeSubs },
              { label: 'On Free Trial', value: overview.trialingSubs ?? 0 },
              { label: 'Beta / Testing Overrides', value: overview.overrides },
              { label: 'Modules in Catalog', value: overview.catalog },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="text-xs text-slate-400">{k.label}</div>
                <div className="mt-1 text-2xl font-bold text-white">{k.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('tenants')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              tab === 'tenants' ? 'bg-brand-600 text-white' : 'bg-slate-900 text-slate-400'
            }`}
          >
            Companies, Free Trials &amp; Bypass Controls
          </button>
          <button
            onClick={() => setTab('catalog')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              tab === 'catalog' ? 'bg-brand-600 text-white' : 'bg-slate-900 text-slate-400'
            }`}
          >
            Global Module Rollout Stages (Internal / Beta / Public)
          </button>
        </div>

        {tab === 'tenants' && (
          <div className="space-y-6">
            {/* Grant Special Beta / Testing Override Form */}
            <form onSubmit={handleGrantOverride} className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3">
              <h2 className="text-sm font-bold text-amber-400">
                Grant Testing Free / Beta Free / Paid Add-on / Block to Any Company
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <select
                  required
                  value={overrideForm.tenantId}
                  onChange={(e) => setOverrideForm({ ...overrideForm, tenantId: e.target.value })}
                  className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
                <select
                  value={overrideForm.moduleKey}
                  onChange={(e) => setOverrideForm({ ...overrideForm, moduleKey: e.target.value })}
                  className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white"
                >
                  {catalog.map((c) => (
                    <option key={c.moduleKey} value={c.moduleKey}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={overrideForm.accessType}
                  onChange={(e) => setOverrideForm({ ...overrideForm, accessType: e.target.value })}
                  className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white"
                >
                  <option value="TESTING_FREE">TESTING_FREE (Internal)</option>
                  <option value="BETA_FREE">BETA_FREE (Pilot)</option>
                  <option value="PAID_ADDON">PAID_ADDON (Manual Paid)</option>
                  <option value="BLOCKED">BLOCKED (Kill Switch)</option>
                </select>
                <input
                  type="number"
                  placeholder="Expiry days (blank = lifetime)"
                  value={overrideForm.expiryDays}
                  onChange={(e) => setOverrideForm({ ...overrideForm, expiryDays: e.target.value })}
                  className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white"
                />
                <button type="submit" className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400">
                  Apply Override
                </button>
              </div>
            </form>

            {/* All Registered Companies Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/60 uppercase text-slate-400">
                  <tr>
                    <th className="p-3">Organization</th>
                    <th className="p-3">Plan &amp; Trial Countdown</th>
                    <th className="p-3">1-Click Trial / Bypass Control</th>
                    <th className="p-3">Quick Plan Switch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {tenants.map((t) => {
                    const cd = formatCountdown(t.subscription);
                    return (
                      <tr key={t.id}>
                        <td className="p-3">
                          <div className="font-bold text-white">{t.name}</div>
                          <div className="text-slate-400">
                            {t.code} · {t._count?.employees || 0} Staff · {t._count?.students || 0} Students
                          </div>
                          {t.sheetConnection?.googleEmail && (
                            <div className="mt-0.5 text-[11px] text-emerald-400">
                              Drive Synced: {t.sheetConnection.googleEmail}
                            </div>
                          )}
                        </td>
                        <td className="p-3 space-y-1">
                          <div>
                            <span className="rounded bg-brand-600/30 px-2 py-0.5 font-bold text-brand-100">
                              {t.subscription?.plan || t.plan}
                            </span>
                          </div>
                          <div className={`text-[11px] ${cd.tone}`}>{cd.text}</div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={() => handleQuickTrial(t.id, 'DAYS', 7)}
                              className="rounded bg-slate-800 px-2 py-1 font-semibold text-sky-300 hover:bg-slate-700"
                            >
                              7d Trial
                            </button>
                            <button
                              onClick={() => handleQuickTrial(t.id, 'DAYS', 15)}
                              className="rounded bg-slate-800 px-2 py-1 font-semibold text-sky-300 hover:bg-slate-700"
                            >
                              15d Trial
                            </button>
                            <button
                              onClick={() => handleQuickTrial(t.id, 'DAYS', 30)}
                              className="rounded bg-slate-800 px-2 py-1 font-semibold text-sky-300 hover:bg-slate-700"
                            >
                              30d Trial
                            </button>
                            <button
                              onClick={() => handleQuickTrial(t.id, 'UNLIMITED')}
                              className="rounded bg-emerald-700 px-2 py-1 font-bold text-white hover:bg-emerald-600"
                            >
                              ∞ Bypass
                            </button>
                            <button
                              onClick={() => handleQuickTrial(t.id, 'EXPIRE')}
                              className="rounded bg-rose-800 px-2 py-1 font-semibold text-rose-100 hover:bg-rose-700"
                            >
                              Lock
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1.5">
                            <button onClick={() => handlePlanChange(t.id, 'STARTER', 'ACTIVE')} className="rounded bg-slate-800 px-2 py-1 hover:bg-slate-700">Starter</button>
                            <button onClick={() => handlePlanChange(t.id, 'GROWTH', 'ACTIVE')} className="rounded bg-emerald-700 px-2 py-1 hover:bg-emerald-600">Growth</button>
                            <button onClick={() => handlePlanChange(t.id, 'ENTERPRISE', 'ACTIVE')} className="rounded bg-indigo-700 px-2 py-1 hover:bg-indigo-600">Enterprise</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'catalog' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {catalog.map((c) => (
              <div key={c.moduleKey} className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">{c.name}</div>
                    <div className="text-xs text-slate-400">
                      Key: {c.moduleKey} · Required Plan: {c.requiredPlan} · Add-on: ₹{Number(c.addonPricePaise) / 100}/mo
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-amber-300">
                    {c.releaseStage}
                  </span>
                </div>
                <div className="flex gap-2 pt-2">
                  {['INTERNAL_TESTING', 'BETA', 'PUBLIC'].map((stage) => (
                    <button
                      key={stage}
                      onClick={() => handleCatalogStage(c.moduleKey, stage)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        c.releaseStage === stage
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Set {stage}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
