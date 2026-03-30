'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '', email: '', password: '', avatarId: '', favoriteTeamId: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // NEW: State to track password visibility
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- 1. TRADITIONAL SIGNUP HANDLER ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/users/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          favoriteTeamId: formData.favoriteTeamId ? parseInt(formData.favoriteTeamId) : null
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');
      router.push('/login?registered=true');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 2. GOOGLE SIGNUP HANDLER ---
  const handleGoogleSignup = () => {
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
    <div className="w-full">
      {/* --- STANDARD FORM --- */}
      <form className="space-y-5" onSubmit={handleSubmit}>
        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm rounded border-l-4 border-red-500">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <input 
            name="username" 
            type="text" 
            placeholder="Username" 
            required 
            onChange={handleChange} 
            className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
          />
          <input 
            name="email" 
            type="email" 
            placeholder="Email" 
            required 
            onChange={handleChange} 
            className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
          />
          
          {/* CHANGED: Password Input with Toggle */}
          <div className="relative">
            <input 
              name="password" 
              // Toggle input type based on state
              type={showPassword ? 'text' : 'password'} 
              placeholder="Password" 
              required 
              onChange={handleChange} 
              // Added pr-10 to make room for the icon
              className="w-full p-2 pr-10 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button type="submit" disabled={isLoading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition-colors disabled:opacity-50">
          {isLoading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>

      {/* --- OR DIVIDER --- */}
      <div className="mt-6 flex items-center justify-center space-x-3">
        <span className="h-px w-full bg-gray-200 dark:bg-gray-700"></span>
        <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Or
        </span>
        <span className="h-px w-full bg-gray-200 dark:bg-gray-700"></span>
      </div>

      {/* --- GOOGLE BUTTON --- */}
      <button 
        onClick={handleGoogleSignup}
        type="button"
        className="mt-6 w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm active:scale-[0.98]"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Sign up with Google
      </button>
    </div>
  );
}