'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, saveSession } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    legalName: '',
    phone: '+91',
    gstin: '',
    address: '',
    sessionCode: '2026-27',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    autoConnectGoogleDrive: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleLaunch(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await apiFetch<any>('/core/organizations/setup', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      saveSession(data);
      router.push('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            Mandatory SaaS Onboarding
          </span>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Set Up Your Organization</h1>
          <p className="mt-1 text-sm text-slate-500">
            Welcome {user?.fullName || ''}! Configure your company profile, active session, and Google Drive Sheets folder to unlock all Company OS Core features.
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-8 grid grid-cols-3 gap-2">
          {[
            { n: 1, label: '1. Company Profile' },
            { n: 2, label: '2. Session & Region' },
            { n: 3, label: '3. Google Drive & Launch' },
          ].map((s) => (
            <button
              key={s.n}
              type="button"
              onClick={() => setStep(s.n)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                step === s.n
                  ? 'bg-brand-600 text-white'
                  : step > s.n
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleLaunch} className="space-y-5">
          {step === 1 && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Organization / Company Name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. The Prime Classes"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Legal Entity Name</label>
                  <input
                    value={form.legalName}
                    onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                    placeholder="e.g. Prime EdTech Pvt Ltd"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Official Phone *</label>
                  <input
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+919876543210"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">GSTIN (Optional)</label>
                  <input
                    value={form.gstin}
                    onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                    placeholder="23XXXXX1234Z1Z5"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">City / Address</label>
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Gwalior, Madhya Pradesh"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!form.name.trim()}
                  className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
                >
                  Next: Session &amp; Region →
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Active Session</label>
                  <input
                    value={form.sessionCode}
                    onChange={(e) => setForm({ ...form, sessionCode: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Timezone</label>
                  <input
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Currency</label>
                  <input
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600 border border-slate-200">
                <p className="font-semibold text-slate-800">What Core auto-provisions for you:</p>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>Unique Organization Tenant ID (<code>TEN-XXXX</code>) with PostgreSQL RLS isolation</li>
                  <li>Founding Super Admin Employee ID (<code>EMP-0001</code>) &amp; Default Departments</li>
                  <li>Super Admin Role, Permission Clusters, and Core + Personal Workspaces</li>
                </ul>
              </div>
              <div className="flex justify-between">
                <button type="button" onClick={() => setStep(1)} className="text-sm font-medium text-slate-600">
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Next: Google Drive Sync →
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <h3 className="text-sm font-bold text-emerald-900">
                  Automatic Google Drive Folder &amp; Two-Way Sheets Sync
                </h3>
                <p className="mt-1 text-xs text-emerald-800">
                  {user?.hasGoogleConnected
                    ? `Your logged-in Google account (${user.email}) is already authorized! Launching will immediately create "Company OS Data – ${form.name || 'Your Org'}" in your Drive with Two-Way Sync enabled.`
                    : 'You signed up with Email/Password. Launch your Organization now, then click "Connect Google Drive" inside Core -> Google Sheets Sync to create your Drive folder.'}
                </p>
                <label className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-900">
                  <input
                    type="checkbox"
                    checked={form.autoConnectGoogleDrive}
                    onChange={(e) =>
                      setForm({ ...form, autoConnectGoogleDrive: e.target.checked })
                    }
                  />
                  Auto-create Drive Folder &amp; Core Data {form.sessionCode} Spreadsheet on launch
                </label>
              </div>

              <div className="flex justify-between pt-2">
                <button type="button" onClick={() => setStep(2)} className="text-sm font-medium text-slate-600">
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy ? 'Provisioning Organization OS...' : 'Complete Setup & Unlock Company OS'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
