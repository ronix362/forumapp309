'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AppealPage() {
  const router = useRouter();
  
  // CHANGED: Renamed 'reason' to 'content' to match your backend expectation
  const [content, setContent] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // CHANGED: Lowered the minimum length to 10 characters
    if (content.trim().length < 10) {
      setMessage({ text: 'Please provide a more detailed explanation (at least 10 characters).', type: 'error' });
      return;
    }

    setIsLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const token = localStorage.getItem('accessToken');
      
      const res = await fetch('/api/users/appeals', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        // CHANGED: Now sending { content } instead of { reason }
        body: JSON.stringify({ content })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit appeal');
      }

      setMessage({ text: 'Your appeal has been successfully submitted. Our moderation team will review it shortly.', type: 'success' });
      setContent(''); 
      
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors p-4">
      <div className="max-w-xl w-full bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner">
            ⚖️
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Account Appeal
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
            If you believe your account was suspended in error, please explain the situation below.
          </p>
        </div>

        {message.text && (
          <div className={`p-4 mb-6 text-sm rounded-xl border-l-4 font-medium transition-all ${
            message.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-500' 
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-500'
          }`}>
            {message.text}
          </div>
        )}

        {message.type !== 'success' ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="content" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Reason for Appeal
              </label>
              <textarea
                id="content"
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Please explain why you think the suspension should be lifted..."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white transition-all resize-none"
              ></textarea>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500">Minimum 10 characters</span>
                <span className={`text-xs ${content.length < 10 ? 'text-red-500' : 'text-gray-400'}`}>
                  {content.length} / 500 characters
                </span>
              </div>
            </div>

            <div className="flex gap-4">
              <Link 
                href="/"
                className="w-1/3 py-3 text-center text-gray-600 dark:text-gray-300 font-bold bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isLoading}
                className="w-2/3 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg transform active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Submitting...' : 'Submit Appeal'}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center">
            <Link 
              href="/"
              className="inline-block mt-4 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Return to Home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}