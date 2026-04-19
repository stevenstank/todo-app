"use client";

import { useRequireAuth } from '@root/context/useRequireAuth';

export default function TodosPage() {
  const { isCheckingAuth } = useRequireAuth();

  if (isCheckingAuth) {
    return <main className="py-10 text-sm text-slate-600">Loading...</main>;
  }

  return (
    <main className="py-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Todos</h1>
        <p className="mt-2 text-sm text-slate-600">You are logged in. Todo dashboard content will be added here.</p>
      </section>
    </main>
  );
}
