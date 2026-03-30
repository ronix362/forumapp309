'use client';

import { Suspense } from 'react'; // 1. Add this import
import LoginForm from "@/components/Auth/LoginForm";

// 2. Wrap your existing UI in a separate component
function LoginContent() {
  const handleGoogleLogin = () => {
    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = new URLSearchParams({
      redirect_uri: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI as string,
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID as string,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
    });

    window.location.href = `${rootUrl}?${options.toString()}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="max-w-md w-full p-8 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
        <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white mb-8">
          Welcome Back
        </h2>

        <LoginForm />

        <div className="mt-6 flex items-center justify-center space-x-3">
          <span className="h-px w-full bg-gray-200 dark:bg-gray-700"></span>
          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Or</span>
          <span className="h-px w-full bg-gray-200 dark:bg-gray-700"></span>
        </div>

        <button 
          onClick={handleGoogleLogin}
          type="button"
          className="mt-6 w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm active:scale-[0.98]"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>

        <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          Don't have an account?{' '}
          <a href="/signup" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Sign up</a>
        </p>
      </div>
    </div>
  );
}

// 3. The final exported page MUST use Suspense
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}