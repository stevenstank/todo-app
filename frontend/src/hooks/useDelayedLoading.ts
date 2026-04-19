'use client';

import { useEffect, useRef, useState } from 'react';

type UseDelayedLoadingOptions = {
  delayMs?: number;
  minVisibleMs?: number;
};

export default function useDelayedLoading(
  isLoading: boolean,
  options: UseDelayedLoadingOptions = {}
): boolean {
  const { delayMs = 120, minVisibleMs = 280 } = options;
  const [isVisible, setIsVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (isLoading) {
      showTimerRef.current = setTimeout(() => {
        shownAtRef.current = Date.now();
        setIsVisible(true);
      }, delayMs);

      return;
    }

    if (!isVisible) {
      setIsVisible(false);
      shownAtRef.current = null;
      return;
    }

    const shownAt = shownAtRef.current ?? Date.now();
    const elapsed = Date.now() - shownAt;
    const remaining = Math.max(minVisibleMs - elapsed, 0);

    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      shownAtRef.current = null;
    }, remaining);
  }, [delayMs, isLoading, isVisible, minVisibleMs]);

  useEffect(
    () => () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
      }

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    },
    []
  );

  return isVisible;
}
