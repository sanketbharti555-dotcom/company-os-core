'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { TrialBanner } from '@/components/TrialBanner';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Core Overview' },
  { href: '/dashboard/sheets', label: 'Google Drive & 2-Way Sheets' },
  { href: '/dashboard/employees', label: 'Employees & Depts' },
  { href: '/dashboard/students', label: 'Students & Products' },
  { href: '/dashboard/rbac', label: 'Roles & Delegation' },
  { href: '/dashboard/tasks-hub', label: 'Tasks, KRA/KPI & Hub' },
  { href: '/dashboard/app-store', label: 'App Store (1-Click Modules)' },
  { href: '/dashboard/plugins', label: 'Developer Docking & Tokens' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, activeOrg, organizations, switchOrg, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-slate-900 text-slate-100 md:flex">
        <div className="border-b border-slate-800 p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 font-bold text-white">
              OS
            </div>
            <div>
              <div className="text-sm font-bold leading-tight">{activeOrg?.name || 'Company OS'}</div>
              <div className="text-[11px] text-slate-400">
                {activeOrg?.code} · {activeOrg?.employeeCode}
              </div>
            </div>
          </div>

          {/* Multi-Tenant Organization Switcher */}
          {organizations.length > 1 && (
            <select
              value={activeOrg?.id || ''}
              onChange={(e) => switchOrg(e.target.value)}
              className="mt-3 w-full rounded-md bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 border border-slate-700"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.code})
                </option>
              ))}
            </select>
          )}
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4 space-y-2">
          {user?.isPlatformAdmin && (
            <Link
              href="/platform-admin"
              className="block rounded-lg bg-amber-500 px-3 py-2 text-center text-xs font-bold text-slate-950 hover:bg-amber-400"
            >
              SaaS Platform Control Panel
            </Link>
          )}
          <Link
            href="/onboarding"
            className="block rounded-lg border border-slate-700 px-3 py-1.5 text-center text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            + Create Another Organization
          </Link>
          <div className="flex items-center justify-between pt-1">
            <span className="truncate text-xs text-slate-400">{user?.email}</span>
            <button onClick={logout} className="text-xs font-semibold text-rose-400 hover:underline">
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TrialBanner />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
