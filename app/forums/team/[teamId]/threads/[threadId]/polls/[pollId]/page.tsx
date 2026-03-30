'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';

type PollOption = {
  id: number;
  text: string;
};

type PollAuthor = {
  id: number;
  username: string;
};

type PollThread = {
  id: number;
  title: string;
};

type PollRecord = {
  id: number;
  pollDescription: string;
  deadline: string;
  createdAt: string;
  options?: PollOption[];
  author?: PollAuthor;
  thread?: PollThread;
  visibility?: boolean;
};

type PollResults = {
  options: PollOption[];
  counts: number[];
};

const formatDate = (isoString: string) => {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const toDateTimeLocal = (isoString: string) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const parseJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export default function TeamPollPage() {
  const params = useParams();
  const router = useRouter();
  const pollId = Number(params.pollId);
  const threadId = Number(params.threadId);
  const rawTeamId = params?.teamId;
  const teamId = Array.isArray(rawTeamId) ? rawTeamId[0] : rawTeamId;

  const [poll, setPoll] = useState<PollRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('USER');
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editDescription, setEditDescription] = useState<string>('');
  const [editDeadline, setEditDeadline] = useState<string>('');
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string>('');

  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [confirmTitle, setConfirmTitle] = useState<string>('');
  const [confirmDescription, setConfirmDescription] = useState<string>('');
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null);
  const [confirmBusy, setConfirmBusy] = useState<boolean>(false);

  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [voteStatus, setVoteStatus] = useState<string>('');
  const [voteError, setVoteError] = useState<string>('');

  const [results, setResults] = useState<PollResults | null>(null);
  const [resultsLoading, setResultsLoading] = useState<boolean>(false);
  const [resultsError, setResultsError] = useState<string>('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    setHasToken(Boolean(token));
    if (token) {
      const decoded = parseJwt(token);
      if (decoded && decoded.id) {
        setCurrentUserId(decoded.id);
        setCurrentUserRole(decoded.role);
      }
    }
  }, []);

  const loadPoll = useCallback(async () => {
    if (!pollId || Number.isNaN(pollId)) {
      setError('Invalid poll id.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/polls/${pollId}`);
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || 'Failed to load poll');
      }
      const data = (await response.json()) as PollRecord;
      setPoll(data);      
      if(data.visibility === false) {
        router.push(`/forums/team/${params.teamId}/threads/${params.threadId}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load poll');
      setPoll(null);
    } finally {
      setIsLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    loadPoll();
  }, [loadPoll]);

  const loadResults = useCallback(async () => {
    if (!pollId || Number.isNaN(pollId)) return;
    setResultsLoading(true);
    setResultsError('');

    try {
      const response = await fetch(`/api/polls/${pollId}/results`);
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || 'Failed to load results');
      }
      const data = (await response.json()) as PollResults;
      setResults(data);
    } catch (err: any) {
      setResultsError(err.message || 'Failed to load results');
      setResults(null);
    } finally {
      setResultsLoading(false);
    }
  }, [pollId]);

  const handleVote = async () => {
    if (!hasToken || selectedOptionIndex === null || !poll) return;
    setVoteStatus('');
    setVoteError('');

    const token = localStorage.getItem('accessToken');
    if (!token) {
      setHasToken(false);
      setVoteError('Please sign in to vote.');
      return;
    }

    try {
      const response = await fetch(`/api/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ optionIndex: selectedOptionIndex + 1 }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Failed to submit vote');
      }
      setVoteStatus('Vote submitted!');
      await loadResults();
    } catch (err: any) {
      setVoteError(err.message || 'Failed to submit vote');
    }
  };

  const handleReport = async () => {
    if (!hasToken || !poll) return;
    const reason = window.prompt('Why are you reporting this poll?');
    if (!reason) return;

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setHasToken(false);
        setVoteError('Please sign in to report.');
        return;
      }
      const response = await fetch('/api/users/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason, targetId: poll.id, targetType: 'POLL' }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Failed to submit report');
      }
      setVoteStatus('Report submitted.');
    } catch (err: any) {
      setVoteError(err.message || 'Failed to submit report');
    }
  };

  const openEditModal = () => {
    if (!poll) return;
    setEditDescription(poll.pollDescription || '');
    setEditDeadline(poll.deadline ? toDateTimeLocal(poll.deadline) : '');
    setEditError('');
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (editSubmitting) return;
    setIsEditModalOpen(false);
    setEditDescription('');
    setEditDeadline('');
    setEditError('');
  };

  const openConfirm = (title: string, description: string, action: () => Promise<void>) => {
    setConfirmTitle(title);
    setConfirmDescription(description);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (confirmBusy) return;
    setConfirmOpen(false);
  };

  const handleConfirm = async () => {
    if (!confirmAction || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await confirmAction();
    } finally {
      setConfirmBusy(false);
      setConfirmOpen(false);
    }
  };

  const handleUpdatePoll = async () => {
    if (!hasToken || editSubmitting || !poll) return;
    setEditError('');

    const trimmed = editDescription.trim();
    if (!trimmed) {
      setEditError('Poll description is required.');
      return;
    }
    if (!editDeadline) {
      setEditError('Deadline is required.');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      setHasToken(false);
      setEditError('Please sign in to edit this poll.');
      return;
    }

    setEditSubmitting(true);
    try {
      const response = await fetch(`/api/polls/${poll.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pollDescription: trimmed,
          deadline: new Date(editDeadline).toISOString(),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Failed to update poll');
      }
      setIsEditModalOpen(false);
      setEditDescription('');
      setEditDeadline('');
      await loadPoll();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update poll');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeletePoll = async () => {
    if (!hasToken || !poll) return;
    setDeleteError('');

    openConfirm('Delete poll?', 'This will hide it for everyone.', async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setHasToken(false);
        setDeleteError('Please sign in to delete this poll.');
        return;
      }

      try {
        const response = await fetch(`/api/polls/${poll.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || 'Failed to delete poll');
        }
        router.push(`/forums/team/${teamId}/threads/${poll.thread?.id ?? threadId}`);
      } catch (err: any) {
        setDeleteError(err.message || 'Failed to delete poll');
      }
    });
  };

  const isExpired = useMemo(() => {
    if (!poll?.deadline) return false;
    return new Date(poll.deadline) < new Date();
  }, [poll?.deadline]);

  useEffect(() => {
    if (isExpired && !results && !resultsLoading) {
      loadResults();
    }
  }, [isExpired, loadResults, results, resultsLoading]);

  const totalVotes = useMemo(() => {
    if (!results) return 0;
    return results.counts.reduce((sum, value) => sum + value, 0);
  }, [results]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#111827]">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="h-32 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] shadow-sm" />
        </div>
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#111827]">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
            {error || 'Poll not found.'}
          </div>
        </div>
      </div>
    );
  }

  const threadTitle = poll.thread?.title || `Thread #${threadId || poll.thread?.id || ''}`;
  const isOwner = Boolean(currentUserId && poll.author?.id === currentUserId);
  const isAdmin = Boolean(currentUserRole === 'ADMIN');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#111827]">
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937]">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-500 dark:text-blue-400">Team Poll</p>
          <h1 className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">{poll.pollDescription}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
            <span>Thread:</span>
            <Link
              href={`/forums/team/${teamId}/threads/${poll.thread?.id ?? threadId}`}
              className="font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-800"
            >
              {threadTitle}
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>Created {formatDate(poll.createdAt)}</span>
            <span>Deadline {formatDate(poll.deadline)}</span>
            <span className="flex items-center gap-1">
              Author
              {poll.author?.username ? (
                <button
                  type="button"
                  onClick={() => router.push(`/profile/${poll.author!.id}`)}
                  className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline transition-colors"
                >
                  @{poll.author.username}
                </button>
              ) : (
                'Unknown'
              )}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 space-y-8">
        <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cast your vote</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {isExpired ? 'Voting has closed for this poll.' : 'Pick an option and submit your vote.'}
          </p>

          <div className="mt-4 space-y-3">
            {(poll.options || []).map((option, index) => (
              <label
                key={option.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${ selectedOptionIndex === index ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700' : 'border-gray-200 bg-white dark:bg-[#1f2937] text-gray-700 dark:text-gray-200 hover:border-blue-200' }`}
              >
                <input
                  type="radio"
                  name="poll-option"
                  checked={selectedOptionIndex === index}
                  onChange={() => setSelectedOptionIndex(index)}
                  className="h-4 w-4"
                  disabled={!hasToken || isExpired}
                />
                {option.text}
              </label>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleVote}
              disabled={!hasToken || selectedOptionIndex === null || isExpired}
              className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400"
            >
              {hasToken ? 'Cast vote' : 'Sign in to vote'}
            </button>
            <button
              type="button"
              onClick={handleReport}
              disabled={!hasToken}
              className="rounded-full border border-rose-200 px-5 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
            >
              Report poll
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={openEditModal}
                className="rounded-full border border-gray-200 dark:border-gray-700 px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Edit poll
              </button>
            )}
            {(isOwner || isAdmin) && (
              <button
                type="button"
                onClick={handleDeletePoll}
                className="rounded-full border border-red-200 dark:border-red-800 px-5 py-2 text-sm font-semibold text-red-700 dark:text-red-400 transition hover:bg-red-50"
              >
                Delete poll
              </button>
            )}
            <button
              type="button"
              onClick={loadResults}
              className="rounded-full border border-gray-200 dark:border-gray-700 px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              View results
            </button>
          </div>

          {voteStatus && <p className="mt-3 text-sm text-emerald-600">{voteStatus}</p>}
          {voteError && <p className="mt-3 text-sm text-rose-600">{voteError}</p>}
          {deleteError && <p className="mt-3 text-sm text-rose-600">{deleteError}</p>}
        </section>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Results</h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {results ? `${totalVotes} total votes` : 'Results not loaded yet'}
            </span>
          </div>

          {resultsLoading ? (
            <div className="mt-4 h-20 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#111827]" />
          ) : resultsError ? (
            <div className="mt-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
              {resultsError}
            </div>
          ) : results ? (
            <div className="mt-4 space-y-3">
              {results.options.map((option, index) => {
                const count = results.counts[index] || 0;
                const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                return (
                  <div key={option.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                    <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
                      <span className="font-semibold">{option.text}</span>
                      <span>
                        {count} votes · {percentage}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Click “View results” to see the latest tally.</p>
          )}
        </section>
      </main>

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1f2937] p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Poll</h2>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-full px-2 py-1 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Poll description
                <input
                  type="text"
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  placeholder="Poll question"
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none"
                />
              </label>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Deadline
                <input
                  type="datetime-local"
                  value={editDeadline}
                  onChange={(event) => setEditDeadline(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none"
                />
              </label>
              {editError && <p className="text-sm text-red-600 dark:text-red-400">{editError}</p>}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-full border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdatePoll}
                  disabled={editSubmitting}
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {editSubmitting ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        confirmDisabled={confirmBusy}
        onConfirm={handleConfirm}
        onClose={closeConfirm}
      />
    </div>
  );
}
