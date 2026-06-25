'use client';

import { useEffect, useRef } from 'react';

/** One-shot fetch to set the httpOnly age-verification cache cookie via Route Handler. */
export const AgeCacheWarmer = () => {
  const warmed = useRef(false);

  useEffect(() => {
    if (warmed.current) return;
    warmed.current = true;
    void fetch('/api/safety/age-cache-sync', { cache: 'no-store' }).catch(() => {
      warmed.current = false;
    });
  }, []);

  return null;
};