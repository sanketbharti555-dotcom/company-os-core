'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '+91', designation: '', roleTags: 'Sales' });
  const [error, setError] = useState('');

  const load = () => apiFetch<any[]>('/core/employees').then(setEmployees).catch(() => {});
  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/core/employees', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          roleTags: form.roleTags.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      setForm({ fullName: '', email: '', phone: '+91', designation: '', roleTags: 'Sales' });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Employee Master (Single Source for All Modules)</h1>

      <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-800">Add Employee (Auto-generates EMP-XXXX &amp; Syncs to Sheets)</h2>
        {error && <div className="mb-3 text-xs text-red-600">{error}</div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <input required placeholder="Full Name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          <input required placeholder="+919876543210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          <input placeholder="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Add Employee</button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Emp ID</th>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Role Tags</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td className="p-3 font-mono text-xs font-bold">{emp.code}</td>
                <td className="p-3 font-medium">{emp.fullName}</td>
                <td className="p-3 text-slate-600">{emp.email}</td>
                <td className="p-3 text-slate-600">{emp.phone}</td>
                <td className="p-3 text-xs">{(emp.roleTags || []).join(', ')}</td>
                <td className="p-3">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">{emp.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
