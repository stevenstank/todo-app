'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@root/context/AuthContext';

export const useRequireAuth = () => {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/signin');
    }
  }, [loading, isAuthenticated, router]);

  return {
    isAuthenticated,
    isCheckingAuth: loading,
  };
};
