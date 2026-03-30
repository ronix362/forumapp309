'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const PAGE_SIZE = 8;

type ThreadRecord = {
  id: number;
  title: string;
  createdAt: string;
  _count?: { posts: number };
  author?: { id: number; username: string } | null;
};

type MatchRecord = {
  id: number;
  date: string;
  homeTeam?: { name: string };
  awayTeam?: { name: string };
};

type SentimentPayload = {
  totalSentiment?: string;
  homeTeamSentiment?: string;
  awayTeamSentiment?: string;
};

type SentimentState = {
  status: 'loading' | 'ready' | 'error';
  data?: SentimentPayload;
  postCount?: number;
};

// 1. REMOVED the SENTIMENT_CACHE_KEY and local storage types. 
// We are trusting Redis to do the heavy lifting now!

const formatDate = (isoString: string) => {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const titleCase = (value?: string) => {
  if (!value) return 'Mixed';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const sentimentDisplay = (state: SentimentState | undefined, key: keyof SentimentPayload) => {
  if (!state || state.status === 'loading') {
    return { label: 'Loading', tone: 'loading' };
  }
  if (state.status === 'error') {
    return { label: 'Unavailable', tone: 'unavailable' };
  }
  const value = state.data?.[key]?.toLowerCase();
  const tone =
    value === 'positive' || value === 'negative' || value === 'neutral' || value === 'mixed'
      ? value
      : 'mixed';
  return { label: titleCase(value), tone };
};

const sentimentClass = (tone: string) => {
  switch (tone) {
    case 'positive':
      return 'bg-emerald-100 text-emerald-700';
    case 'negative':
      return 'bg-rose-100 text-rose-700';
    case 'neutral':
      return 'bg-slate-100 text-slate-700';
    case 'mixed':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-gray-100 text-gray-500';
  }
};

export default function MatchForumsPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<ThreadRecord[]>([]);
  const [sentiments, setSentiments] = useState<Record<number, SentimentState>>({});
  const [titleQuery, setTitleQuery] = useState<string>('');
  const [authorQuery, setAuthorQuery] = useState<string>('');
  const [teamQuery, setTeamQuery] = useState<string>('');
  const [filterTagInput, setFilterTagInput] = useState<string>('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [titleInput, setTitleInput] = useState<string>('');
  const [matchSearch, setMatchSearch] = useState<string>('');
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [matchesLoading, setMatchesLoading] = useState<boolean>(false);
  const [matchesError, setMatchesError] = useState<string>('');
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [tagInput, setTagInput] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [postContent, setPostContent] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>('');

  // 2. REMOVED the useEffect that hydrated sentiments from localStorage.

  const loadThreads = useCallback(
    async (filters?: { title?: string; author?: string; teamName?: string; tags?: string }) => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('type', 'MATCH');
      if (filters?.title) params.set('title', filters.title);
      if (filters?.author) params.set('author', filters.author);
      if (filters?.teamName) params.set('teamName', filters.teamName);
      if (filters?.tags) params.set('tags', filters.tags);

      // 3. FIX: Add { cache: 'no-store' } to ensure the browser gets the latest thread & post counts
      const response = await fetch(`/api/threads?${params.toString()}`, {
        cache: 'no-store'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch match threads');
      }
      const data = (await response.json()) as ThreadRecord[];
      setThreads(Array.isArray(data) ? data : []);
      setPage(1);
    } catch (err: any) {
      setError(err.message || 'Failed to load match threads');
      setThreads([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // Live search: re-fetch when any search field or tag filter changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadThreads({
        title: titleQuery.trim() || undefined,
        author: authorQuery.trim() || undefined,
        teamName: teamQuery.trim() || undefined,
        tags: filterTags.length > 0 ? filterTags.join(',') : undefined,
      });
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleQuery, authorQuery, teamQuery, filterTags]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    setHasToken(Boolean(token));
  }, []);

  const loadMatches = useCallback(async () => {
    setMatchesLoading(true);
    setMatchesError('');

    try {
      // 4. FIX: Add { cache: 'no-store' } here as well
      const response = await fetch('/api/matches/search', {
        cache: 'no-store'
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || 'Failed to load matches');
      }
      const data = (await response.json()) as MatchRecord[];
      setMatches(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setMatchesError(err.message || 'Failed to load matches');
      setMatches([]);
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isModalOpen && matches.length === 0 && !matchesLoading) {
      loadMatches();
    }
  }, [isModalOpen, matches.length, matchesLoading, loadMatches]);

  const filteredMatches = useMemo(() => {
    if (!matchSearch.trim()) return matches;
    const normalized = matchSearch.trim().toLowerCase();
    return matches.filter((match) => {
      const home = match.homeTeam?.name || '';
      const away = match.awayTeam?.name || '';
      return `${home} vs ${away}`.toLowerCase().includes(normalized);
    });
  }, [matches, matchSearch]);

  const filteredThreads = useMemo(() => threads, [threads]);

  const totalPages = Math.max(1, Math.ceil(filteredThreads.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage]);

  const pageThreads = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredThreads.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredThreads, currentPage]);

  const handleCreateThread = async () => {
    if (!hasToken || isSubmitting) return;
    setCreateError('');

    const trimmedTitle = titleInput.trim();
    if (!trimmedTitle) {
      setCreateError('Please enter a title.');
      return;
    }
    if (!selectedMatchId) {
      setCreateError('Please select a match.');
      return;
    }
    const trimmedContent = postContent.trim();
    if (!trimmedContent) {
      setCreateError('Please enter post content.');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      setHasToken(false);
      setCreateError('Please sign in to create a thread.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: trimmedTitle, type: 'MATCH', matchId: selectedMatchId }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Failed to create thread');
      }
      const createdThreadId = body.id;

      if (tags.length > 0) {
        const tagResponse = await fetch(`/api/threads/${createdThreadId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tags: tags.join(','), replace: true }),
        });
        const tagBody = await tagResponse.json();
        if (!tagResponse.ok) {
          throw new Error(tagBody.error || 'Failed to add tags');
        }
      }

      const postResponse = await fetch(`/api/threads/${createdThreadId}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: trimmedContent, mainPostFor: true }),
      });
      const postBody = await postResponse.json();
      if (!postResponse.ok) {
        throw new Error(postBody.error || 'Failed to create first post');
      }
      setIsModalOpen(false);
      setTitleInput('');
      setMatchSearch('');
      setSelectedMatchId(null);
      setTagInput('');
      setTags([]);
      setPostContent('');
      await loadThreads({
        title: titleQuery.trim() || undefined,
        author: authorQuery.trim() || undefined,
        teamName: teamQuery.trim() || undefined,
        tags: filterTags.length > 0 ? filterTags.join(',') : undefined,
      });
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create thread');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setTitleInput('');
    setMatchSearch('');
    setSelectedMatchId(null);
    setTagInput('');
    setTags([]);
    setPostContent('');
    setCreateError('');
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    setTags((prev) => [...prev, trimmed]);
    setTagInput('');
  };

  const removeTag = (index: number) => {
    setTags((prev) => prev.filter((_, i) => i !== index));
  };

  const addFilterTag = () => {
    const trimmed = filterTagInput.trim();
    if (!trimmed) return;
    setFilterTags((prev) => [...prev, trimmed]);
    setFilterTagInput('');
  };

  const removeFilterTag = (index: number) => {
    setFilterTags((prev) => prev.filter((_, i) => i !== index));
  };

  const persistSentiment = useCallback((threadId: number, data: SentimentPayload, postCount: number) => {
    setSentiments((prev) => ({
      ...prev,
      [threadId]: { status: 'ready', data, postCount },
    }));
    // 5. REMOVED localStorage.setItem logic here. Keep it strictly in React state.
  }, []);

  useEffect(() => {
    if (pageThreads.length === 0) return;

    const fetchSentiments = async () => {
      const pending = pageThreads.filter((thread) => {
        const count = thread._count?.posts ?? 0;
        const state = sentiments[thread.id];
        
        // If we don't have it in state, we fetch it.
        if (!state) return true;
        
        // If the post count has changed since we last fetched, we fetch it again!
        return state.postCount !== count;
      });

      if (pending.length === 0) return;

      await Promise.all(
        pending.map(async (thread) => {
          const postCount = thread._count?.posts ?? 0;
          setSentiments((prev) => {
            const existing = prev[thread.id];
            if (existing?.status === 'ready') {
              return { ...prev, [thread.id]: { ...existing, postCount } };
            }
            return { ...prev, [thread.id]: { status: 'loading', postCount } };
          });

          try {
            // 6. FIX: Add ?t=${Date.now()} cache buster AND { cache: 'no-store' }
            const response = await fetch(`/api/threads/${thread.id}/sentiment?t=${Date.now()}`, {
              cache: 'no-store'
            });
            
            if (!response.ok) throw new Error('Sentiment unavailable');
            const body = await response.json();
            persistSentiment(thread.id, body.sentiment, postCount);
          } catch (err) {
            setSentiments((prev) => ({
              ...prev,
              [thread.id]: { status: 'error', postCount },
            }));
          }
        })
      );
    };

    fetchSentiments();
  }, [pageThreads, persistSentiment, sentiments]);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-[#0B1121] selection:bg-sky-500/30">
      <header className="relative overflow-hidden border-b border-gray-200/50 dark:border-gray-800 bg-white/80 dark:bg-[#1f2937]/80 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-50/50 to-transparent dark:from-sky-900/10 dark:to-transparent opacity-50" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/50 bg-sky-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-sky-600 dark:border-sky-700/30 dark:bg-sky-900/20 dark:text-sky-400 shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-sky-500" />
              Match Hub
            </div>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
              Match Threads
            </h1>
            <p className="mt-4 text-base font-medium text-gray-600 dark:text-gray-300">
              Live and post-match threads for fixtures around the world, updated with fan sentiments.
            </p>
          </div>
          <div className="flex w-full lg:max-w-md flex-col gap-4 lg:items-end">
            <form
              onSubmit={(event) => {
                event.preventDefault();
              }}
              className="w-full space-y-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={titleQuery}
                  onChange={(event) => setTitleQuery(event.target.value)}
                  placeholder="Search by title"
                  className="w-full rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-4 py-2 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
                  aria-label="Search by title"
                />
                <input
                  type="text"
                  value={authorQuery}
                  onChange={(event) => setAuthorQuery(event.target.value)}
                  placeholder="Search by author"
                  className="w-full rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-4 py-2 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
                  aria-label="Search by author"
                />
                <input
                  type="text"
                  value={teamQuery}
                  onChange={(event) => setTeamQuery(event.target.value)}
                  placeholder="Search by team"
                  className="w-full rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-4 py-2 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
                  aria-label="Search by team"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tags</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={filterTagInput}
                    onChange={(event) => setFilterTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addFilterTag();
                      }
                    }}
                    placeholder="Add a tag to filter"
                    className="w-full rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-4 py-2 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
                    aria-label="Add a tag filter"
                  />
                  <button
                    type="button"
                    onClick={addFilterTag}
                    className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 dark:hover:bg-gray-200 dark:bg-gray-100 dark:text-gray-900"
                  >
                    Add
                  </button>
                </div>
                {filterTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {filterTags.map((tag, index) => (
                      <span
                        key={`${tag}-${index}`}
                        className="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-900/30 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeFilterTag(index)}
                          className="rounded-full px-1 text-xs text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTitleQuery('');
                    setAuthorQuery('');
                    setTeamQuery('');
                    setFilterTagInput('');
                    setFilterTags([]);
                    loadThreads();
                  }}
                  className="rounded-full border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-3xl border border-gray-200/50 dark:border-gray-800 bg-white/50 dark:bg-[#1f2937]/50 shadow-sm animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        ) : (
          <div className="space-y-4">
            {pageThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30 py-20 px-6 text-center backdrop-blur-sm">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-4 text-xl">🔍</span>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">No discussions found</h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm">We couldn't find any match threads matching your filters. Try adjusting your search.</p>
              </div>
            ) : (
              pageThreads.map((thread) => {
                const state = sentiments[thread.id];
                const totalSentiment = sentimentDisplay(state, 'totalSentiment');
                const homeSentiment = sentimentDisplay(state, 'homeTeamSentiment');
                const awaySentiment = sentimentDisplay(state, 'awayTeamSentiment');
                return (
                  <Link
                    key={thread.id}
                    href={`/forums/match/threads/${thread.id}`}
                    className="group block"
                  >
                    <article className="flex flex-col gap-4 rounded-3xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-[#1f2937]/50 p-6 shadow-sm backdrop-blur-sm transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-sky-200 dark:group-hover:border-sky-800/50">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h2 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                            {thread.title}
                          </h2>
                          <p className="mt-2 text-xs font-medium tracking-wide text-gray-500 dark:text-gray-400 uppercase">Started {formatDate(thread.createdAt)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold tracking-wider uppercase shadow-sm ${sentimentClass( totalSentiment.tone )}`}
                          >
                            Overall: {totalSentiment.label}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold tracking-wider uppercase shadow-sm ${sentimentClass( homeSentiment.tone )}`}
                          >
                            Home: {homeSentiment.label}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold tracking-wider uppercase shadow-sm ${sentimentClass( awaySentiment.tone )}`}
                          >
                            Away: {awaySentiment.label}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                            Thread #{thread.id}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-sky-200/50 bg-sky-50 dark:bg-sky-900/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 shadow-sm">
                            Match
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {thread.author && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/profile/${thread.author!.id}`); }}
                              className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                            >
                              @{thread.author.username}
                            </button>
                          )}
                          <span className="opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-1 text-sky-600 dark:text-sky-400 font-bold">
                            View Thread →
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })
            )}
          </div>
        )}

        {!isLoading && !error && filteredThreads.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {(currentPage - 1) * PAGE_SIZE + 1} -{' '}
              {Math.min(currentPage * PAGE_SIZE, filteredThreads.length)} of {filteredThreads.length} threads
            </p>
            <div className="flex items-center gap-3">
              <button
                className="rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1f2937] p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Match Thread</h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full px-2 py-1 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Title
                <input
                  type="text"
                  value={titleInput}
                  onChange={(event) => setTitleInput(event.target.value)}
                  placeholder="Thread title"
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none"
                />
              </label>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Match</label>
                <input
                  type="text"
                  value={matchSearch}
                  onChange={(event) => setMatchSearch(event.target.value)}
                  placeholder="Search by team name"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none"
                />
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#111827] p-2">
                  {matchesLoading ? (
                    <div className="h-20 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937]" />
                  ) : matchesError ? (
                    <p className="px-2 py-1 text-sm text-red-600 dark:text-red-400">{matchesError}</p>
                  ) : filteredMatches.length === 0 ? (
                    <p className="px-2 py-1 text-sm text-gray-500 dark:text-gray-400">No matches found.</p>
                  ) : (
                    filteredMatches.map((match) => {
                      const label = `${match.homeTeam?.name ?? 'Home'} vs ${match.awayTeam?.name ?? 'Away'}`;
                      return (
                        <button
                          key={match.id}
                          type="button"
                          onClick={() => setSelectedMatchId(match.id)}
                          className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${ selectedMatchId === match.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700' : 'border-gray-200 bg-white dark:bg-[#1f2937] text-gray-700 dark:text-gray-200 hover:border-blue-200' }`}
                        >
                          <div className="font-semibold">{label}</div>
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {match.date ? formatDate(match.date) : 'Date TBD'}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Tags</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    placeholder="Add a tag"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 dark:hover:bg-gray-200 dark:bg-gray-100 dark:text-gray-900"
                  >
                    Add
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <span
                        key={`${tag}-${index}`}
                        className="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-900/30 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(index)}
                          className="rounded-full px-1 text-xs text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                First post content
                <textarea
                  value={postContent}
                  onChange={(event) => setPostContent(event.target.value)}
                  placeholder="Write the opening post"
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none"
                />
              </label>
              {createError && <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateThread}
                  disabled={isSubmitting}
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {isSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}