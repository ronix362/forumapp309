'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
// 1. Import the avatar array from your context
import { AVAILABLE_AVATARS } from "@/contexts/ThemeContext";

type UserInfo = {
  id: number;
  username: string;
  role: string;
  avatarId?: number; // 2. Add avatarId to the type
};

export default function SearchUsersPage() {
  const [searchedUsers, setSearchedUsers] = useState<UserInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  useEffect(() => {
    const fetchSearchedUsers = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(debouncedQuery)}&page=${page}`);
        
        if (!res.ok) {
          throw new Error('Failed to load users');
        }

        const data = await res.json();
        setSearchedUsers(data.users || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.totalCount || 0);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSearchedUsers();
  }, [debouncedQuery, page]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#111827] py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="bg-white dark:bg-[#1f2937] p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Community
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                Discover and follow other fans. ({totalCount} total)
              </p>
            </div>
            
            <div className="relative w-full md:max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500 dark:text-gray-400">
                🔍
              </span>
              <input 
                type="text" 
                placeholder="Search by username..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-full py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl text-center font-medium border border-red-100">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-24">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : searchedUsers.length === 0 ? (
          <div className="bg-white dark:bg-[#1f2937] rounded-3xl p-16 text-center border border-gray-200 dark:border-gray-700">
            <span className="text-5xl block mb-4 opacity-50">👻</span>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No users found</h3>
            <p className="text-gray-500 dark:text-gray-400">We couldn't find anyone matching "{searchQuery}".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {searchedUsers.map((displayedUser) => (
              <Link 
                href={`/profile/${displayedUser.id}`}
                key={displayedUser.id}
                className="bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all group"
              >
                {/* 3. Updated Avatar Display: Replaced text initial with image */}
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-blue-100 dark:border-blue-900/30 mb-4 group-hover:scale-110 transition-transform shadow-sm">
                  <img 
                    src={AVAILABLE_AVATARS[displayedUser.avatarId || 0]} 
                    alt={displayedUser.username}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <span className="font-extrabold text-gray-900 dark:text-white text-lg truncate w-full px-2">
                  @{displayedUser.username}
                </span>

                {displayedUser.role === 'ADMIN' && (
                  <span className="mt-2 text-[10px] font-black uppercase tracking-widest text-white bg-indigo-500 px-3 py-1 rounded-full">
                    Admin
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}

        {!isLoading && totalPages > 1 && (
          <div className="flex justify-center items-center gap-6 pt-8">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-6 py-2 font-bold bg-white dark:bg-[#1f2937] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 transition-all shadow-sm"
            >
              &larr; Prev
            </button>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 font-mono">
              Page {page} of {totalPages}
            </span>
            <button 
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-6 py-2 font-bold bg-white dark:bg-[#1f2937] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 transition-all shadow-sm"
            >
              Next &rarr;
            </button>
          </div>
        )}

      </div>
    </div>
  );
}