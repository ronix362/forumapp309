'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';

const POSTS_PAGE_SIZE = 6;
const POLLS_PAGE_SIZE = 4;
const POSTS_FETCH_SIZE = 25;

type ThreadRecord = {
  id: number;
  title: string;
  authorId: number;
  author?: { id: number; username: string } | null;
  createdAt: string;
  tags?: { name: string }[];
  forum?: {
    teamName?: string | null;
    team?: { id: number; name: string };
  };
  visibility?: boolean;
  mainPostId?: number;
  mainPost?: PostRecord;
};

type PostRecord = {
  id: number;
  content: string;
  createdAt: string;
  authorId: number;
  author?: { id: number; username: string } | null;
  replyingToId?: number | null;
  visibility?: boolean;
};

type PollOption = {
  id: number;
  text: string;
};

type PollRecord = {
  id: number;
  pollDescription: string;
  deadline: string;
  authorId: number;
  author?: { id: number; username: string } | null;
  visibility?: boolean;
  options?: PollOption[];
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

export default function TeamThreadPage() {
  const params = useParams();
  const router = useRouter();
  const rawTeamId = params?.teamId;
  const teamId = Array.isArray(rawTeamId) ? rawTeamId[0] : rawTeamId;
  const threadId = Number(params.threadId);

  const [thread, setThread] = useState<ThreadRecord | null>(null);
  const [threadError, setThreadError] = useState<string>('');
  const [threadLoading, setThreadLoading] = useState<boolean>(true);

  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [postsQuery, setPostsQuery] = useState<string>('');
  const [postsPage, setPostsPage] = useState<number>(1);
  const [postsLoading, setPostsLoading] = useState<boolean>(true);
  const [postsError, setPostsError] = useState<string>('');
  const [expandedPosts, setExpandedPosts] = useState<Record<number, boolean>>({});

  const [polls, setPolls] = useState<PollRecord[]>([]);
  const [pollsQuery, setPollsQuery] = useState<string>('');
  const [pollsPage, setPollsPage] = useState<number>(1);
  const [pollsLoading, setPollsLoading] = useState<boolean>(true);
  const [pollsError, setPollsError] = useState<string>('');

  const [hasToken, setHasToken] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('USER');

  const [isPostModalOpen, setIsPostModalOpen] = useState<boolean>(false);
  const [postContent, setPostContent] = useState<string>('');
  const [postAsMain, setPostAsMain] = useState<boolean>(false);
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [postSubmitting, setPostSubmitting] = useState<boolean>(false);
  const [postCreateError, setPostCreateError] = useState<string>('');
  const [isEditPostModalOpen, setIsEditPostModalOpen] = useState<boolean>(false);
  const [editPostId, setEditPostId] = useState<number | null>(null);
  const [editPostContent, setEditPostContent] = useState<string>('');
  const [editPostSubmitting, setEditPostSubmitting] = useState<boolean>(false);
  const [editPostError, setEditPostError] = useState<string>('');
  const [deletePostError, setDeletePostError] = useState<string>('');

  const [isPollModalOpen, setIsPollModalOpen] = useState<boolean>(false);
  const [pollDescription, setPollDescription] = useState<string>('');
  const [pollOptionInput, setPollOptionInput] = useState<string>('');
  const [pollOptions, setPollOptions] = useState<string[]>([]);
  const [pollDeadline, setPollDeadline] = useState<string>('');
  const [pollSubmitting, setPollSubmitting] = useState<boolean>(false);
  const [pollCreateError, setPollCreateError] = useState<string>('');
  const [isEditPollModalOpen, setIsEditPollModalOpen] = useState<boolean>(false);
  const [editPollId, setEditPollId] = useState<number | null>(null);
  const [editPollDescription, setEditPollDescription] = useState<string>('');
  const [editPollDeadline, setEditPollDeadline] = useState<string>('');
  const [editPollSubmitting, setEditPollSubmitting] = useState<boolean>(false);
  const [editPollError, setEditPollError] = useState<string>('');
  const [deletePollError, setDeletePollError] = useState<string>('');

  const [translatedContent, setTranslatedContent] = useState<Record<number, string>>({});
  const [isTranslating, setIsTranslating] = useState<Record<number, boolean>>({});

  const handleTranslateToggle = async (postId: number) => {
    if (translatedContent[postId]) {
      setTranslatedContent(prev => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      return;
    }
    setIsTranslating(prev => ({ ...prev, [postId]: true }));
    try {
      const res = await fetch(`/api/posts/${postId}/translate`);
      if (res.ok) {
        const data = await res.json();
        setTranslatedContent(prev => ({ ...prev, [postId]: data.translatedContent }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTranslating(prev => ({ ...prev, [postId]: false }));
    }
  };

  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [confirmTitle, setConfirmTitle] = useState<string>('');
  const [confirmDescription, setConfirmDescription] = useState<string>('');
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null);
  const [confirmBusy, setConfirmBusy] = useState<boolean>(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState<string>('');
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string>('');
  const [initialEditTitle, setInitialEditTitle] = useState<string>('');
  const [initialEditTags, setInitialEditTags] = useState<string[]>([]);
  const [deleteSubmitting, setDeleteSubmitting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>('');

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

  const loadThread = useCallback(async () => {
    if (!threadId || Number.isNaN(threadId)) {
      setThreadError('Invalid thread id.');
      setThreadLoading(false);
      return;
    }

    setThreadLoading(true);
    setThreadError('');

    try {
      const response = await fetch(`/api/threads/${threadId}`);
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || 'Failed to load thread');
      }
      const data = (await response.json()) as ThreadRecord;
      setThread(data);
      if(data.visibility === false) {
        router.push(`/forums/team/${params.teamId}`);
      }
    } catch (err: any) {
      setThreadError(err.message || 'Failed to load thread');
      setThread(null);
    } finally {
      setThreadLoading(false);
    }
  }, [threadId]);

  const loadPosts = useCallback(async () => {
    if (!threadId || Number.isNaN(threadId)) return;

    setPostsLoading(true);
    setPostsError('');

    try {
      const allPosts: PostRecord[] = [];
      let page = 1;

      while (true) {
        const response = await fetch(
          `/api/threads/${threadId}/posts?page=${page}&postsPerPage=${POSTS_FETCH_SIZE}`
        );
        if (!response.ok) {
          const body = await response.json();
          throw new Error(body.error || 'Failed to load posts');
        }
        const data = (await response.json()) as PostRecord[];
        if (!Array.isArray(data)) break;

        allPosts.push(...data);

        if (data.length < POSTS_FETCH_SIZE) break;
        page += 1;
      }

      setPosts(allPosts);
    } catch (err: any) {
      setPostsError(err.message || 'Failed to load posts');
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [threadId]);

  const loadPolls = useCallback(async () => {
    if (!threadId || Number.isNaN(threadId)) return;

    setPollsLoading(true);
    setPollsError('');

    try {
      const response = await fetch(`/api/threads/${threadId}/polls`);
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || 'Failed to load polls');
      }
      const data = (await response.json()) as PollRecord[];
      const filtered = Array.isArray(data) ? data.filter((poll) => poll.visibility !== false) : [];
      setPolls(filtered);
    } catch (err: any) {
      setPollsError(err.message || 'Failed to load polls');
      setPolls([]);
    } finally {
      setPollsLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    loadThread();
    loadPosts();
    loadPolls();
  }, [loadThread, loadPosts, loadPolls]);

  useEffect(() => {
    setPostsPage(1);
  }, [postsQuery]);

  useEffect(() => {
    setPollsPage(1);
  }, [pollsQuery]);

  const isOwner = Boolean(thread && currentUserId && thread.authorId === currentUserId);
  const isAdmin = Boolean(currentUserRole === "ADMIN");

  const filteredPosts = useMemo(() => {
    const mainPosts = posts.filter((post) => 
      post.id !== thread?.mainPostId && 
      (!post.replyingToId || post.replyingToId === thread?.mainPostId)
    );
    if (!postsQuery.trim()) return mainPosts;
    const normalized = postsQuery.trim().toLowerCase();
    return mainPosts.filter((post) => post.content.toLowerCase().includes(normalized));
  }, [posts, postsQuery, thread?.mainPostId]);

  const filteredPolls = useMemo(() => {
    if (!pollsQuery.trim()) return polls;
    const normalized = pollsQuery.trim().toLowerCase();
    return polls.filter((poll) => poll.pollDescription.toLowerCase().includes(normalized));
  }, [polls, pollsQuery]);

  const postsTotalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PAGE_SIZE));
  const pollsTotalPages = Math.max(1, Math.ceil(filteredPolls.length / POLLS_PAGE_SIZE));

  const postsCurrentPage = Math.min(postsPage, postsTotalPages);
  const pollsCurrentPage = Math.min(pollsPage, pollsTotalPages);

  useEffect(() => {
    if (postsPage !== postsCurrentPage) setPostsPage(postsCurrentPage);
  }, [postsPage, postsCurrentPage]);

  useEffect(() => {
    if (pollsPage !== pollsCurrentPage) setPollsPage(pollsCurrentPage);
  }, [pollsPage, pollsCurrentPage]);

  const postsOnPage = useMemo(() => {
    const start = (postsCurrentPage - 1) * POSTS_PAGE_SIZE;
    return filteredPosts.slice(start, start + POSTS_PAGE_SIZE);
  }, [filteredPosts, postsCurrentPage]);

  const postsTree = useMemo(() => {
    const childrenMap = new Map<number | null, PostRecord[]>();

    posts.forEach((post) => {
      const parentId = (post.replyingToId === thread?.mainPostId || !post.replyingToId) ? null : post.replyingToId;
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)?.push(post);
    });

    childrenMap.forEach((list) => {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

    return {
      roots: postsOnPage,
      childrenMap,
    };
  }, [posts, postsOnPage]);

  const toggleReplies = (postId: number) => {
    setExpandedPosts((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const pollsOnPage = useMemo(() => {
    const start = (pollsCurrentPage - 1) * POLLS_PAGE_SIZE;
    return filteredPolls.slice(start, start + POLLS_PAGE_SIZE);
  }, [filteredPolls, pollsCurrentPage]);

  const handleCreatePost = async () => {
    if (!hasToken || postSubmitting) return;
    setPostCreateError('');

    const trimmedContent = postContent.trim();
    if (!trimmedContent) {
      setPostCreateError('Post content is required.');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      setHasToken(false);
      setPostCreateError('Please sign in to create a post.');
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
          content: trimmedContent,
          mainPostFor: isOwner && !replyingToId ? postAsMain : false,
          replyingToId: replyingToId ?? undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Failed to create post');
      }
      setIsPostModalOpen(false);
      setPostContent('');
      setPostAsMain(false);
      setReplyingToId(null);
      await loadPosts();
      await loadThread();
    } catch (err: any) {
      setPostCreateError(err.message || 'Failed to create post');
    } finally {
      setPostSubmitting(false);
    }
  };

  const handleCreatePoll = async () => {
    if (!hasToken || pollSubmitting) return;
    setPollCreateError('');

    const trimmedDescription = pollDescription.trim();
    const trimmedOptions = pollOptions.map((option) => option.trim()).filter(Boolean);

    if (!trimmedDescription) {
      setPollCreateError('Poll description is required.');
      return;
    }

    if (trimmedOptions.length < 2) {
      setPollCreateError('Please add at least two options.');
      return;
    }

    if (!pollDeadline) {
      setPollCreateError('Deadline is required.');
      return;
    }

    const deadlineDate = new Date(pollDeadline);
    if (Number.isNaN(deadlineDate.getTime())) {
      setPollCreateError('Please provide a valid deadline.');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      setHasToken(false);
      setPollCreateError('Please sign in to create a poll.');
      return;
    }

    setPollSubmitting(true);
    try {
      const response = await fetch(`/api/threads/${threadId}/polls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pollDescription: trimmedDescription,
          options: trimmedOptions,
          deadline: deadlineDate.toISOString(),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Failed to create poll');
      }
      setIsPollModalOpen(false);
      setPollDescription('');
      setPollOptionInput('');
      setPollOptions([]);
      setPollDeadline('');
      await loadPolls();
    } catch (err: any) {
      setPollCreateError(err.message || 'Failed to create poll');
    } finally {
      setPollSubmitting(false);
    }
  };

  const addPollOption = () => {
    const trimmed = pollOptionInput.trim();
    if (!trimmed) return;
    setPollOptions((prev) => [...prev, trimmed]);
    setPollOptionInput('');
  };

  const removePollOption = (index: number) => {
    setPollOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const closePostModal = () => {
    if (postSubmitting) return;
    setIsPostModalOpen(false);
    setPostContent('');
    setPostAsMain(false);
    setReplyingToId(null);
    setPostCreateError('');
  };

  const openPostModal = (replyToId?: number) => {
    setReplyingToId(replyToId ?? null);
    setIsPostModalOpen(true);
  };

  const openEditPostModal = (post: PostRecord) => {
    setEditPostId(post.id);
    setEditPostContent(post.content);
    setEditPostError('');
    setIsEditPostModalOpen(true);
  };

  const closeEditPostModal = () => {
    if (editPostSubmitting) return;
    setIsEditPostModalOpen(false);
    setEditPostId(null);
    setEditPostContent('');
    setEditPostError('');
  };

  const handleUpdatePost = async () => {
    if (!hasToken || editPostSubmitting || !editPostId) return;
    setEditPostError('');

    const trimmedContent = editPostContent.trim();
    if (!trimmedContent) {
      setEditPostError('Post content cannot be empty.');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      setHasToken(false);
      setEditPostError('Please sign in to edit this post.');
      return;
    }

    setEditPostSubmitting(true);
    try {
      const response = await fetch(`/api/posts/${editPostId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: trimmedContent }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Failed to update post');
      }
      setIsEditPostModalOpen(false);
      setEditPostId(null);
      setEditPostContent('');
      await loadPosts();
      await loadThread();
    } catch (err: any) {
      setEditPostError(err.message || 'Failed to update post');
    } finally {
      setEditPostSubmitting(false);
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!hasToken) return;
    setDeletePostError('');

    openConfirm('Delete post?', 'This will hide it for everyone.', async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setHasToken(false);
        setDeletePostError('Please sign in to delete this post.');
        return;
      }

      try {
        const response = await fetch(`/api/posts/${postId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || 'Failed to delete post');
        }
        await loadPosts();
        await loadThread();
      } catch (err: any) {
        setDeletePostError(err.message || 'Failed to delete post');
      }
    });
  };

  const closePollModal = () => {
    if (pollSubmitting) return;
    setIsPollModalOpen(false);
    setPollDescription('');
    setPollOptionInput('');
    setPollOptions([]);
    setPollDeadline('');
    setPollCreateError('');
  };

  const openEditPollModal = (poll: PollRecord) => {
    setEditPollId(poll.id);
    setEditPollDescription(poll.pollDescription || '');
    setEditPollDeadline(poll.deadline ? toDateTimeLocal(poll.deadline) : '');
    setEditPollError('');
    setIsEditPollModalOpen(true);
  };

  const closeEditPollModal = () => {
    if (editPollSubmitting) return;
    setIsEditPollModalOpen(false);
    setEditPollId(null);
    setEditPollDescription('');
    setEditPollDeadline('');
    setEditPollError('');
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
    if (!hasToken || editPollSubmitting || !editPollId) return;
    setEditPollError('');

    const trimmedDescription = editPollDescription.trim();
    if (!trimmedDescription) {
      setEditPollError('Poll description is required.');
      return;
    }
    if (!editPollDeadline) {
      setEditPollError('Deadline is required.');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      setHasToken(false);
      setEditPollError('Please sign in to edit this poll.');
      return;
    }

    setEditPollSubmitting(true);
    try {
      const response = await fetch(`/api/polls/${editPollId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pollDescription: trimmedDescription,
          deadline: new Date(editPollDeadline).toISOString(),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Failed to update poll');
      }
      setIsEditPollModalOpen(false);
      setEditPollId(null);
      setEditPollDescription('');
      setEditPollDeadline('');
      await loadPolls();
    } catch (err: any) {
      setEditPollError(err.message || 'Failed to update poll');
    } finally {
      setEditPollSubmitting(false);
    }
  };

  const handleDeletePoll = async (pollId: number) => {
    if (!hasToken) return;
    setDeletePollError('');

    openConfirm('Delete poll?', 'This will hide it for everyone.', async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setHasToken(false);
        setDeletePollError('Please sign in to delete this poll.');
        return;
      }

      try {
        const response = await fetch(`/api/polls/${pollId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || 'Failed to delete poll');
        }
        await loadPolls();
      } catch (err: any) {
        setDeletePollError(err.message || 'Failed to delete poll');
      }
    });
  };

  const openEditModal = () => {
    if (!thread) return;
    const currentTags = thread.tags?.map((tag) => tag.name) ?? [];
    setIsEditModalOpen(true);
    setEditTitle(thread.title || '');
    setEditTags(currentTags);
    setInitialEditTitle(thread.title || '');
    setInitialEditTags(currentTags);
    setEditTagInput('');
    setEditError('');
  };

  const closeEditModal = () => {
    if (editSubmitting) return;
    setIsEditModalOpen(false);
    setEditTitle('');
    setEditTags([]);
    setEditTagInput('');
    setEditError('');
  };

  const addEditTag = () => {
    const trimmed = editTagInput.trim().toLowerCase();
    if (!trimmed) return;
    const existing = editTags.map((tag) => tag.toLowerCase());
    if (existing.includes(trimmed)) {
      setEditTagInput('');
      return;
    }
    setEditTags((prev) => [...prev, trimmed]);
    setEditTagInput('');
  };

  const removeEditTag = (index: number) => {
    setEditTags((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateThread = async () => {
    if (!hasToken || !isOwner || editSubmitting) return;
    setEditError('');

    const token = localStorage.getItem('accessToken');
    if (!token) {
      setHasToken(false);
      setEditError('Please sign in to edit this thread.');
      return;
    }

    const trimmedTitle = editTitle.trim();
    const normalizedTags = editTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    const uniqueTags = [...new Set(normalizedTags)];

    const originalTitle = initialEditTitle.trim();
    const originalTags = [...new Set(initialEditTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];

    const titleChanged = trimmedTitle !== originalTitle;
    const tagsChanged =
      uniqueTags.sort().join(',') !== originalTags.sort().join(',');

    if (titleChanged && !trimmedTitle) {
      setEditError('Title cannot be empty.');
      return;
    }

    if (!titleChanged && !tagsChanged) {
      setEditError('No changes to save.');
      return;
    }

    const payload: { title?: string; tags?: string; replace?: boolean } = {};
    if (titleChanged) payload.title = trimmedTitle;
    if (tagsChanged) {
      payload.tags = uniqueTags.join(',');
      payload.replace = true;
    }

    setEditSubmitting(true);
    try {
      const response = await fetch(`/api/threads/${threadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Failed to update thread');
      }
      setIsEditModalOpen(false);
      await loadThread();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update thread');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteThread = async () => {
    if (!hasToken || (!isOwner && !isAdmin) || deleteSubmitting) return;
    setDeleteError('');
    openConfirm('Delete thread?', 'This will hide it for everyone.', async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setHasToken(false);
        setDeleteError('Please sign in to delete this thread.');
        return;
      }

      setDeleteSubmitting(true);
      try {
        const response = await fetch(`/api/threads/${threadId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || 'Failed to delete thread');
        }
        router.push(`/forums/team/${teamId}`);
      } catch (err: any) {
        setDeleteError(err.message || 'Failed to delete thread');
      } finally {
        setDeleteSubmitting(false);
      }
    });
  };

  if (threadLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#111827]">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="h-28 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] shadow-sm" />
        </div>
      </div>
    );
  }

  if (threadError || !thread) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#111827]">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
            {threadError || 'Thread not found.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-[#0B1121] selection:bg-emerald-500/30">
      <header className="relative overflow-hidden border-b border-gray-200/50 dark:border-gray-800 bg-white/80 dark:bg-[#1f2937]/80 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-900/10 dark:to-transparent opacity-50" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200/50 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:border-emerald-700/30 dark:bg-emerald-900/20 dark:text-emerald-400 shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            Team Thread
          </div>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl">{thread.title}</h1>
              {thread.tags && thread.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
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
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                <p className="flex items-center gap-2 rounded-full border border-emerald-200/50 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 font-bold text-emerald-700 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Team:{' '}
                  {thread.forum?.team?.name || thread.forum?.teamName ? (
                    <Link
                      href={`/teams/${teamId}`}
                      className="hover:text-emerald-800 dark:hover:text-emerald-300 underline decoration-transparent hover:decoration-emerald-400 transition"
                    >
                      {thread.forum?.team?.name || thread.forum?.teamName}
                    </Link>
                  ) : (
                    'Team TBD'
                  )}
                </p>
                <p className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Thread #{thread.id} <span className="text-gray-300 dark:text-gray-600">•</span> Opened {formatDate(thread.createdAt)}
                  {thread.author && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <button
                        type="button"
                        onClick={() => router.push(`/profile/${thread.author!.id}`)}
                        className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-5.5-2.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM10 12a5.98 5.98 0 00-4.793 2.391A6.483 6.483 0 0010 16.5a6.483 6.483 0 004.793-2.109A5.98 5.98 0 0010 12z" clipRule="evenodd" />
                        </svg>
                        @{thread.author.username}
                      </button>
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => openPostModal()}
                disabled={!hasToken}
                className="rounded-full bg-emerald-600 dark:bg-emerald-500 px-5 py-2.5 text-sm font-bold tracking-wide text-white transition hover:bg-emerald-700 dark:hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 shadow-sm"
              >
                {hasToken ? 'Add post' : 'Sign in to post'}
              </button>
              <button
                type="button"
                onClick={() => setIsPollModalOpen(true)}
                disabled={!hasToken}
                className="rounded-full border border-blue-200 bg-white dark:bg-[#1f2937] px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-400 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
              >
                {hasToken ? 'Create poll' : 'Sign in to poll'}
              </button>
              {isOwner && (
                <button
                  type="button"
                  onClick={openEditModal}
                  className="rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1f2937] px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Edit thread
                </button>
              )}
              {(isOwner || isAdmin) && (
                <button
                  type="button"
                  onClick={handleDeleteThread}
                  disabled={deleteSubmitting}
                  className="rounded-full border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-400 transition hover:bg-red-100 dark:hover:bg-red-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteSubmitting ? 'Deleting...' : 'Delete thread'}
                </button>
              )}
            </div>
            {deleteError && <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12 space-y-16">
        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Main Post</h2>
          {thread?.mainPost && thread.mainPost.visibility !== false ? (
            <div className="relative overflow-hidden rounded-3xl border border-emerald-200/50 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-900/10 dark:to-[#1f2937]/50 p-8 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg group">
              <Link
                href={`/forums/team/${teamId}/threads/${thread.id}/posts/${thread.mainPost.id}`}
                className="absolute inset-0 z-0"
              />
              <div className="pointer-events-none absolute top-0 right-0 rounded-bl-3xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm z-10">
                Original Post
              </div>
              <p className="relative z-10 text-lg leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap pointer-events-none">{translatedContent[thread.mainPost.id] || thread.mainPost.content}</p>
              <div className="relative z-10 mt-3 flex justify-start pointer-events-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTranslateToggle(thread.mainPost!.id);
                  }}
                  disabled={isTranslating[thread.mainPost.id]}
                  className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition"
                >
                  {isTranslating[thread.mainPost.id] ? "Translating..." : translatedContent[thread.mainPost.id] ? "Show original" : "Translate"}
                </button>
              </div>
              <div className="relative z-10 mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-emerald-100 dark:border-emerald-900/30 pt-4 pointer-events-none">
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <span>Posted {formatDate(thread.mainPost.createdAt)}</span>
                  {thread.mainPost.author && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <button
                        type="button"
                        onClick={() => router.push(`/profile/${thread.mainPost!.author!.id}`)}
                        className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors pointer-events-auto"
                      >
                        @{thread.mainPost.author.username}
                      </button>
                    </>
                  )}
                </div>
                <div className="flex gap-3 pointer-events-auto">
                  {currentUserId === thread.mainPost.authorId && (
                    <button
                      type="button"
                      onClick={() => openEditPostModal(thread.mainPost!)}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm"
                    >
                      Edit
                    </button>
                  )}
                  {(currentUserId === thread.mainPost.authorId || isAdmin) && (
                    <button
                      type="button"
                      onClick={() => handleDeletePost(thread.mainPost!.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400 transition hover:bg-red-100 dark:hover:bg-red-900/40 shadow-sm"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30 py-12 px-6 text-center backdrop-blur-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-3 text-lg">📝</span>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">There is no main post for this thread.</p>
            </div>
          )}
        </section>

        <section className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Posts</h2>
              <p className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-300">Search and browse posts in this thread.</p>
            </div>
            <div className="w-full max-w-sm rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-4 py-2 shadow-sm">
              <input
                type="text"
                value={postsQuery}
                onChange={(event) => setPostsQuery(event.target.value)}
                placeholder="Search posts"
                className="w-full bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
                aria-label="Search posts"
              />
            </div>
          </div>
          {deletePostError && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
              {deletePostError}
            </div>
          )}

          {postsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] shadow-sm" />
              ))}
            </div>
          ) : postsError ? (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">{postsError}</div>
          ) : postsOnPage.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] p-6 text-sm text-gray-500 dark:text-gray-400">
              No posts match your search.
            </div>
          ) : (
            <div className="space-y-4">
              {postsTree.roots.map((post) => {
                const renderPost = (node: PostRecord, depth: number) => {
                  const replies = postsTree.childrenMap.get(node.id) ?? [];
                  const hasReplies = replies.length > 0;
                  const expanded = expandedPosts[node.id] ?? false;

                  return (
                    <div key={node.id} style={{ marginLeft: depth * 24 }}>
                      <Link
                        href={`/forums/team/${teamId}/threads/${thread.id}/posts/${node.id}`}
                        className="block"
                      >
                        <article className="rounded-3xl border border-gray-200/50 dark:border-gray-800 bg-white/70 dark:bg-[#1f2937]/50 p-6 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md">
                          <p className="text-base leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{translatedContent[node.id] || node.content}</p>
                          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 dark:border-gray-800/50 pt-4">
                            <div className="flex items-center gap-3">
                               <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Posted {formatDate(node.createdAt)}</p>
                               {node.author && (
                                 <button
                                   type="button"
                                   onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/profile/${node.author!.id}`); }}
                                   className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                                 >
                                   @{node.author.username}
                                 </button>
                               )}
                             </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleTranslateToggle(node.id);
                              }}
                              disabled={isTranslating[node.id]}
                              className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition"
                            >
                              {isTranslating[node.id] ? "Translating..." : translatedContent[node.id] ? "Show original" : "Translate"}
                            </button>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gray-50/50 dark:bg-gray-800/30 p-3">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400 px-2">Post #{node.id}</span>
                            <div className="flex flex-wrap items-center gap-2">
                              {hasReplies && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    toggleReplies(node.id);
                                  }}
                                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                  {expanded ? 'Hide replies' : `Show replies (${replies.length})`}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (!hasToken) return;
                                  openPostModal(node.id);
                                }}
                                disabled={!hasToken}
                                className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <svg
                                  aria-hidden="true"
                                  viewBox="0 0 24 24"
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M9 14l-4-4 4-4" />
                                  <path d="M5 10h8a4 4 0 0 1 4 4v4" />
                                </svg>
                                Reply
                              </button>
                              {currentUserId === node.authorId && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    openEditPostModal(node);
                                  }}
                                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                  Edit
                                </button>
                              )}
                              {(currentUserId === node.authorId || isAdmin) && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    handleDeletePost(node.id);
                                  }}
                                  className="inline-flex items-center gap-2 rounded-full border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-1 text-xs font-semibold text-red-700 dark:text-red-400 transition hover:bg-red-100 dark:hover:bg-red-900/40"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      </Link>
                      {hasReplies && expanded && (
                        <div className="mt-3 space-y-3 border-l border-gray-200 dark:border-gray-700 pl-4">
                          {replies.map((reply) => renderPost(reply, depth + 1))}
                        </div>
                      )}
                    </div>
                  );
                };

                return renderPost(post, 0);
              })}
            </div>
          )}

          {!postsLoading && !postsError && filteredPosts.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(postsCurrentPage - 1) * POSTS_PAGE_SIZE + 1} -{' '}
                {Math.min(postsCurrentPage * POSTS_PAGE_SIZE, filteredPosts.length)} of {filteredPosts.length} posts
              </p>
              <div className="flex items-center gap-3">
                <button
                  className="rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setPostsPage((prev) => Math.max(1, prev - 1))}
                  disabled={postsCurrentPage === 1}
                >
                  Previous
                </button>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Page {postsCurrentPage} of {postsTotalPages}
                </span>
                <button
                  className="rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setPostsPage((prev) => Math.min(postsTotalPages, prev + 1))}
                  disabled={postsCurrentPage === postsTotalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-6 border-t border-gray-200/50 dark:border-gray-800 pt-16 mt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Polls</h2>
              <p className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-300">Check the live polls attached to this thread.</p>
            </div>
            <div className="w-full max-w-sm rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-4 py-2 shadow-sm">
              <input
                type="text"
                value={pollsQuery}
                onChange={(event) => setPollsQuery(event.target.value)}
                placeholder="Search polls"
                className="w-full bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
                aria-label="Search polls"
              />
            </div>
          </div>
          {deletePollError && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
              {deletePollError}
            </div>
          )}

          {pollsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] shadow-sm" />
              ))}
            </div>
          ) : pollsError ? (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">{pollsError}</div>
          ) : pollsOnPage.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] p-6 text-sm text-gray-500 dark:text-gray-400">
              No polls match your search.
            </div>
          ) : (
            <div className="space-y-4">
              {pollsOnPage.map((poll) => (
                <Link
                  key={poll.id}
                  href={`/forums/team/${teamId}/threads/${thread.id}/polls/${poll.id}`}
                  className="block"
                >
                  <article className="rounded-3xl border border-gray-200/50 dark:border-gray-800 bg-white/70 dark:bg-[#1f2937]/50 p-6 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md group">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{poll.pollDescription}</h3>
                    <div className="mt-3 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <span>Deadline {formatDate(poll.deadline)}</span>
                      {poll.author && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">•</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              router.push(`/profile/${poll.author!.id}`);
                            }}
                            className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors pointer-events-auto font-bold uppercase"
                          >
                            @{poll.author.username}
                          </button>
                        </>
                      )}
                    </div>
                    {poll.options && poll.options.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {poll.options.map((option) => (
                          <span
                            key={option.id}
                            className="rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 shadow-sm"
                          >
                            {option.text}
                          </span>
                        ))}
                      </div>
                    )}
                    {(currentUserId === poll.authorId || isAdmin) && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {currentUserId === poll.authorId && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              openEditPollModal(poll);
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleDeletePoll(poll.id);
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-1 text-xs font-semibold text-red-700 dark:text-red-400 transition hover:bg-red-100 dark:hover:bg-red-900/40"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </article>
                </Link>
              ))}
            </div>
          )}

          {!pollsLoading && !pollsError && filteredPolls.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(pollsCurrentPage - 1) * POLLS_PAGE_SIZE + 1} -{' '}
                {Math.min(pollsCurrentPage * POLLS_PAGE_SIZE, filteredPolls.length)} of {filteredPolls.length} polls
              </p>
              <div className="flex items-center gap-3">
                <button
                  className="rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setPollsPage((prev) => Math.max(1, prev - 1))}
                  disabled={pollsCurrentPage === 1}
                >
                  Previous
                </button>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Page {pollsCurrentPage} of {pollsTotalPages}
                </span>
                <button
                  className="rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setPollsPage((prev) => Math.min(pollsTotalPages, prev + 1))}
                  disabled={pollsCurrentPage === pollsTotalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {isPostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1f2937] p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Post</h2>
              <button
                type="button"
                onClick={closePostModal}
                className="rounded-full px-2 py-1 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Content
                <textarea
                  value={postContent}
                  onChange={(event) => setPostContent(event.target.value)}
                  placeholder="Write your post"
                  rows={5}
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none"
                />
              </label>
              {replyingToId && (
                <p className="text-xs text-blue-600 dark:text-blue-400">Replying to post #{replyingToId}</p>
              )}
              {isOwner && !replyingToId && (
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={postAsMain}
                    onChange={(event) => setPostAsMain(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                  />
                  Set as main post for this thread
                </label>
              )}
              {postCreateError && <p className="text-sm text-red-600 dark:text-red-400">{postCreateError}</p>}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closePostModal}
                  className="rounded-full border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreatePost}
                  disabled={postSubmitting}
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {postSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isPollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1f2937] p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Poll</h2>
              <button
                type="button"
                onClick={closePollModal}
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
                  value={pollDescription}
                  onChange={(event) => setPollDescription(event.target.value)}
                  placeholder="Poll question"
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none"
                />
              </label>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Options</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pollOptionInput}
                    onChange={(event) => setPollOptionInput(event.target.value)}
                    placeholder="Add an option"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addPollOption}
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 dark:hover:bg-gray-200 dark:bg-gray-100 dark:text-gray-900"
                  >
                    Add
                  </button>
                </div>
                {pollOptions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pollOptions.map((option, index) => (
                      <span
                        key={`${option}-${index}`}
                        className="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-900/30 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400"
                      >
                        {option}
                        <button
                          type="button"
                          onClick={() => removePollOption(index)}
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
                Deadline
                <input
                  type="datetime-local"
                  value={pollDeadline}
                  onChange={(event) => setPollDeadline(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none"
                />
              </label>
              {pollCreateError && <p className="text-sm text-red-600 dark:text-red-400">{pollCreateError}</p>}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closePollModal}
                  className="rounded-full border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreatePoll}
                  disabled={pollSubmitting}
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {pollSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditPollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1f2937] p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Poll</h2>
              <button
                type="button"
                onClick={closeEditPollModal}
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
                  value={editPollDescription}
                  onChange={(event) => setEditPollDescription(event.target.value)}
                  placeholder="Poll question"
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none"
                />
              </label>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Deadline
                <input
                  type="datetime-local"
                  value={editPollDeadline}
                  onChange={(event) => setEditPollDeadline(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none"
                />
              </label>
              {editPollError && <p className="text-sm text-red-600 dark:text-red-400">{editPollError}</p>}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditPollModal}
                  className="rounded-full border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdatePoll}
                  disabled={editPollSubmitting}
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {editPollSubmitting ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1f2937] p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Thread</h2>
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
                Title
                <input
                  type="text"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  placeholder="Thread title"
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none"
                />
              </label>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Tags</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editTagInput}
                    onChange={(event) => setEditTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addEditTag();
                      }
                    }}
                    placeholder="Add a tag"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addEditTag}
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 dark:hover:bg-gray-200 dark:bg-gray-100 dark:text-gray-900"
                  >
                    Add
                  </button>
                </div>
                {editTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {editTags.map((tag, index) => (
                      <span
                        key={`${tag}-${index}`}
                        className="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-900/30 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeEditTag(index)}
                          className="rounded-full px-1 text-xs text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">No tags yet. Add one above.</p>
                )}
              </div>
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
                  onClick={handleUpdateThread}
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

      {isEditPostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1f2937] p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Post</h2>
              <button
                type="button"
                onClick={closeEditPostModal}
                className="rounded-full px-2 py-1 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Content
                <textarea
                  value={editPostContent}
                  onChange={(event) => setEditPostContent(event.target.value)}
                  placeholder="Update your post"
                  rows={5}
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none"
                />
              </label>
              {editPostError && <p className="text-sm text-red-600 dark:text-red-400">{editPostError}</p>}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditPostModal}
                  className="rounded-full border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdatePost}
                  disabled={editPostSubmitting}
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {editPostSubmitting ? 'Saving...' : 'Save changes'}
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
