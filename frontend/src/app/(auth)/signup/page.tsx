'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { useAuth } from '@root/context/AuthContext';
import AuthField from '@root/components/auth/AuthField';
import AuthFormCard from '@root/components/auth/AuthFormCard';
import AuthSubmitButton from '@root/components/auth/AuthSubmitButton';
import FormMessage from '@root/components/auth/FormMessage';
import GuestOnlyGate from '@root/components/auth/GuestOnlyGate';
import PasswordField from '@root/components/auth/PasswordField';

type SignupFormState = {
  username: string;
  email: string;
  password: string;
};

const initialForm: SignupFormState = {
  username: '',
  email: '',
  password: '',
};

export default function SignupPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState<SignupFormState>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const validationMessage = useMemo(() => {
    if (!form.username.trim()) {
      return 'Username is required.';
    }

    if (!form.email.includes('@')) {
      return 'Please enter a valid email address.';
    }

    if (form.password.length < 6) {
      return 'Password must be at least 6 characters.';
    }

    return '';
  }, [form.username, form.email, form.password]);

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
      await register({
        username: form.username,
        email: form.email,
        password: form.password,
      });

      router.replace('/dashboard');
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GuestOnlyGate>
      <AuthFormCard
        title="Create Account"
        description="Set up your account and start organizing your tasks."
        footer={
          <p>
            Already have an account?{' '}
            <Link href="/signin" className="font-medium text-slate-900 underline-offset-2 hover:underline">
              Login
            </Link>
          </p>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <AuthField
            id="username"
            label="Username"
            type="text"
            value={form.username}
            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            placeholder="yourname"
            autoComplete="username"
          />

          <AuthField
            id="email"
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="you@example.com"
            autoComplete="email"
          />

          <PasswordField
            id="password"
            label="Password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            placeholder="Minimum 6 characters"
            autoComplete="new-password"
          />

          <FormMessage message={errorMessage || validationMessage} />

          <AuthSubmitButton
            label="Create Account"
            loadingLabel="Creating account..."
            isLoading={isSubmitting}
            disabled={isSubmitDisabled}
          />
        </form>
      </AuthFormCard>
    </GuestOnlyGate>
  );
}
