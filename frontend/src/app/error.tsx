'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App route error boundary:', error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl py-12">
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-red-800">Something went wrong</h1>
        <p className="mt-2 text-sm text-red-700">
          We hit an unexpected error while rendering this page.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Go home
          </Link>
        </div>
      </section>
    </main>
  );
}
