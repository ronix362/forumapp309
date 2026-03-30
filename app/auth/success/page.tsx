/* Success Page required for google OAuth flow.
When Google finishes the login, it will send the user here:
http://localhost:3000/auth/success?accessToken=...&refreshToken=...
This page will grab those tokens, save them to localStorage, and then redirect the user to the homepage.*/ 
'use client';

'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// 1. Move all the logic into a "Client Component" sub-component
function AuthSuccessHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');

    if (accessToken && refreshToken) {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      router.replace('/');
    } else {
      router.replace('/login?error=missing_tokens');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-gray-600 dark:text-gray-300 font-bold animate-pulse">
        Completing secure login...
      </p>
    </div>
  );
}

// 2. The main page export MUST wrap the handler in Suspense
export default function AuthSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading session...</p>
      </div>
    }>
      <AuthSuccessHandler />
    </Suspense>
  );
}