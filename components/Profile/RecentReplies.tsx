'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AVAILABLE_AVATARS } from '@/contexts/ThemeContext';

type Reply = {
  id: number;
  content: string;
  createdAt: string;
  threadId: number;
  author: {
    id: number;
    username: string;
    avatarId: number;
  };
  thread?: {
    id: number;
    title: string;
    forum?: {
      id: number; // Required for dynamic teamId routing
      type: 'GENERAL' | 'MATCH' | 'TEAM';
      teamName?: string;
    };
  };
};

export default function RecentReplies({ replies }: { replies: Reply[] }) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter replies based on content, thread title, or the author's username
  const filteredReplies = replies?.filter((reply) => {
    const query = searchQuery.toLowerCase();
    const contentMatch = reply.content.toLowerCase().includes(query);
    const threadMatch = reply.thread?.title.toLowerCase().includes(query);
    const authorMatch = reply.author.username.toLowerCase().includes(query);
    return contentMatch || threadMatch || authorMatch;
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
          placeholder="Search replies by content, thread, or user..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1f2937] text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all dark:text-white"
        />
      </div>

      {filteredReplies.length === 0 ? (
        <div className="bg-white dark:bg-[#1f2937] p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 text-center">
          <span className="text-4xl block mb-3 opacity-50">{searchQuery ? '❓' : '🔔'}</span>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            {searchQuery ? `No replies matching "${searchQuery}"` : 'No replies to display yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReplies.map((reply) => {
            let badgeText = "GENERAL";
            let threadBaseHref = "";
            const forum = reply.thread?.forum;

            // --- DYNAMIC ROUTING LOGIC ---
            if (forum?.type === 'TEAM') {
              badgeText = `TEAM: ${forum.teamName || 'Club'}`;
              threadBaseHref = `/forums/team/${forum.id}/threads/${reply.threadId}`;
            } else if (forum?.type === 'MATCH') {
              badgeText = `MATCH: ${reply.thread?.title || 'Match'}`;
              threadBaseHref = `/forums/match/threads/${reply.threadId}`;
            } else {
              threadBaseHref = `/forums/general/threads/${reply.threadId}`;
            }

            const exactReplyHref = `${threadBaseHref}/posts/${reply.id}`;

            return (
              <div 
                key={reply.id} 
                className="bg-white dark:bg-[#1f2937] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow group flex flex-col"
              >
                {/* --- HEADER --- */}
                <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700/50 flex flex-col gap-3 shrink-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md break-words ${
                        forum?.type === 'MATCH' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : forum?.type === 'TEAM'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {badgeText}
                      </span>
                    </div>
                    
                    {/* UPDATED: EXACT TIME STAMP WITH SECONDS */}
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {new Date(reply.createdAt).toLocaleString(undefined, {
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    })}
                    </span>
                  </div>

                  {/* Reply Context */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <Link href={`/profile/${reply.author.id}`} className="shrink-0">
                      <img 
                        src={AVAILABLE_AVATARS[reply.author.avatarId || 0]} 
                        alt={reply.author.username} 
                        className="w-5 h-5 rounded-full border border-gray-200 dark:border-gray-600 object-cover hover:opacity-80 transition-opacity"
                      />
                    </Link>
                    <Link href={`/profile/${reply.author.id}`} className="font-bold text-gray-900 dark:text-white hover:text-blue-600">
                      @{reply.author.username}
                    </Link>
                    <span className="text-gray-500 dark:text-gray-400 italic shrink-0">replied in:</span>
                    <Link 
                      href={threadBaseHref} 
                      className="font-bold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 break-words"
                    >
                      {reply.thread?.title || "Untitled Thread"}
                    </Link>
                  </div>
                </div>

                {/* --- REPLY CONTENT --- */}
                <div className="p-5 flex flex-col">
                  <div className="max-h-40 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                      {reply.content}
                    </p>
                  </div>
                  
                  <div className="mt-4 flex justify-end shrink-0">
                    <Link 
                      href={exactReplyHref}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      View this reply <span aria-hidden="true">&rarr;</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}