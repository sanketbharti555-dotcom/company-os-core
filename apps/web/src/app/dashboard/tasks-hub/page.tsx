'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export default function TasksHubPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [targetValue, setTargetValue] = useState('10');

  const load = () => apiFetch<any[]>('/core/tasks').then(setTasks).catch(() => {});
  useEffect(() => { load(); }, []);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch('/core/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, targetValue: Number(targetValue) }),
    });
    setTitle('');
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Single Task Engine, KRA/KPI &amp; Daily Operation Hub</h1>
      <form onSubmit={addTask} className="grid grid-cols-1 gap-3 rounded-xl border bg-white p-4 sm:grid-cols-3">
        <input required placeholder="Task Title (e.g. Daily 50 Sales Calls)" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
        <input type="number" placeholder="Target" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Create Core Task</button>
      </form>
      <div className="rounded-xl border bg-white divide-y">
        {tasks.map((t) => (
          <div key={t.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              <div className="font-semibold text-slate-900">{t.title}</div>
              <div className="text-xs text-slate-500">
                Source: {t.source} · Target: {t.targetValue} · Actual: {t.actualValue}
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{t.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
