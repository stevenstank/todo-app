'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import TopLoadingBar from '@root/components/ui/TopLoadingBar';
import useDelayedLoading from '@/hooks/useDelayedLoading';

export default function RouteProgress() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const previousKeyRef = useRef('');

  useEffect(() => {
    const key = pathname ?? '';

    if (!previousKeyRef.current) {
      previousKeyRef.current = key;
      return;
    }

    if (previousKeyRef.current === key) {
      return;
    }

    previousKeyRef.current = key;
    setIsNavigating(true);

    const doneTimer = setTimeout(() => {
      setIsNavigating(false);
    }, 220);

    return () => clearTimeout(doneTimer);
  }, [pathname]);

  const showBar = useDelayedLoading(isNavigating, {
    delayMs: 80,
    minVisibleMs: 240,
  });

  return <TopLoadingBar active={showBar} />;
}
