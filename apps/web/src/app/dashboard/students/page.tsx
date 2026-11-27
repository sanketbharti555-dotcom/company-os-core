'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export default function StudentsProductsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [stuForm, setStuForm] = useState({ fullName: '', phone: '+91', guardianName: '' });
  const [prdForm, setPrdForm] = useState({ name: '', mode: 'OFFLINE', priceInr: '15000' });

  const load = () => {
    apiFetch<any[]>('/core/students').then(setStudents).catch(() => {});
    apiFetch<any[]>('/core/products').then(setProducts).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch('/core/students', { method: 'POST', body: JSON.stringify(stuForm) });
    setStuForm({ fullName: '', phone: '+91', guardianName: '' });
    load();
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch('/core/products', {
      method: 'POST',
      body: JSON.stringify({ ...prdForm, priceInr: Number(prdForm.priceInr) }),
    });
    setPrdForm({ name: '', mode: 'OFFLINE', priceInr: '15000' });
    load();
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Core Student Registry (Sync STU-ID)</h1>
        <form onSubmit={addStudent} className="grid grid-cols-1 gap-3 rounded-xl border bg-white p-4 sm:grid-cols-4">
          <input required placeholder="Student Full Name" value={stuForm.fullName} onChange={(e) => setStuForm({ ...stuForm, fullName: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          <input required placeholder="Phone (+91...)" value={stuForm.phone} onChange={(e) => setStuForm({ ...stuForm, phone: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          <input placeholder="Guardian Name" value={stuForm.guardianName} onChange={(e) => setStuForm({ ...stuForm, guardianName: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Register Student</button>
        </form>
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="p-3">Student ID</th><th className="p-3">Name</th><th className="p-3">Phone</th><th className="p-3">Guardian</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody className="divide-y">
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="p-3 font-mono text-xs font-bold">{s.code}</td>
                  <td className="p-3">{s.fullName}</td>
                  <td className="p-3">{s.phone}</td>
                  <td className="p-3">{s.guardianName || '-'}</td>
                  <td className="p-3 text-xs font-semibold text-brand-700">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Product / Program Master</h2>
        <form onSubmit={addProduct} className="grid grid-cols-1 gap-3 rounded-xl border bg-white p-4 sm:grid-cols-4">
          <input required placeholder="Product / Course Name" value={prdForm.name} onChange={(e) => setPrdForm({ ...prdForm, name: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          <select value={prdForm.mode} onChange={(e) => setPrdForm({ ...prdForm, mode: e.target.value })} className="rounded-lg border px-3 py-2 text-sm">
            <option value="OFFLINE">OFFLINE</option>
            <option value="ONLINE">ONLINE</option>
            <option value="HYBRID">HYBRID</option>
          </select>
          <input type="number" placeholder="Price (INR)" value={prdForm.priceInr} onChange={(e) => setPrdForm({ ...prdForm, priceInr: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Add Product</button>
        </form>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-xl border bg-white p-4">
              <div className="text-xs font-mono text-slate-400">{p.code} · {p.mode}</div>
              <div className="mt-1 font-bold text-slate-900">{p.name}</div>
              <div className="mt-1 text-sm font-semibold text-emerald-700">₹{(Number(p.pricePaise) / 100).toLocaleString('en-IN')}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
