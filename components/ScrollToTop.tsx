'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    // Strictly force the window to the top-left corner
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant', // Use 'instant' to prevent the user seeing the scroll move
    });
  }, [pathname]);

  return null;
}