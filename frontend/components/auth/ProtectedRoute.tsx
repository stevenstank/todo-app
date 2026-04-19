'use client';

import { ReactNode } from 'react';
import Loader from '@root/components/ui/Loader';
import { useRequireAuth } from '@root/context/useRequireAuth';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isCheckingAuth } = useRequireAuth();

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
        <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
          <Loader size="sm" className="text-slate-500" />
          <span>Checking authentication...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
