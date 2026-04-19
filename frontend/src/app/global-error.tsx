'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 p-6 text-slate-900 antialiased">
        <main className="mx-auto mt-10 w-full max-w-2xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-red-700">A critical error occurred</h1>
          <p className="mt-2 text-sm text-slate-600">
            The app hit an unrecoverable error. Please retry.
          </p>
          <p className="mt-1 text-xs text-slate-500">{error.message || 'Unexpected server crash'}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Reload app
          </button>
        </main>
      </body>
    </html>
  );
}
