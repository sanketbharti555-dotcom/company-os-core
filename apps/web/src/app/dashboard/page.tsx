'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function DashboardOverviewPage() {
  const { activeOrg } = useAuth();
  const [org, setOrg] = useState<any>(null);
  const [counts, setCounts] = useState({ employees: 0, students: 0, products: 0, plugins: 0 });

  useEffect(() => {
    Promise.all([
      apiFetch<any>('/core/organizations/current').catch(() => null),
      apiFetch<any[]>('/core/employees').catch(() => []),
      apiFetch<any[]>('/core/students').catch(() => []),
      apiFetch<any[]>('/core/products').catch(() => []),
      apiFetch<any>('/core/plugins').catch(() => ({ plugins: [] })),
    ]).then(([orgData, emps, stus, prods, plugs]) => {
      setOrg(orgData);
      setCounts({
        employees: emps.length,
        students: stus.length,
        products: prods.length,
        plugins: (plugs?.plugins || []).length,
      });
    });
  }, []);

  const conn = org?.sheetConnection;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{activeOrg?.name} — Core Platform</h1>
          <p className="text-sm text-slate-500">
            Tenant ID: <code className="rounded bg-slate-200 px-1.5 py-0.5 text-xs">{activeOrg?.id}</code> ({activeOrg?.code})
          </p>
        </div>
        <Link
          href="/dashboard/plugins"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Dock Future Plugin (CRM / Academic / Finance)
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Active Employees', value: counts.employees, href: '/dashboard/employees' },
          { label: 'Registered Students', value: counts.students, href: '/dashboard/students' },
          { label: 'Products / Programs', value: counts.products, href: '/dashboard/students' },
          { label: 'Docked Plugins', value: counts.plugins, href: '/dashboard/plugins' },
        ].map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-brand-400 transition"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{c.value}</div>
          </Link>
        ))}
      </div>

      {/* Google Drive & Two-Way Sheets Status Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Google Drive Auto-Folder &amp; Two-Way Sheets Sync</h2>
            {conn ? (
              <p className="mt-1 text-sm text-emerald-700">
                Connected to <strong>{conn.googleEmail}</strong> · Folder:{' '}
                <strong>{conn.driveFolderName}</strong> · Two-Way Sync:{' '}
                <strong>{conn.twoWayEnabled ? 'ENABLED' : 'ONE-WAY'}</strong>
              </p>
            ) : (
              <p className="mt-1 text-sm text-amber-700">
                Not connected yet. Connect your Google account to auto-create your Organization&apos;s Drive folder and Sheets mirror.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {conn?.driveFolderUrl && (
              <a
                href={conn.driveFolderUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open Drive Folder ↗
              </a>
            )}
            <Link
              href="/dashboard/sheets"
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Manage Two-Way Sync
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
