'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { getResponseErrorMessage } from '@/lib/error-handler';

type LoginFormState = {
  email: string;
  password: string;
};

const initialForm: LoginFormState = {
  email: '',
  password: '',
};

const inputClassName =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-700 focus:ring-2 focus:ring-slate-200';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<LoginFormState>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const validationMessage = useMemo(() => {
    if (!form.email.includes('@')) {
      return 'Please enter a valid email address.';
    }

    if (form.password.length < 6) {
      return 'Password must be at least 6 characters.';
    }

    return '';
  }, [form.email, form.password]);

  const isSubmitDisabled = isSubmitting || Boolean(validationMessage);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(getResponseErrorMessage(payload, 'Login failed'));
      }

      router.replace('/todos');
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-[calc(100vh-73px)] items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Welcome Back</h1>
          <p className="text-sm text-slate-500">Login to continue managing your todos.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              className={inputClassName}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              className={inputClassName}
              placeholder="Minimum 6 characters"
              autoComplete="current-password"
            />
          </div>

          {(errorMessage || validationMessage) && (
            <p className="text-sm text-red-600">{errorMessage || validationMessage}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-600">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-medium text-slate-900 underline-offset-2 hover:underline">
            Signup
          </Link>
        </p>
      </section>
    </main>
  );
}
