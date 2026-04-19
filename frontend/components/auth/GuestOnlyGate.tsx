'use client';

import Link from 'next/link';
import Loader from '@root/components/ui/Loader';
import AuthFormCard from '@root/components/auth/AuthFormCard';
import { useAuth } from '@root/context/AuthContext';

export default function GuestOnlyGate({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-[calc(100vh-73px)] items-center justify-center px-4 py-10">
        <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
          <Loader size="sm" className="text-slate-500" />
          <span>Checking authentication...</span>
        </div>
      </main>
    );
  }

  if (isAuthenticated) {
    return (
      <AuthFormCard
        title="You are already signed in"
        description="Your session is active. Continue to your dashboard to manage todos."
        footer={
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Go to Dashboard
          </Link>
        }
      >
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          You are already signed in
        </div>
      </AuthFormCard>
    );
  }

  return <>{children}</>;
}
