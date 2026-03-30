'use client';

import { useEffect, useMemo, useState } from 'react';
import RecentScoresCard from '@/components/Dashboard/RecentScoresCard';
import UpcomingMatchesCard from '@/components/Dashboard/UpcomingMatchesCard';
// Import our highly-styled, reusable components
import RecentPosts from '@/components/Profile/RecentPosts';
import RecentReplies from '@/components/Profile/RecentReplies';
import RecentThreads from '@/components/Profile/RecentThreads';

// --- TYPES ALIGNED WITH OUR REUSABLE COMPONENTS ---
type PostItem = {
  id: number;
  content: string; 
  createdAt: string;
  threadId: number;
  authorId?: number;
  author?: { 
    id: number;
    username: string;
    avatarId: number; 
  };
  thread?: {
    id: number;
    title: string;
    forum?: {
      id: number;
      type: 'GENERAL' | 'MATCH' | 'TEAM';
      teamName?: string;
    };
  };
};

type MatchItem = {
  id: number;
  date: string;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  homeTeam?: { logoUrl: string, name: string } | null
  awayTeam?: { logoUrl: string, name: string } | null
  homeScore?: number | null;
  awayScore?: number | null;
};

type ThreadItem = {
  id: number;
  title: string;
  createdAt: string;
  forum?: {
    type: 'GENERAL' | 'MATCH' | 'TEAM';
    teamName?: string;
  };
  _count?: {
    posts: number;
    polls?: number;
  };
};

type DigestResponse = {
  digest?: string;
  cached?: boolean;
  error?: string;
};

type FeedResponse = {
  favTeamUpcomingMatches: MatchItem[];
  favTeamRecentResults: MatchItem[];
  favTeamThreads: { threads?: ThreadItem[] } | [];
  followedPosts: PostItem[];
  replyingPosts: PostItem[]; 
  recentPosts: PostItem[];
  totalPages: number; 
  error?: string;
};

type Section = "recent" | "following" | "replies" | "matches" | "threads";

const TABS: { key: Section; label: string }[] = [
  { key: "recent",    label: "Global Posts" },
  { key: "following", label: "Following" },
  { key: "replies",   label: "Replies to You" },
  { key: "matches",   label: "Team Matches" },
  { key: "threads",   label: "Team Threads" },
];

export default function DashboardPage() {
  const [isMounted, setIsMounted] = useState(false); // <--- HYDRATION FIX
  const [digest, setDigest] = useState<string>('');
  const [digestError, setDigestError] = useState<string>('');
  const [feed, setFeed] = useState<Partial<FeedResponse> | null>(null);
  const [feedError, setFeedError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [section, setSection] = useState<Section>('recent');
  const [page, setPage] = useState(1);

  // Mark the component as successfully mounted on the client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Reset page when section changes
  useEffect(() => { setPage(1); }, [section]);

  // Load digest once on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    setHasToken(!!token);
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/aidigest', { headers })
      .then((r) => r.json())
      .then((body: DigestResponse) => {
        if (body.error) setDigestError(body.error);
        else setDigest(body.digest || 'No digest available.');
      })
      .catch(() => setDigestError('Failed to load daily digest'));
  }, []);

  // Load feed whenever section or page changes
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    setIsLoading(true);
    setFeedError('');
    fetch(`/api/users/feed?section=${section}&page=${page}`, { headers })
      .then((r) => r.json())
      .then((body) => {
        if (body.error) setFeedError(body.error);
        else setFeed(body);
      })
      .catch(() => setFeedError('Failed to load feed'))
      .finally(() => setIsLoading(false));
  }, [section, page]);

  const favoriteThreads = useMemo(() => {
    if (!feed || !feed.favTeamThreads || Array.isArray(feed.favTeamThreads)) return [];
    return feed.favTeamThreads.threads || [];
  }, [feed]);

  const renderPagination = () => {
    const totalPages = feed?.totalPages || 1;
    if (totalPages <= 1 && page === 1) return null;

    return (
      <div className="flex justify-between items-center p-4 bg-white dark:bg-[#1f2937] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mt-4">
        <button 
          disabled={page === 1} 
          onClick={() => setPage(p => p - 1)}
          className="px-4 py-2 text-sm font-bold bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Previous
        </button>
        
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Page</span>
          <input 
            type="number" 
            min={1} 
            max={totalPages} 
            value={page}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val) && val >= 1 && val <= totalPages) {
                setPage(val);
              }
            }}
            className="w-16 text-center text-sm font-bold bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md py-1 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">of {totalPages}</span>
        </div>

        <button 
          disabled={page >= totalPages} 
          onClick={() => setPage(p => p + 1)}
          className="px-4 py-2 text-sm font-bold bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Next
        </button>
      </div>
    );
  };

  // Prevent SSR rendering to completely avoid hydration mismatch errors
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Daily digest */}
        {(digest || digestError) && (
          <section className="bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden transition-colors">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-800 p-5">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>📰</span> Daily AI Digest
              </h2>
              <p className="text-xs text-blue-100 mt-1 opacity-80">Your personalized football summary</p>
            </div>
            <div className="p-5">
              {digestError ? (
                <p className="text-sm text-red-500 font-medium">{digestError}</p>
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-line">{digest}</p>
              )}
            </div>
          </section>
        )}

        {/* Tab bar */}
        <div className="flex flex-wrap gap-2 bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-xl p-1.5 shadow-sm transition-colors overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSection(tab.key)}
              className={`flex-1 min-w-[120px] py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap px-2 ${
                section === tab.key
                  ? 'bg-blue-600 text-white shadow-md scale-[1.02]'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Section content */}
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : feedError ? (
           <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md border-l-4 border-red-500 shadow-sm">
             {feedError}
           </div>
        ) : (
          <div className="animate-in fade-in duration-300">
            
            {section === 'recent' && (
              <div className="space-y-4">
                <div className="px-2 mb-2">
                  <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">🌍 Global Feed</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">All recent posts from the entire community.</p>
                </div>
                {/* Use Type Assertion 'as any' here to avoid strict type mismatch */}
                <RecentPosts posts={(feed?.recentPosts ?? []) as any} />
                {renderPagination()}
              </div>
            )}

            {section === 'following' && (
              <div className="space-y-4">
                <div className="px-2 mb-2">
                  <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">👥 Following Feed</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Recent posts from users you currently follow.</p>
                </div>
                {/* Use Type Assertion 'as any' here as well */}
                <RecentPosts posts={(feed?.followedPosts ?? []) as any} />
                {renderPagination()}
              </div>
            )}

            {section === 'replies' && (
              <div className="space-y-4">
                <div className="px-2 mb-2">
                  <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">💬 Replies to You</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Responses to your posts and activities inside your threads.</p>
                </div>
                <RecentReplies replies={(feed?.replyingPosts ?? []) as any} />
                {renderPagination()}
              </div>
            )}

            {section === 'matches' && (
              <div className="space-y-6">
                <div className="px-2">
                  <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">⚽ Favorite Team Matches</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Upcoming schedule and recent results for your selected club.</p>
                </div>
                <RecentScoresCard matches={feed?.favTeamRecentResults ?? []} />
                <UpcomingMatchesCard matches={feed?.favTeamUpcomingMatches ?? []} />
                {renderPagination()}
              </div>
            )}

            {section === 'threads' && (
              <div className="space-y-4">
                <div className="px-2 mb-2">
                  <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">🛡️ Favorite Team Threads</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Active discussion threads specifically for your chosen club.</p>
                </div>
                <RecentThreads threads={(favoriteThreads ?? []) as any} />
                {renderPagination()}
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
}