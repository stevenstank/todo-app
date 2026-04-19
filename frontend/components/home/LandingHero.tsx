'use client';

import Link from 'next/link';
import { useAuth } from '@root/context/AuthContext';

const features = [
  'Secure authentication',
  'Create, update, delete todos',
  'Private user-specific tasks',
  'Persistent data',
];

const primaryButtonClassName =
  'inline-flex min-w-[150px] items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500';

const secondaryButtonClassName =
  'inline-flex min-w-[150px] items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';

export default function LandingHero() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="flex min-h-[calc(100vh-160px)] items-center">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <h1 className="text-center text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Todo App</h1>

          <p className="mx-auto mt-4 max-w-2xl text-center text-base leading-relaxed text-slate-600 sm:text-lg">
            Stay focused with a simple and secure todo app that helps you manage daily tasks without clutter.
          </p>

          <ul className="mx-auto mt-8 max-w-xl list-disc space-y-2 pl-5 text-slate-700 marker:text-slate-400">
            {features.map((feature) => (
              <li key={feature} className="text-sm leading-6 sm:text-base">
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {isAuthenticated ? (
              <Link href="/dashboard" className={primaryButtonClassName}>
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link href="/signin" className={primaryButtonClassName}>
                  Login
                </Link>
                <Link href="/signup" className={secondaryButtonClassName}>
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
