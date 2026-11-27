'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const SAMPLE_CRM_MANIFEST = {
  module: 'crm',
  name: 'CRM & Admissions Plugin',
  version: '1.0.0',
  contract: 'core-v1',
  workspaces: [{ key: 'crm_admin', label: 'CRM Admin', menus: ['dashboard', 'leads', 'payments'] }],
  sheets: [
    {
      spreadsheet: 'CRM Data',
      sheets: [
        { name: 'Leads', headers: ['lead_id', 'person_name', 'phone', 'stage', 'notes'], editableColumns: ['notes'] },
      ],
    },
  ],
};

export default function PluginsDockingPage() {
  const { activeOrg } = useAuth();
  const [data, setData] = useState<{ plugins: any[]; tokens: any[] }>({ plugins: [], tokens: [] });
  const [newToken, setNewToken] = useState<string | null>(null);
  const [moduleKey, setModuleKey] = useState('crm');
  const [label, setLabel] = useState('CRM Production Connector');

  const load = () => apiFetch<any>('/core/plugins').then(setData).catch(() => {});
  useEffect(() => { load(); }, []);

  async function installSampleCrm() {
    await apiFetch('/core/plugins/register', {
      method: 'POST',
      body: JSON.stringify(SAMPLE_CRM_MANIFEST),
    });
    load();
  }

  async function generateToken(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiFetch<any>('/core/plugins/tokens', {
      method: 'POST',
      body: JSON.stringify({
        moduleKey,
        label,
        scopes: ['core.employees.read', 'core.students.create', 'core.products.read', 'core.events.publish', 'core.sheets.write'],
        expiryDays: 90,
      }),
    });
    setNewToken(res.rawToken);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Plugin Docking Station &amp; Organization Connectors</h1>
          <p className="text-sm text-slate-500">
            Connect future modules (CRM, Academic, Finance, HRMS, Inventory, Growth, LMS) to <strong>{activeOrg?.name}</strong> without editing Core code.
          </p>
        </div>
        <button
          onClick={installSampleCrm}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Dock Sample CRM Plugin
        </button>
      </div>

      {/* Organization Connection Credentials Box */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 space-y-2">
        <h2 className="text-sm font-bold text-indigo-950">How Future Modules Connect to This Organization</h2>
        <p className="text-xs text-indigo-900">
          Pass these exact values into <code>@company-os/plugin-sdk</code> inside any future module (CRM, Academic, Finance). Core automatically enforces PostgreSQL RLS, Employee validation, Event Bus routing, and Google Drive Sheet mirroring for this Organization.
        </p>
        <div className="rounded-lg bg-slate-900 p-3 font-mono text-xs text-emerald-300 overflow-x-auto">
          ORG_TENANT_ID=&quot;{activeOrg?.id}&quot;{'\n'}
          ORG_TENANT_CODE=&quot;{activeOrg?.code}&quot;{'\n'}
          MODULE_TOKEN=&quot;{newToken || '<Generate a Scoped Module Token below>'}&quot;
        </div>
      </div>

      {/* Issue Scoped Module Token */}
      <form onSubmit={generateToken} className="rounded-xl border bg-white p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Generate Tenant-Scoped Module Token (90-Day Expiry)</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select value={moduleKey} onChange={(e) => setModuleKey(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
            <option value="crm">CRM Plugin</option>
            <option value="academic">Academic Plugin</option>
            <option value="finance">Finance Plugin</option>
            <option value="hrms">HRMS Plugin</option>
            <option value="inventory">Inventory Plugin</option>
            <option value="growth">Growth Plugin</option>
          </select>
          <input required value={label} onChange={(e) => setLabel(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Issue Scoped Token</button>
        </div>
        {newToken && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
            <strong>Copy now (shown only once):</strong> <code className="break-all font-mono">{newToken}</code>
          </div>
        )}
      </form>

      {/* Installed Plugins */}
      <div className="rounded-xl border bg-white p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Docked Plugins for {activeOrg?.name}</h2>
        {data.plugins.length === 0 ? (
          <p className="text-xs text-slate-500">No external plugins docked yet. Click &quot;Dock Sample CRM Plugin&quot; above to test auto-provisioning.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.plugins.map((p) => (
              <div key={p.id} className="rounded-lg border p-4 flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm">{p.name}</div>
                  <div className="text-xs text-slate-500">Module: {p.moduleKey} · v{p.version}</div>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{p.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
