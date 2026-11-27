'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export default function SheetsSyncPage() {
  const [status, setStatus] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => apiFetch<any>('/core/sheets/status').then(setStatus).catch(() => {});

  useEffect(() => {
    load();
  }, []);

  async function handleConnectGoogle() {
    const { url } = await apiFetch<{ url: string }>('/core/sheets/oauth/url');
    window.location.href = url;
  }

  async function handlePushSync() {
    setBusy(true);
    setMsg('');
    try {
      const res = await apiFetch<any>('/core/sheets/resync', { method: 'POST' });
      setMsg(`DB -> Google Sheets synced (${res.synced} tabs) at ${res.syncedAt}`);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePullTwoWay() {
    setBusy(true);
    setMsg('');
    try {
      const res = await apiFetch<any>('/core/sheets/pull-sync', { method: 'POST' });
      setMsg(`Two-Way Sync (Sheets -> DB) complete: ${res.applied} valid edits applied, ${res.errors} invalid edits reverted.`);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Google Drive Folder &amp; Two-Way Sheets Sync</h1>
          <p className="text-sm text-slate-500">
            PostgreSQL is always the source of truth. Every Core &amp; Plugin table mirrors to your Organization&apos;s Google Drive folder.
          </p>
        </div>
        <button
          onClick={handleConnectGoogle}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {status?.connected ? 'Reconnect Google Account' : 'Connect Google Drive Account'}
        </button>
      </div>

      {msg && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">{msg}</div>
      )}

      {status?.connection && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Connected Google Account</div>
              <div className="text-base font-bold text-slate-900">{status.connection.googleEmail}</div>
              <div className="text-xs text-slate-500">
                Drive Folder: <strong>{status.connection.driveFolderName}</strong>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {status.connection.driveFolderUrl && (
                <a
                  href={status.connection.driveFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  Open Drive Folder ↗
                </a>
              )}
              <button
                disabled={busy}
                onClick={handlePushSync}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Push DB → Sheets Now
              </button>
              <button
                disabled={busy}
                onClick={handlePullTwoWay}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Pull Two-Way Sync (Sheets → DB)
              </button>
            </div>
          </div>

          {/* Mapped Spreadsheets & Tabs */}
          <div className="overflow-x-auto pt-2">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Module</th>
                  <th className="py-2 pr-4">Spreadsheet</th>
                  <th className="py-2 pr-4">Tab</th>
                  <th className="py-2 pr-4">Two-Way Editable Columns</th>
                  <th className="py-2">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(status.mappings || []).map((m: any) => (
                  <tr key={m.id}>
                    <td className="py-2.5 pr-4 font-semibold uppercase text-xs">{m.moduleKey}</td>
                    <td className="py-2.5 pr-4">{m.spreadsheetName}</td>
                    <td className="py-2.5 pr-4 font-medium">{m.tabName}</td>
                    <td className="py-2.5 pr-4 text-xs text-slate-600">
                      {(m.editableCols || []).length ? m.editableCols.join(', ') : 'Read-only mirror'}
                    </td>
                    <td className="py-2.5">
                      <a
                        href={m.spreadsheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-brand-600 hover:underline"
                      >
                        Open Sheet ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sync Errors Log */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Two-Way Sync Validation Errors (Auto-Reverted)</h2>
        {(status?.recentErrors || []).length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No sync errors recorded. All sheets are clean.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-xs">
            {status.recentErrors.map((e: any) => (
              <li key={e.id} className="rounded-lg bg-amber-50 p-2.5 text-amber-900 border border-amber-200">
                <strong>{e.tabName} Row {e.rowNumber}</strong> ({e.recordKey}): {e.reason} — by {e.editorEmail}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
