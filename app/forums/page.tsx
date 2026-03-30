'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ForumType } from '@/prisma/generated';

// --- Types ---
type ApiThread = {
  id: number;
  title: string;
  createdAt: string;
  tags?: { name: string }[];
  _count?: { posts: number };
  teamId?: number; // Added to capture team routing
  team?: { id: number }; // Fallback depending on how your Prisma include is structured
};

type ThreadItem = {
  id: number;
  title: string;
  excerpt: string;
  replies: number;
  views: number;
  lastActive: string;
  tag?: string;
  pinned?: boolean;
  teamId?: number; // Added for routing
};

type MatchRecord = {
  id: number;
  date: string;
  homeTeam?: { name: string };
  awayTeam?: { name: string };
};

type CategoryStyle = {
  id: string;
  type: ForumType;
  name: string;
  description: string;
  accent: string;
  border: string;
  pill: string;
};

type CategoryWithThreads = CategoryStyle & {
  threads: ThreadItem[];
  totalCount: number;
};

// --- Constants ---
const categoryStyles: CategoryStyle[] = [
  {
    id: 'general',
    type: ForumType.GENERAL,
    name: 'General',
    description: 'Talk tactics, transfers, and the big football conversations.',
    accent: 'from-amber-100/40 via-white/40 to-amber-50/40 dark:from-amber-900/10 dark:via-[#1f2937]/40 dark:to-amber-900/5',
    border: 'border-amber-200/60 dark:border-amber-700/30 shadow-amber-900/5 dark:shadow-none',
    pill: 'bg-amber-100/80 text-amber-800 border border-amber-200/50 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800/50',
  },
  {
    id: 'match',
    type: ForumType.MATCH,
    name: 'Match',
    description: 'Live and post-match threads for fixtures around the world.',
    accent: 'from-sky-100/40 via-white/40 to-sky-50/40 dark:from-sky-900/10 dark:via-[#1f2937]/40 dark:to-sky-900/5',
    border: 'border-sky-200/60 dark:border-sky-700/30 shadow-sky-900/5 dark:shadow-none',
    pill: 'bg-sky-100/80 text-sky-800 border border-sky-200/50 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800/50',
  },
  {
    id: 'team',
    type: ForumType.TEAM,
    name: 'Team',
    description: "Dedicated spaces for your club's chatter and community.",
    accent: 'from-emerald-100/40 via-white/40 to-emerald-50/40 dark:from-emerald-900/10 dark:via-[#1f2937]/40 dark:to-emerald-900/5',
    border: 'border-emerald-200/60 dark:border-emerald-700/30 shadow-emerald-900/5 dark:shadow-none',
    pill: 'bg-emerald-100/80 text-emerald-800 border border-emerald-200/50 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800/50',
  },
];

// --- Helpers ---
const formatShortDate = (isoString: string) => {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const normalizeThreads = (data: unknown): ApiThread[] => {
  if (Array.isArray(data)) return data as ApiThread[];
  return [];
};

const mapThread = (thread: any): ThreadItem => {
  const replies = thread._count?.posts ? Math.max(thread._count.posts - 1, 0) : 0;
  const tag = thread.tags?.[0]?.name;
  
  return {
    id: thread.id,
    title: thread.title || `Thread #${thread.id}`,
    excerpt: 'Join the conversation and share your take.',
    replies,
    views: 0,
    lastActive: formatShortDate(thread.createdAt),
    tag,
    // THE FIX: Look inside the forum object provided by your API
    teamId: thread.forum?.teamId || thread.teamId, 
  };
};

// --- Sub-Components ---

function ThreadCard({ thread, href }: { thread: ThreadItem; href: string }) {
  return (
    <Link href={href} className="group block focus:outline-none">
      <article className="rounded-3xl border border-white/60 dark:border-gray-700/50 bg-white/70 dark:bg-[#374151]/50 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800/50">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {thread.pinned && (
                <span className="rounded-full bg-gray-900 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white dark:bg-gray-100 dark:text-gray-900 shadow-sm">
                  Pinned
                </span>
              )}
              {thread.tag && (
                <span className="rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200 shadow-sm">
                  {thread.tag}
                </span>
              )}
            </div>
            <h3 className="line-clamp-2 text-lg font-bold text-gray-900 dark:text-white transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
              {thread.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">
              {thread.excerpt}
            </p>
          </div>
          <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-[#1f2937] text-sm font-bold text-blue-600 dark:text-blue-400 shadow-sm border border-gray-100 dark:border-gray-800 sm:flex transition-transform duration-300 group-hover:scale-110 group-hover:shadow-blue-200 dark:group-hover:shadow-blue-900/20">
            {thread.replies}
            <span className="sr-only">replies</span>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-700/50 pt-4 text-xs font-medium text-gray-500 dark:text-gray-400">
          <span className="text-gray-800 dark:text-gray-200 font-semibold">{thread.lastActive}</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              {thread.replies} replies
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {thread.views.toLocaleString()} views
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function CategoryCard({ category, isLoading }: { category: CategoryWithThreads; isLoading: boolean }) {
  return (
    <section className={`group relative rounded-[2rem] border ${category.border} bg-gradient-to-b ${category.accent} p-8 shadow-xl backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl dark:bg-gray-800/40 overflow-hidden`}>
      <div className="absolute inset-0 bg-white/40 dark:bg-transparent" />
      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${category.pill} shadow-sm backdrop-blur-sm`}>
              {category.name}
            </span>
            <h3 className="mt-4 text-2xl font-extrabold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors duration-300">
              <Link 
                href={`/forums/${category.id}`} 
                className="transition-colors hover:text-blue-700 focus:outline-none"
              >
                {category.name} {category.name === 'Team' ? 'Forums' : 'Forum'}
              </Link>
            </h3>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 font-medium">{category.description}</p>
          </div>
          <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-[#1f2937] text-lg font-bold text-gray-900 dark:text-white shadow sm:flex">
            {category.totalCount}
          </div>
        </div>

        <div className="space-y-4 flex-grow">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-2xl border border-white/60 dark:border-gray-700/50 bg-white/70 dark:bg-[#374151]/50 shadow-sm animate-pulse" />
              ))}
            </div>
          ) : category.threads.length > 0 ? (
            category.threads.map((thread) => {
              /**
               * URL MAPPING LOGIC:
               * Team: /forums/team/[teamId]/threads/[threadId]
               * Others: /forums/[type]/threads/[threadId]
               */
              const threadHref = category.id === 'team'
                ? `/forums/team/${thread.teamId}/threads/${thread.id}`
                : `/forums/${category.id}/threads/${thread.id}`;

              return (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  href={threadHref}
                />
              );
            })
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No threads yet. Start the conversation!</p>
          )}
        </div>

        <div className="mt-8">
          <Link
            href={`/forums/${category.id}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 bg-white/60 dark:bg-gray-800/60 px-5 py-3.5 text-sm font-bold text-gray-800 dark:text-gray-200 shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:bg-white dark:hover:bg-gray-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            View all {category.name.toLowerCase()} threads
            <span className="opacity-60 transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

// --- Main Page Component ---
export default function ForumsPage() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasToken, setHasToken] = useState<boolean>(false);
  
  // Threads State
  const [generalThreads, setGeneralThreads] = useState<ThreadItem[]>([]);
  const [matchThreads, setMatchThreads] = useState<ThreadItem[]>([]);
  const [teamThreads, setTeamThreads] = useState<ThreadItem[]>([]);

  // Modal & Form State
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [createType, setCreateType] = useState<'GENERAL' | 'MATCH' | 'TEAM'>('GENERAL');
  const [createTitle, setCreateTitle] = useState<string>('');
  const [postContent, setPostContent] = useState<string>('');
  const [teamNameInput, setTeamNameInput] = useState<string>('');
  const [tagInput, setTagInput] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  
  // Match specific state
  const [matchSearch, setMatchSearch] = useState<string>('');
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [matchesLoading, setMatchesLoading] = useState<boolean>(false);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  
  const [createError, setCreateError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // --- Data Fetching ---
  const fetchAllThreads = useCallback(async (token: string | null) => {
    const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;
    const fetchOptions = authHeader ? { headers: authHeader } : undefined;

    try {
      const [generalRes, matchRes, teamRes] = await Promise.all([
        fetch('/api/threads?type=GENERAL', fetchOptions),
        fetch('/api/threads?type=MATCH', fetchOptions),
        fetch('/api/threads?type=TEAM', fetchOptions),
      ]);

      const [generalJson, matchJson, teamJson] = await Promise.all([
        generalRes.ok ? generalRes.json() : [],
        matchRes.ok ? matchRes.json() : [],
        teamRes.ok ? teamRes.json() : [],
      ]);

      setGeneralThreads(normalizeThreads(generalJson).map(mapThread));
      setMatchThreads(normalizeThreads(matchJson).map(mapThread));
      setTeamThreads(normalizeThreads(teamJson).map(mapThread));
    } catch (error) {
      console.error('Error fetching threads:', error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      if (isMounted) setHasToken(Boolean(token));
      await fetchAllThreads(token);
      if (isMounted) setIsLoading(false);
    };

    loadInitialData();
    return () => { isMounted = false; };
  }, [fetchAllThreads]);

  const loadMatches = useCallback(async () => {
    setMatchesLoading(true);
    try {
      const response = await fetch('/api/matches/search');
      if (!response.ok) throw new Error('Failed to load matches');
      const data = (await response.json()) as MatchRecord[];
      setMatches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setMatches([]);
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isCreateOpen && createType === 'MATCH' && matches.length === 0 && !matchesLoading) {
      loadMatches();
    }
  }, [isCreateOpen, createType, matches.length, matchesLoading, loadMatches]);

  useEffect(() => {
    if (createType !== 'MATCH') {
      setSelectedMatchId(null);
      setMatchSearch('');
    }
  }, [createType]);

  const filteredMatches = useMemo(() => {
    if (!matchSearch.trim()) return matches;
    const normalized = matchSearch.trim().toLowerCase();
    return matches.filter((match) => {
      const home = match.homeTeam?.name || '';
      const away = match.awayTeam?.name || '';
      return `${home} vs ${away}`.toLowerCase().includes(normalized);
    });
  }, [matches, matchSearch]);

  const categories = useMemo<CategoryWithThreads[]>(() => {
    const threadMap = {
      [ForumType.GENERAL]: generalThreads,
      [ForumType.MATCH]: matchThreads,
      [ForumType.TEAM]: teamThreads,
    } as const;

    return categoryStyles.map((category) => ({
      ...category,
      totalCount: threadMap[category.type]?.length || 0,
      threads: (threadMap[category.type] || []).slice(0, 3),
    }));
  }, [generalThreads, matchThreads, teamThreads]);

  // --- Handlers ---
  const resetCreateModal = () => {
    setCreateTitle('');
    setCreateType('GENERAL');
    setTeamNameInput('');
    setMatchSearch('');
    setSelectedMatchId(null);
    setTagInput('');
    setTags([]);
    setPostContent('');
    setCreateError('');
  };

  const handleCreateThread = async () => {
    if (!hasToken || isSubmitting) return;
    setCreateError('');

    const trimmedTitle = createTitle.trim();
    const trimmedContent = postContent.trim();
    const trimmedTeamName = teamNameInput.trim();

    if (!trimmedTitle) return setCreateError('Please enter a title.');
    if (!trimmedContent) return setCreateError('Please enter post content.');
    if (createType === 'TEAM' && !trimmedTeamName) return setCreateError('Please enter a team name.');
    if (createType === 'MATCH' && !selectedMatchId) return setCreateError('Please select a match.');

    const token = localStorage.getItem('accessToken');
    if (!token) {
      setHasToken(false);
      return setCreateError('Please sign in to create a thread.');
    }

    setIsSubmitting(true);
    try {
      // 1. Create Thread
      const threadRes = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: trimmedTitle,
          type: createType,
          ...(createType === 'TEAM' ? { teamName: trimmedTeamName } : {}),
          ...(createType === 'MATCH' ? { matchId: selectedMatchId } : {}),
        }),
      });
      const threadBody = await threadRes.json();
      if (!threadRes.ok) throw new Error(threadBody.error || 'Failed to create thread');
      
      const createdThreadId = threadBody.id;

      // 2. Add Tags (If any)
      if (tags.length > 0) {
        const tagRes = await fetch(`/api/threads/${createdThreadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tags: tags.join(','), replace: true }),
        });
        if (!tagRes.ok) throw new Error('Failed to add tags');
      }

      // 3. Create initial post
      const postRes = await fetch(`/api/threads/${createdThreadId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: trimmedContent, mainPostFor: true }),
      });
      if (!postRes.ok) throw new Error('Failed to create first post');

      // Success Reset & Refresh
      setIsCreateOpen(false);
      resetCreateModal();
      await fetchAllThreads(token);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create thread');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-[#0B1121] selection:bg-blue-500/30">
      {/* Header / Hero Section */}
      <header className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-blue-900 to-sky-900 text-white shadow-2xl">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="absolute inset-0 opacity-40">
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-sky-400/30 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-indigo-500/30 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-20 lg:py-28">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300 backdrop-blur-sm shadow-inner">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
                </span>
                Community Forums
              </div>
              <h1 className="mt-8 text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl bg-gradient-to-br from-white via-blue-50 to-indigo-200 bg-clip-text text-transparent drop-shadow-sm">
                Find your people.<br />Jump into the threads.
              </h1>
              <p className="mt-6 font-medium text-blue-100/90 sm:text-lg leading-relaxed max-w-xl">
                Browse the latest real-time conversations across General, Match, and Team categories.
                Start a thread, follow a debate, or catch up on the highlights.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                disabled={!hasToken}
                className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-white px-8 py-4 text-sm font-bold text-gray-900 shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-blue-100 to-indigo-100 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="relative flex items-center gap-2">
                  {hasToken ? 'Start a New Thread' : 'Sign In to Post'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Categories Grid */}
      <main className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
        <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Explore by category</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Fresh discussions, curated by topic. Jump in or save for later.
            </p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3 mb-16">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} isLoading={isLoading} />
          ))}
        </div>
      </main>

      {/* Create Thread Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1f2937] p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Start a Thread</h2>
              <button
                type="button"
                onClick={() => { if (!isSubmitting) { setIsCreateOpen(false); resetCreateModal(); } }}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                Title
                <input
                  type="text"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="What's on your mind?"
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Category Type</p>
                <div className="flex flex-wrap gap-2">
                  {(['GENERAL', 'MATCH', 'TEAM'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCreateType(type)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        createType === type
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {type.charAt(0) + type.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Inputs Based on Category Type */}
              {createType === 'TEAM' && (
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Team Name
                  <input
                    type="text"
                    value={teamNameInput}
                    onChange={(e) => setTeamNameInput(e.target.value)}
                    placeholder="e.g., Arsenal"
                    className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                </label>
              )}

              {createType === 'MATCH' && (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Select Match
                    <input
                      type="text"
                      value={matchSearch}
                      onChange={(e) => setMatchSearch(e.target.value)}
                      placeholder="Search for a match..."
                      className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                  </label>
                  <div className="max-h-32 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-1">
                    {matchesLoading ? (
                      <p className="p-2 text-sm text-gray-500">Loading matches...</p>
                    ) : filteredMatches.length > 0 ? (
                      filteredMatches.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedMatchId(m.id)}
                          className={`w-full text-left px-3 py-2 text-sm rounded-lg transition ${
                            selectedMatchId === m.id
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 font-bold'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          {m.homeTeam?.name || 'TBD'} vs {m.awayTeam?.name || 'TBD'}
                        </button>
                      ))
                    ) : (
                      <p className="p-2 text-sm text-gray-500">No matches found.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Tags</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if(tagInput.trim()) { setTags(prev => [...prev, tagInput.trim()]); setTagInput(''); } } }}
                    placeholder="Press enter to add"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => { if(tagInput.trim()) { setTags(prev => [...prev, tagInput.trim()]); setTagInput(''); } }}
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 transition"
                  >
                    Add
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map((tag, index) => (
                      <span key={`${tag}-${index}`} className="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-900/30 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400">
                        {tag}
                        <button type="button" onClick={() => setTags((prev) => prev.filter((_, i) => i !== index))} className="rounded-full px-1 hover:bg-blue-200 dark:hover:bg-blue-800 transition">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                Opening Post
                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="Kick off the conversation..."
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none resize-none"
                />
              </label>

              {createError && <p className="text-sm font-medium text-red-600 dark:text-red-400">{createError}</p>}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => { if (!isSubmitting) { setIsCreateOpen(false); resetCreateModal(); } }}
                  className="rounded-full px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateThread}
                  disabled={isSubmitting}
                  className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-blue-400 disabled:shadow-none"
                >
                  {isSubmitting ? 'Posting...' : 'Create Thread'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}