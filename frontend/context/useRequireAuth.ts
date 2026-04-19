'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@root/context/AuthContext';

export const useRequireAuth = () => {
  const router = useRouter();
  const { jwt, loading } = useAuth();

  useEffect(() => {
    if (!loading && !jwt) {
      router.replace('/login');
    }
  }, [loading, jwt, router]);

  return {
    isAuthenticated: Boolean(jwt),
    isCheckingAuth: loading || !jwt,
  };
};
