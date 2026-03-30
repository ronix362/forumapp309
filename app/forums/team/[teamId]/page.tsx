'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

const PAGE_SIZE = 8;

type ThreadRecord = {
  id: number;
  title: string;
  createdAt: string;
  tags?: { name: string }[];
  author?: { id: number; username: string } | null;
};

const formatDate = (isoString: string) => {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

export default function TeamForumsPage() {
  const router = useRouter();
  const params = useParams();
  const rawTeamId = params?.teamId;
  const teamId = Array.isArray(rawTeamId) ? rawTeamId[0] : rawTeamId;
  const [threads, setThreads] = useState<ThreadRecord[]>([]);
  const [titleQuery, setTitleQuery] = useState<string>('');
  const [authorQuery, setAuthorQuery] = useState<string>('');
  const [filterTagInput, setFilterTagInput] = useState<string>('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [forumTeamName, setForumTeamName] = useState<string>('');
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [titleInput, setTitleInput] = useState<string>('');
  const [tagInput, setTagInput] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [postContent, setPostContent] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>('');

  const fetchThreads = useCallback(
    async (
      teamName: string,
      filters?: { title?: string; author?: string; tags?: string },
    ) => {
      const params = new URLSearchParams();
      params.set('type', 'TEAM');
      params.set('teamName', teamName);
      if (filters?.title) params.set('title', filters.title);
      if (filters?.author) params.set('author', filters.author);
      if (filters?.tags) params.set('tags', filters.tags);

      const response = await fetch(`/api/threads?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch team threads');
      }
      const data = (await response.json()) as ThreadRecord[];
      return Array.isArray(data) ? data : [];
    },
    [],
  );

  const loadThreads = useCallback(
    async (filters?: { title?: string; author?: string; tags?: string }) => {
      setIsLoading(true);
      setError('');

      try {
        if (!forumTeamName) {
          throw new Error('Team forum not found.');
        }
        const data = await fetchThreads(forumTeamName, filters);
        setThreads(data);
        setPage(1);
      } catch (err: any) {
        setError(err.message || 'Failed to load team threads');
        setThreads([]);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchThreads, forumTeamName],
  );

  const refreshThreads = useCallback(() => {
    return loadThreads({
      title: titleQuery.trim() || undefined,
      author: authorQuery.trim() || undefined,
      tags: filterTags.length > 0 ? filterTags.join(',') : undefined,
    });
  }, [authorQuery, filterTags, loadThreads, titleQuery]);

  const loadForum = useCallback(async () => {
    if (!teamId) {
      setIsLoading(false);
      setError('Team not specified.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/forums?type=TEAM&teamId=${teamId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch team forum');
      }

      const forum = await response.json();
      if (!forum || Array.isArray(forum)) {
        throw new Error('Team forum not found.');
      }

      const teamName = forum.team?.name ?? forum.teamName;
      if (!teamName) {
        throw new Error('Team forum not found.');
      }

      setForumTeamName(teamName);
      const data = await fetchThreads(teamName);
      setThreads(data);
      setPage(1);
    } catch (err: any) {
      setError(err.message || 'Failed to load team forum');
      setThreads([]);
      setForumTeamName('');
    } finally {
      setIsLoading(false);
    }
  }, [teamId, fetchThreads]);

  useEffect(() => {
    loadForum();
  }, [loadForum]);

  // Live search: re-fetch when any search field or tag filter changes (debounced)
  useEffect(() => {
    if (!forumTeamName) return;
    const timer = setTimeout(() => {
      loadThreads({
        title: titleQuery.trim() || undefined,
        author: authorQuery.trim() || undefined,
        tags: filterTags.length > 0 ? filterTags.join(',') : undefined,
      });
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleQuery, authorQuery, filterTags]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    setHasToken(Boolean(token));
  }, []);

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
    const trimmedTeam = forumTeamName.trim();

    if (!trimmedTitle) {
      setCreateError('Please enter a title.');
      return;
    }

    if (!trimmedTeam) {
      setCreateError('Team forum not found.');
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
        body: JSON.stringify({ title: trimmedTitle, type: 'TEAM', teamName: trimmedTeam }),
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
      setTagInput('');
      setTags([]);
      setPostContent('');
      await refreshThreads();
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
              {forumTeamName ? `${forumTeamName} Threads` : 'Team Threads'}
            </h1>
            <p className="mt-4 text-base font-medium text-gray-600 dark:text-gray-300">
              Browse discussions for this team and start a new conversation.
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
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              disabled={!hasToken}
              className="w-full rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400"
            >
              {hasToken ? 'Create thread' : 'Sign in to create'}
            </button>
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
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm">We couldn't find any threads matching your current filters. Try adjusting your search or starting a new thread.</p>
              </div>
            ) : (
              pageThreads.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/forums/team/${teamId}/threads/${thread.id}`}
                  className="group block"
                >
                  <article className="flex flex-col gap-4 rounded-3xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-[#1f2937]/50 p-6 shadow-sm backdrop-blur-sm transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-emerald-200 dark:group-hover:border-emerald-800/50">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {thread.title}
                        </h2>
                        <p className="mt-2 text-xs font-medium tracking-wide text-gray-500 dark:text-gray-400 uppercase">Started {formatDate(thread.createdAt)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-emerald-200/50 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 shadow-sm">
                          Team
                        </span>
                      </div>
                    </div>
                    {thread.tags && thread.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {thread.tags.map((tag) => (
                          <span
                            key={tag.name}
                            className="rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 shadow-sm"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                       <span className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Thread #{thread.id}
                       </span>
                       <div className="flex items-center gap-3">
                         {thread.author && (
                           <button
                             type="button"
                             onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/profile/${thread.author!.id}`); }}
                             className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                           >
                             @{thread.author.username}
                           </button>
                         )}
                         <span className="opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-1 text-emerald-600 dark:text-emerald-400 font-bold">
                           View Thread →
                         </span>
                       </div>
                    </div>
                  </article>
                </Link>
              ))
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Team Thread</h2>
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
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Team
                <input
                  type="text"
                  value={forumTeamName || 'Unknown team'}
                  readOnly
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#111827] px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none"
                />
              </label>
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
