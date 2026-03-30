'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';

type PostAuthor = {
  id: number;
  username: string;
};

type ThreadSummary = {
  id: number;
  title: string;
  mainPostId: number | null;
};

type ReplyRecord = {
  id: number;
  content: string;
  createdAt: string;
  author?: PostAuthor;
};

type PostRecord = {
  id: number;
  content: string;
  createdAt: string;
  previousVersionId?: number | null;
  nextVersionId?: number | null;
  author?: PostAuthor;
  thread?: ThreadSummary;
  replies?: ReplyRecord[];
  visibility?: boolean;
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

export default function GeneralPostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = Number(params.postId);
  const threadId = Number(params.threadId);

  const [post, setPost] = useState<PostRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('USER');
  const [reportStatus, setReportStatus] = useState<string>('');
  const [reportError, setReportError] = useState<string>('');
  const [visibleReplies, setVisibleReplies] = useState<number>(5);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editContent, setEditContent] = useState<string>('');
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string>('');

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [historyTracking, setHistoryTracking] = useState<PostRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string>('');

  const [translatedContent, setTranslatedContent] = useState<Record<number, string>>({});
  const [isTranslating, setIsTranslating] = useState<Record<number, boolean>>({});

  const [isPostModalOpen, setIsPostModalOpen] = useState<boolean>(false);
  const [postContent, setPostContent] = useState<string>('');
  const [postSubmitting, setPostSubmitting] = useState<boolean>(false);
  const [postCreateError, setPostCreateError] = useState<string>('');
  const [replyingToId, setReplyingToId] = useState<number | null>(null);

  const openPostModal = (targetReplyId?: number) => {
    setReplyingToId(targetReplyId ?? null);
    setPostContent('');
    setPostCreateError('');
    setIsPostModalOpen(true);
  };

  const closePostModal = () => {
    if (postSubmitting) return;
    setIsPostModalOpen(false);
    setPostContent('');
    setPostCreateError('');
    setReplyingToId(null);
  };

  const handleCreatePost = async () => {
    if (!hasToken || postSubmitting) return;
    setPostCreateError('');

    const trimmed = postContent.trim();
    if (!trimmed) {
      setPostCreateError('Post content cannot be empty.');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      setHasToken(false);
      setPostCreateError('Please sign in to post.');
      return;
    }

    setPostSubmitting(true);
    try {
      const response = await fetch(`/api/threads/${threadId}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: trimmed,
          replyingToId: replyingToId ?? postId,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Failed to create post');
      }
      setIsPostModalOpen(false);
      setPostContent('');
      router.push(`/forums/general/threads/${threadId}/posts/${body.id}`);
    } catch (err: any) {
      setPostCreateError(err.message || 'Failed to create post');
    } finally {
      setPostSubmitting(false);
    }
  };

  const handleTranslateToggle = async (targetPostId: number) => {
    if (translatedContent[targetPostId]) {
      setTranslatedContent(prev => {
        const next = { ...prev };
        delete next[targetPostId];
        return next;
      });
      return;
    }
    setIsTranslating(prev => ({ ...prev, [targetPostId]: true }));
    try {
      const res = await fetch(`/api/posts/${targetPostId}/translate`);
      if (res.ok) {
        const data = await res.json();
        setTranslatedContent(prev => ({ ...prev, [targetPostId]: data.translatedContent }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTranslating(prev => ({ ...prev, [targetPostId]: false }));
    }
  };

  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [confirmTitle, setConfirmTitle] = useState<string>('');
  const [confirmDescription, setConfirmDescription] = useState<string>('');
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null);
  const [confirmBusy, setConfirmBusy] = useState<boolean>(false);

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

  const loadPost = useCallback(async () => {
    if (!postId || Number.isNaN(postId)) {
      setError('Invalid post id.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/posts/${postId}`);
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || 'Failed to load post');
      }
      const data = (await response.json()) as PostRecord;
      setPost(data);      
      if(data.visibility === false) {
        router.push(`/forums/general/threads/${params.threadId}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load post');
      setPost(null);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const handleReport = async () => {
    if (!hasToken || !post) return;
    const reason = window.prompt('Why are you reporting this post?');
    if (!reason) return;

    setReportStatus('');
    setReportError('');

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setHasToken(false);
        setReportError('Please sign in to report.');
        return;
      }
      const response = await fetch('/api/users/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason, targetId: post.id, targetType: 'POST' }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Failed to submit report');
      }
      setReportStatus('Report submitted.');
    } catch (err: any) {
      setReportError(err.message || 'Failed to submit report');
    }
  };

  const openEditModal = () => {
    if (!post) return;
    setEditContent(post.content);
    setEditError('');
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (editSubmitting) return;
    setIsEditModalOpen(false);
    setEditContent('');
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

  const handleUpdatePost = async () => {
    if (!hasToken || editSubmitting || !post) return;
    setEditError('');

    const trimmed = editContent.trim();
    if (!trimmed) {
      setEditError('Post content cannot be empty.');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      setHasToken(false);
      setEditError('Please sign in to edit this post.');
      return;
    }

    setEditSubmitting(true);
    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: trimmed }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Failed to update post');
      }
      setIsEditModalOpen(false);
      setEditContent('');
      router.push(`/forums/general/threads/${post.thread?.id ?? threadId}/posts/${body.id}`);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update post');
    } finally {
      setEditSubmitting(false);
    }
  };

  const openHistoryModal = async () => {
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const response = await fetch(`/api/posts/${postId}/history`);
      if (!response.ok) {
        throw new Error('Failed to load version history');
      }
      const data = await response.json();
      setHistoryTracking(data);
    } catch (err: any) {
      setHistoryError(err.message || 'Failed to load version history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryModal = () => {
    setIsHistoryModalOpen(false);
  };

  const handleDeletePost = async () => {
    if (!hasToken || !post) return;
    setDeleteError('');

    openConfirm('Delete post?', 'This will hide it for everyone.', async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setHasToken(false);
        setDeleteError('Please sign in to delete this post.');
        return;
      }

      try {
        const response = await fetch(`/api/posts/${post.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || 'Failed to delete post');
        }
        router.push(`/forums/general/threads/${post.thread?.id ?? threadId}`);
      } catch (err: any) {
        setDeleteError(err.message || 'Failed to delete post');
      }
    });
  };

  const replies = useMemo(() => post?.replies || [], [post?.replies]);
  const displayedReplies = replies.slice(0, visibleReplies);
  const hasMoreReplies = replies.length > displayedReplies.length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#111827]">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="h-32 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] shadow-sm" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#111827]">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
            {error || 'Post not found.'}
          </div>
        </div>
      </div>
    );
  }

  const isMainPost = post.thread?.mainPostId === post.id;
  const threadTitle = post.thread?.title || `Thread #${threadId || post.thread?.id || ''}`;
  const isOwner = Boolean(currentUserId && post.author?.id === currentUserId);
  const isAdmin = Boolean(currentUserRole === "ADMIN");
  
  const previousVersionId = post.previousVersionId ?? null;
  const nextVersionId = post.nextVersionId ?? null;
  const isLatestVersion = !nextVersionId;

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-[#0B1121] selection:bg-amber-500/30">
      <header className="relative overflow-hidden border-b border-gray-200/50 dark:border-gray-800 bg-white/80 dark:bg-[#1f2937]/80 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-900/10 dark:to-transparent opacity-50" />
        <div className="relative mx-auto max-w-5xl px-6 py-12">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200/50 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-600 dark:border-amber-700/30 dark:bg-amber-900/20 dark:text-amber-400 shadow-sm">
            Post Details
          </div>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl">Post #{post.id}</h1>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm font-medium text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-2">Thread:</span>
            <Link
              href={`/forums/general/threads/${post.thread?.id ?? threadId}`}
              className="rounded-full border border-amber-200/50 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/20 px-4 py-1.5 font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition"
            >
              {threadTitle}
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                previousVersionId &&
                router.push(`/forums/general/threads/${post.thread?.id ?? threadId}/posts/${previousVersionId}`)
              }
              disabled={!previousVersionId}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 px-5 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 transition hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
            >
              <span className="text-lg leading-none">&#8592;</span> Previous Version
            </button>
            <button
              type="button"
              onClick={() =>
                nextVersionId &&
                router.push(`/forums/general/threads/${post.thread?.id ?? threadId}/posts/${nextVersionId}`)
              }
              disabled={!nextVersionId}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 px-5 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 transition hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
            >
              Next Version <span className="text-lg leading-none">&#8594;</span>
            </button>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-gray-200/50 dark:border-gray-800/50 pt-6 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <span>Posted {formatDate(post.createdAt)}</span>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600" />
              {post.author?.username ? (
                <button
                  type="button"
                  onClick={() => router.push(`/profile/${post.author!.id}`)}
                  className="text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300 font-bold hover:underline transition-colors"
                >
                  @{post.author.username}
                </button>
              ) : (
                'Unknown'
              )}
            </span>
            {isMainPost && (
              <>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span className="rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 shadow-sm">
                  Original Post
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 space-y-12">
        <section className={`rounded-3xl relative overflow-hidden p-8 shadow-sm backdrop-blur-sm transition-all duration-300 ${
          isMainPost 
            ? 'border border-indigo-200/50 dark:border-indigo-800/40 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-900/10 dark:to-[#1f2937]/50 shadow-md hover:shadow-lg' 
            : 'border border-gray-200/50 dark:border-gray-800 bg-white/70 dark:bg-[#1f2937]/50 hover:shadow-md'
        }`}>
          {isMainPost && (
            <div className="absolute top-0 right-0 rounded-bl-3xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm z-10">
              Original Post
            </div>
          )}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Post Content</h2>
            {(post.previousVersionId || post.nextVersionId) && (
              <button
                type="button"
                onClick={openHistoryModal}
                className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition"
              >
                View version history →
              </button>
            )}
          </div>
          <p className="text-lg leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{translatedContent[post.id] || post.content}</p>
          <div className="mt-4 flex justify-start">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleTranslateToggle(post.id);
              }}
              disabled={isTranslating[post.id]}
              className="text-[10px] font-bold uppercase tracking-wider text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300 transition"
            >
              {isTranslating[post.id] ? "Translating..." : translatedContent[post.id] ? "Show original" : "Translate"}
            </button>
          </div>
          
          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-gray-100 dark:border-gray-800/50 pt-6">
            <button
              type="button"
              onClick={handleReport}
              disabled={!hasToken}
              className="inline-flex items-center gap-2 rounded-full border border-rose-200/50 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-900/20 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 transition hover:bg-rose-100 dark:hover:bg-rose-900/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Report Post
            </button>
            <button
              type="button"
              onClick={() => openPostModal()}
              disabled={!hasToken}
              className="inline-flex items-center gap-2 rounded-full border border-amber-200/50 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/20 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 transition hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Reply to Post
            </button>
            {isLatestVersion && (
              <>
                {isOwner && (
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm"
                  >
                    Edit Post
                  </button>
                )}
                {(isOwner || isAdmin) && (
                  <button
                    type="button"
                    onClick={handleDeletePost}
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400 transition hover:bg-red-100 dark:hover:bg-red-900/40 shadow-sm"
                  >
                    Delete Post
                  </button>
                )}
              </>
            )}
          </div>
          {reportStatus && <p className="mt-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">{reportStatus}</p>}
          {reportError && <p className="mt-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3 text-sm font-medium text-rose-600 dark:text-rose-400">{reportError}</p>}
          {deleteError && <p className="mt-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3 text-sm font-medium text-rose-600 dark:text-rose-400">{deleteError}</p>}
        </section>

        <section className="rounded-3xl border border-gray-200/50 dark:border-gray-800 bg-white/70 dark:bg-[#1f2937]/50 p-8 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Replies</h2>
            <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              {replies.length} replies
            </span>
          </div>

          {replies.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30 py-12 text-center">
              <span className="text-2xl mb-2">💬</span>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No replies yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {displayedReplies.map((reply) => (
                <article key={reply.id} className="rounded-2xl border border-gray-200/50 dark:border-gray-700/50 bg-white dark:bg-[#1f2937] p-6 shadow-sm transition-all hover:shadow-md relative before:absolute before:left-0 before:top-4 before:bottom-4 before:w-1 before:rounded-r-full before:bg-amber-500/50 overflow-hidden">
                  <p className="text-base text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{translatedContent[reply.id] || reply.content}</p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 dark:border-gray-800/50 pt-4">
                    <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <span className="h-4 w-4 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600" />
                      {reply.author?.username ? (
                        <button
                          type="button"
                          onClick={() => router.push(`/profile/${reply.author!.id}`)}
                          className="text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300 font-bold hover:underline transition-colors"
                        >
                          @{reply.author.username}
                        </button>
                      ) : (
                        'Unknown'
                      )}
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      {formatDate(reply.createdAt)}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleTranslateToggle(reply.id);
                      }}
                      disabled={isTranslating[reply.id]}
                      className="text-[10px] font-bold uppercase tracking-wider text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300 transition"
                    >
                      {isTranslating[reply.id] ? "Translating..." : translatedContent[reply.id] ? "Show original" : "Translate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openPostModal(reply.id)}
                      disabled={!hasToken}
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Reply
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {hasMoreReplies && (
            <button
              type="button"
              onClick={() => setVisibleReplies((prev) => prev + 5)}
              className="mt-8 w-full rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 px-4 py-4 text-sm font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 transition hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm"
            >
              Show 5 more replies
            </button>
          )}
        </section>
      </main>

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1f2937] p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Post</h2>
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
                Content
                <textarea
                  value={editContent}
                  onChange={(event) => setEditContent(event.target.value)}
                  placeholder="Update your post"
                  rows={5}
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
                  onClick={handleUpdatePost}
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

      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#1f2937] p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Version History</h2>
              <button
                type="button"
                onClick={closeHistoryModal}
                className="rounded-full p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <span className="sr-only">Close</span>
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto mt-4 pr-2 space-y-6">
              {historyLoading ? (
                <div className="space-y-4 animate-pulse">
                  {[1, 2].map(i => (
                    <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-800 p-4">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
                      <div className="h-16 w-full bg-gray-100 dark:bg-gray-800 rounded" />
                    </div>
                  ))}
                </div>
              ) : historyError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
                  {historyError}
                </div>
              ) : historyTracking.length > 0 ? (
                <div className="relative border-l-2 border-indigo-100 dark:border-indigo-900/50 ml-3 pl-6 space-y-8">
                  {historyTracking.map((ver, idx) => {
                    const isCurrent = ver.id === post?.id;
                    const isLatest = idx === historyTracking.length - 1;
                    return (
                      <div key={ver.id} className="relative">
                        <div className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white dark:ring-[#1f2937] ${isCurrent ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            Version {idx + 1}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(ver.createdAt)}
                          </span>
                          {isCurrent && (
                            <span className="rounded bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                              Currently Viewing
                            </span>
                          )}
                          {isLatest && !isCurrent && (
                            <span className="rounded bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                              Latest
                            </span>
                          )}
                        </div>
                        <div className={`rounded-xl border p-4 shadow-sm text-sm whitespace-pre-wrap ${isCurrent ? 'border-indigo-200 bg-indigo-50/30 dark:border-indigo-800/50 dark:bg-indigo-900/10' : 'border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50'} text-gray-800 dark:text-gray-200`}>
                          {ver.content}
                        </div>
                        
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => {
                              closeHistoryModal();
                              const basePath = window.location.pathname.split('/posts/')[0];
                              router.push(`${basePath}/posts/${ver.id}`);
                            }}
                            className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                          >
                            View this version →
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No history available.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {isPostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1f2937] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {replyingToId ? `Reply to Post #${replyingToId}` : 'Add Reply'}
              </h2>
              <button
                type="button"
                onClick={closePostModal}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                ✕
              </button>
            </div>
            <div className="mt-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  Content
                </label>
                <textarea
                  value={postContent}
                  onChange={(event) => setPostContent(event.target.value)}
                  placeholder="What's on your mind?"
                  rows={6}
                  className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all"
                />
              </div>
              {postCreateError && (
                <p className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30">
                  {postCreateError}
                </p>
              )}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={closePostModal}
                  className="rounded-full px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreatePost}
                  disabled={postSubmitting}
                  className="rounded-full bg-amber-600 dark:bg-amber-500 px-8 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-amber-700 dark:hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-gray-200 dark:disabled:bg-gray-700 shadow-lg shadow-amber-600/20"
                >
                  {postSubmitting ? 'Posting...' : 'Post Reply'}
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
