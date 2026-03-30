'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AVAILABLE_AVATARS } from '@/contexts/ThemeContext';

type UserRef = {
  id: number;
  username: string;
  avatarId?: number;
};

type FollowRecord = {
  follower?: UserRef;
  following?: UserRef;
};

export default function FollowNetworkPage() {
  const params = useParams();
  const router = useRouter();
  
  // Initial states are perfectly predictable for both Server and Client
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>('followers');
  const [users, setUsers] = useState<FollowRecord[]>([]);
  const [otherListIds, setOtherListIds] = useState<Set<number>>(new Set());
  
  const [isLoading, setIsLoading] = useState(true); // Defaults to true
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // 1. BACKGROUND FETCH: Get IDs for mutual check
  useEffect(() => {
    const fetchOppositeIds = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const oppositeType = activeTab === 'followers' ? 'following' : 'followers';

      try {
        let allOppositeRecords: any[] = [];
        let currentOppositePage = 1;
        let totalOppositePages = 1;

        // FETCH ALL PAGES: We loop through every page of the opposite list 
        // to guarantee we don't miss mutuals who are hidden on page 2 or 3.
        do {
          const res = await fetch(`/api/users/${oppositeType}?page=${currentOppositePage}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (!res.ok) break;
          
          const data = await res.json();
          const list = oppositeType === 'followers' ? (data.followers || []) : (data.following || []);
          
          allOppositeRecords = [...allOppositeRecords, ...list];
          totalOppositePages = data.totalPages || 1;
          currentOppositePage++;
          
        } while (currentOppositePage <= totalOppositePages);

        // Extract IDs from the complete list
        const ids = new Set(allOppositeRecords.map((item: any) => 
          oppositeType === 'followers' ? item.follower?.id : item.following?.id
        ));
        
        setOtherListIds(ids as Set<number>);
      } catch (e) {
        console.error("Mutual check background fetch failed", e);
      }
    };
    
    fetchOppositeIds();
  }, [activeTab]);

  // 2. MAIN FETCH: Current Tab Data
  useEffect(() => {
    const fetchNetworkData = async () => {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setError("You must be logged in to view this.");
        setIsLoading(false);
        return;
      }

      const endpoint = activeTab === 'followers' 
        ? `/api/users/followers?page=${page}` 
        : `/api/users/following?page=${page}`;

      try {
        const res = await fetch(endpoint, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            router.push('/login');
            return;
          }
          throw new Error('Failed to load network data');
        }

        const data = await res.json();
        setUsers(activeTab === 'followers' ? (data.followers || []) : (data.following || []));
        setTotalPages(data.totalPages || 1);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNetworkData();
  }, [activeTab, page, router]);

  const handleAction = async (targetId: number) => {
    const token = localStorage.getItem('accessToken');
    const endpoint = activeTab === 'followers' ? '/api/users/followers' : '/api/users/following';
    const bodyKey = activeTab === 'followers' ? 'followerId' : 'followingId';

    try {
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ [bodyKey]: targetId })
      });
      if (res.ok) {
        setUsers(prev => prev.filter(u => 
          activeTab === 'followers' ? u.follower?.id !== targetId : u.following?.id !== targetId
        ));
      }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#111827] py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header & Tabs */}
        <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 text-center md:text-left">
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Network</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your connections</p>
          </div>
          
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => { setActiveTab('followers'); setPage(1); }}
              className={`flex-1 py-4 text-sm font-bold transition-all ${
                activeTab === 'followers' 
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' 
                  : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              Followers
            </button>
            <button
              onClick={() => { setActiveTab('following'); setPage(1); }}
              className={`flex-1 py-4 text-sm font-bold transition-all ${
                activeTab === 'following' 
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' 
                  : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              Following
            </button>
          </div>
        </div>

        {/* List Content */}
        <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 min-h-[400px]">
          {error && <div className="p-4 m-4 bg-red-50 text-red-600 rounded-lg text-center">{error}</div>}

          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <span className="text-4xl mb-2">👥</span>
              <p>No connections found in this list.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {users.map((record, index) => {
                const targetUser = activeTab === 'followers' ? record.follower : record.following;
                if (!targetUser) return null;

                const isMutual = otherListIds.has(targetUser.id);

                return (
                  <li key={targetUser.id || index} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-100 dark:border-gray-700 shadow-sm">
                          <img 
                            src={AVAILABLE_AVATARS[targetUser.avatarId || 0]} 
                            alt={targetUser.username}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {isMutual && (
                          <div className="absolute -bottom-1 -right-1 bg-green-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-[#1f2937]" title="Mutual">
                            🤝
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <Link href={`/profile/${targetUser.id}`} className="font-bold dark:text-white hover:text-blue-600 transition-colors">
                          @{targetUser.username}
                        </Link>
                        {isMutual && (
                          <span className="block text-[10px] text-green-600 dark:text-green-400 font-bold uppercase tracking-wider">
                            Mutual Follow
                          </span>
                        )}
                      </div>
                    </div>

                    <button 
                      onClick={() => handleAction(targetUser.id)}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                        activeTab === 'followers' 
                        ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {activeTab === 'followers' ? 'Remove' : 'Unfollow'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && !isLoading && (
          <div className="flex justify-center items-center gap-4 mt-4 mb-6">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)} 
              className="px-4 py-2 text-sm font-bold bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg disabled:opacity-50 dark:text-white transition-colors"
            >
              Prev
            </button>
            <span className="text-sm dark:text-white font-medium">Page {page} of {totalPages}</span>
            <button 
              disabled={page === totalPages} 
              onClick={() => setPage(p => p + 1)} 
              className="px-4 py-2 text-sm font-bold bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg disabled:opacity-50 dark:text-white transition-colors"
            >
              Next
            </button>
          </div>
        )}

      </div>
    </div>
  );
}