'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const parseJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(window.atob(base64).split('').map((c) => 
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join('')));
  } catch (e) { return null; }
};

type Appeal = {
  id: number;
  content: string;
  status: string;
  userId: number;
  createdAt: string;
};

export default function AdminAppealsPage() {
  const router = useRouter();
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Added page state to satisfy your backend requirement
  const [page, setPage] = useState(1);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
      return;
    }

    const decoded = parseJwt(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      router.push('/'); 
      return;
    }

    const fetchAppeals = async () => {
      setIsLoading(true);
      try {
        // Updated URL to include the page parameter
        const res = await fetch(`/api/users/appeals?page=${page}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Failed to fetch appeals');
        
        setAppeals(data.appeals || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAppeals();
  }, [router, page]); // Re-fetch when the page changes

  const handleAppealAction = async (appealId: number, status: 'APPROVED' | 'DENIED') => {
    if (!confirm(`Are you sure you want to ${status} this appeal?`)) return;

    try {
      const token = localStorage.getItem('accessToken');
      
      const res = await fetch(`/api/users/appeals/${appealId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status }) 
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `Failed to ${status} appeal`);

      setAppeals((prev) => prev.filter((appeal) => appeal.id !== appealId));
      alert(`Appeal ${status} successfully!`);

    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4 transition-colors duration-200">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Review user account suspensions and appeals.</p>
          </div>
          <span className="bg-indigo-100 text-indigo-800 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full dark:bg-indigo-900/30 dark:text-indigo-400">
            Admin Mode
          </span>
        </div>

        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded-xl font-medium shadow-sm">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : appeals.length === 0 && !error ? (
          <div className="bg-white dark:bg-gray-800 p-16 text-center rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <span className="text-5xl block mb-4 opacity-50">🎉</span>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">No Pending Appeals</h3>
            <p className="text-gray-500 mt-2">All caught up! There are no banned users appealing on this page.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {appeals.map((appeal) => (
              <div key={appeal.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg text-gray-900 dark:text-white">
                      User ID: #{appeal.userId}
                    </span>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm">
                    {appeal.content}
                  </div>
                </div>

                <div className="flex flex-col gap-3 min-w-[140px] shrink-0">
                  <button 
                    onClick={() => handleAppealAction(appeal.id, 'APPROVED')}
                    className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
                  >
                    Approve (Unban)
                  </button>
                  <button 
                    onClick={() => handleAppealAction(appeal.id, 'DENIED')}
                    className="w-full py-2 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 font-bold rounded-xl transition-all active:scale-95"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        <div className="flex justify-between items-center pt-6">
          <button 
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50 dark:text-white"
          >
            &larr; Previous Page
          </button>
          <span className="text-sm text-gray-500 font-bold">Page {page}</span>
          <button 
            disabled={appeals.length < 10}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50 dark:text-white"
          >
            Next Page &rarr;
          </button>
        </div>

      </div>
    </div>
  );
}