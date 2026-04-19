'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useAuth } from '@root/context/AuthContext';

type AuthIdentity = {
  displayName: string | null;
  email: string | null;
};

const getAuthIdentity = (user: Record<string, unknown> | null): AuthIdentity => {
  if (!user) {
    return {
      displayName: null,
      email: null,
    };
  }

  const username = typeof user.username === 'string' ? user.username : null;
  const email = typeof user.email === 'string' ? user.email : null;

  return {
    displayName: username ?? email,
    email,
  };
};

const navButtonClassName =
  'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';

export default function Navbar() {
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const identity = useMemo(() => getAuthIdentity(user as Record<string, unknown> | null), [user]);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between p-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
          Todo App
        </Link>

        {!isAuthenticated ? (
          <nav className="flex items-center gap-2" aria-label="Auth navigation">
            <Link
              href="/signin"
              className={`${navButtonClassName} border border-slate-300 text-slate-700 hover:bg-slate-100 ${
                pathname === '/signin' || pathname === '/login' ? 'bg-slate-100' : ''
              }`}
            >
              Login
            </Link>
            <Link
              href="/signup"
              className={`${navButtonClassName} bg-slate-900 text-white hover:bg-slate-800 ${
                pathname === '/signup' ? 'bg-slate-800' : ''
              }`}
            >
              Sign Up
            </Link>
          </nav>
        ) : (
          <div className="flex items-center gap-3">
            {identity.displayName && (
              <div className="hidden text-right sm:block">
                <p className="max-w-[180px] truncate text-sm font-medium text-slate-800">{identity.displayName}</p>
                {identity.email && <p className="max-w-[180px] truncate text-xs text-slate-500">{identity.email}</p>}
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
