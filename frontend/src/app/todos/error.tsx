'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import ErrorNotice from '@root/components/ui/ErrorNotice';

export default function TodosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = error.message || 'An unexpected error occurred.';
  const normalized = message.toLowerCase();
  const isUnauthorized = normalized.includes('authentication required') || normalized.includes('unauthorized');
  const isNetwork = normalized.includes('offline') || normalized.includes('network') || normalized.includes('fetch');

  useEffect(() => {
    console.error('Todos route error boundary:', error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-3xl py-8">
      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
        {isUnauthorized ? (
          <div className="space-y-3">
            <ErrorNotice
              title="Session expired"
              message="Please sign in again to access your todos."
            />
            <Link
              href="/login"
              className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Go to login
            </Link>
          </div>
        ) : isNetwork ? (
          <ErrorNotice
            title="Network issue"
            message="We could not reach the server. Check your connection and retry."
            onRetry={reset}
            retryLabel="Retry"
          />
        ) : (
          <ErrorNotice
            title="Failed to load todos"
            message={message}
            onRetry={reset}
            retryLabel="Try again"
          />
        )}
      </section>
    </main>
  );
}
