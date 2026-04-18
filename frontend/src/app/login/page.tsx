'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

const TOKEN_KEY = 'token';

type LoginResponse = {
  jwt?: string;
  error?: {
    message?: string;
  };
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_KEY);

    if (token) {
      router.replace('/');
    }
  }, [router]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await apiFetch('/api/auth/local', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: email,
          password: password,
        }),
      });

      const data = (await res.json()) as LoginResponse;

      if (!res.ok || !data.jwt) {
        setErrorMessage(data.error?.message ?? 'Login failed');
        return;
      }

      window.localStorage.setItem(TOKEN_KEY, data.jwt);
      console.log('TOKEN SAVED:', data.jwt);
      router.replace('/');
    } catch {
      setErrorMessage('Unable to login right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="bg-gray-50 min-h-screen flex justify-center items-start pt-10 px-4">
      <section className="max-w-md w-full bg-white shadow-md rounded-xl p-6 space-y-4">
        <h1 className="text-xl font-semibold">Login</h1>

        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="border rounded-lg px-3 py-2 w-full"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="border rounded-lg px-3 py-2 w-full"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-black text-white rounded-lg px-4 py-2 w-full"
          >
            {isSubmitting ? 'Signing in...' : 'Login'}
          </button>
        </form>

        {errorMessage ? <p className="text-red-600">{errorMessage}</p> : null}
      </section>
    </main>
  );
}
