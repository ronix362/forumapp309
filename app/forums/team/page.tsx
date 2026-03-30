'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const PAGE_SIZE = 9;

type TeamInfo = {
  id: number;
  name: string;
  logoUrl: string;
  venue?: string | null;
};

type TeamForum = {
  id: number;
  teamId: number | null;
  teamName: string | null;
  team?: TeamInfo | null;
  _count?: { threads: number };
};

type ForumsResponse = {
  items: TeamForum[];
  totalCount: number;
  page: number;
  pageSize: number;
};

const getTeamLabel = (forum: TeamForum) => forum.team?.name ?? forum.teamName ?? 'Team Forum';

const getForumHref = (forum: TeamForum) => {
  const teamId = forum.teamId ?? forum.team?.id;
  return teamId ? `/forums/team/${teamId}` : '/forums/team';
};

export default function TeamForumsIndexPage() {
  const [forums, setForums] = useState<TeamForum[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [teamQuery, setTeamQuery] = useState<string>('');
  const [appliedQuery, setAppliedQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const loadForums = useCallback(async (nextPage: number, query?: string) => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('type', 'TEAM');
      params.set('page', String(nextPage));
      params.set('pageSize', String(PAGE_SIZE));
      if (query) params.set('teamName', query);

      const response = await fetch(`/api/forums?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load team forums');
      }

      const data = (await response.json()) as ForumsResponse | TeamForum[];
      if (Array.isArray(data)) {
        setForums(data);
        setTotalCount(data.length);
      } else {
        setForums(Array.isArray(data.items) ? data.items : []);
        setTotalCount(typeof data.totalCount === 'number' ? data.totalCount : 0);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load team forums');
      setForums([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForums(page, appliedQuery || undefined);
  }, [page, appliedQuery, loadForums]);

  // Live search: update appliedQuery automatically as the user types (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedQuery(teamQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [teamQuery]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    [totalCount],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIndex = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-[#0B1121] selection:bg-emerald-500/30">
      <header className="relative overflow-hidden border-b border-gray-200/50 dark:border-gray-800 bg-white/80 dark:bg-[#1f2937]/80 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-900/10 dark:to-transparent opacity-50" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/50 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:border-emerald-700/30 dark:bg-emerald-900/20 dark:text-emerald-400 shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              Team Hub
            </div>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
              Team Forums
            </h1>
            <p className="mt-4 text-base font-medium text-gray-600 dark:text-gray-300">
              Find your club, jump into its forum, and see what the fanbase is talking about.
            </p>
          </div>
            <form
              onSubmit={(event) => event.preventDefault()}
              className="flex w-full max-w-sm flex-col gap-3 sm:items-end"
            >
              <input
                type="text"
                value={teamQuery}
                onChange={(event) => setTeamQuery(event.target.value)}
                placeholder="Search by team name"
                className="w-full rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-4 py-2 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
                aria-label="Search by team name"
              />
              <div className="flex w-full flex-wrap items-center gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setTeamQuery('');
                    setAppliedQuery('');
                    setPage(1);
                  }}
                  className="rounded-full border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Reset
                </button>
              </div>
            </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-40 rounded-3xl border border-gray-200/50 dark:border-gray-800 bg-white/50 dark:bg-[#1f2937]/50 shadow-sm animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        ) : forums.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30 py-20 px-6 text-center backdrop-blur-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-4 text-xl">🔍</span>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">No discussions found</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm">We couldn't find any team forums matching your search. Try adjusting your query.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {forums.map((forum) => {
              const teamLabel = getTeamLabel(forum);
              const href = getForumHref(forum);
              const threadCount = forum._count?.threads ?? 0;
              const logoUrl = forum.team?.logoUrl;

              return (
                <Link key={forum.id} href={href} className="group block h-full">
                  <article className="flex h-full flex-col gap-6 rounded-3xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-[#1f2937]/50 p-6 shadow-sm backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-800/50">
                    <div className="flex items-center gap-5">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-50 dark:bg-gray-800 text-lg font-bold text-gray-700 dark:text-gray-200 shadow-sm border border-gray-100 dark:border-gray-700/50 transition-transform duration-300 group-hover:scale-105">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt={teamLabel}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          teamLabel.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-xl font-bold text-gray-900 dark:text-white transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          {teamLabel}
                        </h2>
                        <p className="mt-1 text-xs font-medium tracking-wide text-gray-500 dark:text-gray-400 uppercase">
                          {threadCount} active thread{threadCount === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-auto flex flex-col gap-4 border-t border-gray-100 dark:border-gray-800 pt-4">
                      {forum.team?.venue && (
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                          <span className="text-gray-400">🏟️</span> {forum.team.venue}
                        </p>
                      )}
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 transition-colors group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50">
                        Enter Forum →
                      </span>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}

        {!isLoading && !error && totalCount > 0 && (
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {startIndex} - {endIndex} of {totalCount} forums
            </p>
            <div className="flex items-center gap-3">
              <button
                className="rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Page {page} of {totalPages}
              </span>
              <button
                className="rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
