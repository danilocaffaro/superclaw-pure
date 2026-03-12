'use client';

import { useState, useEffect } from 'react';

export function useIsMobile(breakpoint = 768): boolean {
  // SSR-safe: default to mobile-first to avoid flash of desktop layout on phones
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);

  return isMobile;
}
