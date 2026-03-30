'use client';

import { useState } from 'react';
import Link from 'next/link';

type Thread = {
  id: number;
  title: string;
  createdAt: string;
  visibility?: boolean; // ADDED: to handle the visibility check
  forum?: {
    id: number;
    type: 'GENERAL' | 'MATCH' | 'TEAM';
    teamName?: string;
  };
  _count?: {
    posts: number;
  };
};

export default function RecentThreads({ threads }: { threads: Thread[] }) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredThreads = threads?.filter((thread) => {
    // ADDED: Filter out any threads where visibility is strictly false
    if (thread.visibility === false) {
      return false;
    }

    const query = searchQuery.toLowerCase();
    const titleMatch = thread.title.toLowerCase().includes(query);
    const teamMatch = thread.forum?.teamName?.toLowerCase().includes(query);
    const typeMatch = thread.forum?.type?.toLowerCase().includes(query);
    
    return titleMatch || teamMatch || typeMatch;
  }) || [];

  return (
    <div className="space-y-4">
      {/* --- SEARCH INPUT --- */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="text-gray-400">🔍</span>
        </div>
        <input
          type="text"
          placeholder="Search threads by title, team, or forum type..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1f2937] text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all dark:text-white"
        />
      </div>

      <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Threads</h2>
        </div>
        
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {filteredThreads.length > 0 ? (
            filteredThreads.map((thread) => {
              let badgeText = "";
              let threadHref = "";

              if (thread.forum?.type === 'TEAM') {
                badgeText = `TEAM: ${thread.forum.teamName || 'Club'}`;
                threadHref = `/forums/team/${thread.forum.id}/threads/${thread.id}`;
              } 
              else if (thread.forum?.type === 'MATCH') {
                badgeText = `MATCH: ${thread.title}`;
                threadHref = `/forums/match/threads/${thread.id}`;
              } 
              else {
                badgeText = "GENERAL";
                threadHref = `/forums/general/threads/${thread.id}`;
              }

              return (
                <Link 
                  href={threadHref} 
                  key={thread.id} 
                  className="block p-5 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-all group"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          thread.forum?.type === 'MATCH' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                            : thread.forum?.type === 'TEAM'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {badgeText}
                        </span>
                        
                        {thread._count && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            • {thread._count.posts} posts
                          </span>
                        )}
                      </div>
                      
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 whitespace-nowrap">
                        {new Date(thread.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    </div>

                    <h3 className="text-md font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:hover:group-hover:text-blue-400 transition-colors">
                      {thread.title}
                    </h3>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="p-10 text-center">
              <span className="text-3xl block mb-2 opacity-30">{searchQuery ? '❓' : '📁'}</span>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {searchQuery ? `No visible threads matching "${searchQuery}"` : 'No threads created yet.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}