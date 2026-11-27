'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export default function RbacPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [delegations, setDelegations] = useState<any[]>([]);

  useEffect(() => {
    apiFetch<any[]>('/core/roles').then(setRoles).catch(() => {});
    apiFetch<any[]>('/core/workspaces').then(setWorkspaces).catch(() => {});
    apiFetch<any[]>('/core/delegations').then(setDelegations).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Roles, Workspaces (Skins) &amp; Attorney Delegation</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <h2 className="font-bold text-slate-900 mb-3">Organization Roles</h2>
          <div className="space-y-2">
            {roles.map((r) => (
              <div key={r.id} className="rounded-lg border p-3">
                <div className="font-semibold text-sm">{r.name}</div>
                <div className="text-xs text-slate-500">{r.description}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <h2 className="font-bold text-slate-900 mb-3">Active Workspaces (Skins)</h2>
          <div className="space-y-2">
            {workspaces.map((w) => (
              <div key={w.id} className="rounded-lg border p-3 flex justify-between items-center">
                <div>
                  <div className="font-semibold text-sm">{w.name}</div>
                  <div className="text-xs text-slate-400">Key: {w.key} · Module: {w.moduleKey}</div>
                </div>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">Active</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5">
        <h2 className="font-bold text-slate-900 mb-2">Active Attorney Delegations (Rule: Delegated &le; Giver)</h2>
        {delegations.length === 0 ? (
          <p className="text-xs text-slate-500">No active delegations yet.</p>
        ) : (
          <pre className="text-xs bg-slate-50 p-3 rounded">{JSON.stringify(delegations, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
