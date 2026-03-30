'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import UserInfoCard from '@/components/Profile/UserInfoCard';
import FavoriteTeamCard from '@/components/Profile/FavoriteTeamCard';
import RecentThreads from '@/components/Profile/RecentThreads';
import RecentPosts from '@/components/Profile/RecentPosts';
import RecentReplies from '@/components/Profile/RecentReplies';
import ActivityChart from '@/components/Profile/ActivityChart';
import { AVAILABLE_AVATARS } from '@/contexts/ThemeContext';

const parseJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

type Team = { id: number; name: string; };

type ActivityPoint = {
  day: string;
  count: number;
};

type ProfileData = {
  user: { 
    id: number; 
    username: string; 
    email: string; 
    role: string; 
    banned?: boolean; 
    avatarId?: number;
    favoriteTeam: Team | null; 
  };
  stats: { followers: number; following: number; postCount: number; threadCount: number; };
  posts: any[];
  threads: any[];
  replies: any[]; 
  isFollowing?: boolean; 
};

const ITEMS_PER_PAGE = 8;

export default function ViewProfilePage() {
  const params = useParams();
  const router = useRouter();
  const profileId = Number(params.id); 

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activityData, setActivityData] = useState<ActivityPoint[]>([]);
  const [activityError, setActivityError] = useState('');

  const [activeTab, setActiveTab] = useState<'activity' | 'threads' | 'posts' | 'replies'>('activity');
  const [threadPage, setThreadPage] = useState(1);
  const [postPage, setPostPage] = useState(1);
  const [replyPage, setReplyPage] = useState(1); 

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false); 
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // Status of the profile being viewed
  const [targetIsBanned, setTargetIsBanned] = useState(false);
  // Status of the LOGGED IN user (the viewer)
  const [viewerIsBanned, setViewerIsBanned] = useState(false);
  
  const [isBanLoading, setIsBanLoading] = useState(false);
  const [isPromoteLoading, setIsPromoteLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      const decoded = parseJwt(token);
      if (decoded && decoded.id) {
        setCurrentUserId(decoded.id);
        setIsAdmin(decoded.role === 'ADMIN');
        
        // Fetch viewer's own status to see if they are banned
        fetch(`/api/users/${decoded.id}/profile`)
          .then(res => res.json())
          .then(data => {
            if (data.user?.banned) setViewerIsBanned(true);
          }).catch(() => {});
      }
    }

    if (!profileId) return;

    const fetchProfile = async () => {
      try {
        const headers: HeadersInit = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/users/${profileId}/profile`, { headers });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to fetch profile');
        
        setProfileData(data);
        
        if (typeof data.isFollowing === 'boolean') setIsFollowing(data.isFollowing);
        if (typeof data.user?.banned === 'boolean') setTargetIsBanned(data.user.banned);

      } catch (err: any) {
        setError(err.message);
      }
    };

    const fetchActivityData = async () => {
      try {
        const res = await fetch(`/api/users/${profileId}/activity`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch activity data');
        setActivityData(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setActivityError(err.message || 'Failed to load activity data');
      }
    };

    const loadPageData = async () => {
      await Promise.allSettled([fetchProfile(), fetchActivityData()]);
      setIsLoading(false);
    };

    loadPageData();
  }, [profileId]);

  const handleFollowToggle = async () => {
    if (!currentUserId) {
      router.push('/login');
      return;
    }
    // Prevent banned users from following
    if (viewerIsBanned) return;

    setIsFollowLoading(true);
    const token = localStorage.getItem('accessToken');
    try {
      if (isFollowing) {
        const res = await fetch('/api/users/following', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ followingId: profileId }) 
        });
        if (res.ok) {
          setIsFollowing(false);
          setProfileData(prev => prev ? { ...prev, stats: { ...prev.stats, followers: Math.max(0, prev.stats.followers - 1) } } : prev);
        }
      } else {
        const res = await fetch('/api/users/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ toFollowId: profileId }) 
        });
        if (res.ok) {
          setIsFollowing(true);
          setProfileData(prev => prev ? { ...prev, stats: { ...prev.stats, followers: prev.stats.followers + 1 } } : prev);
        }
      }
    } catch (err) {
      alert("Network error.");
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleBanToggle = async () => {
    if (!isAdmin) return;
    const actionText = targetIsBanned ? "unban" : "ban";
    if (!confirm(`Are you sure you want to ${actionText} @${profileData?.user.username}?`)) return;

    setIsBanLoading(true);
    const token = localStorage.getItem('accessToken');
    const endpoint = targetIsBanned ? '/api/users/unban' : '/api/users/ban';

    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId: profileId }) 
      });
      if (res.ok) {
        setTargetIsBanned(!targetIsBanned);
      }
    } catch (err) {
      alert("Network error.");
    } finally {
      setIsBanLoading(false);
    }
  };

  const handlePromote = async () => {
    if (!isAdmin) return;
    if (!confirm(`Are you sure you want to promote @${profileData?.user.username} to ADMIN? This will give them full moderation privileges.`)) return;

    setIsPromoteLoading(true);
    const token = localStorage.getItem('accessToken');

    try {
      const res = await fetch('/api/users/promote', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId: profileId }) 
      });
      
      if (res.ok) {
        setProfileData(prev => prev ? { ...prev, user: { ...prev.user, role: 'ADMIN' } } : prev);
        alert(`@${profileData?.user.username} has been successfully promoted to ADMIN.`);
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to promote user.");
      }
    } catch (err) {
      alert("Network error.");
    } finally {
      setIsPromoteLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#111827]">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#111827]">
        <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md border-l-4 border-red-500">
          {error || 'User not found.'}
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUserId === profileData.user.id;
  const showAdminControls = isAdmin && !isOwnProfile && profileData.user.role !== 'ADMIN';

  const threads = profileData.threads || [];
  const posts = profileData.posts || [];
  const replies = profileData.replies || []; 

  const totalThreadPages = Math.ceil(threads.length / ITEMS_PER_PAGE) || 1;
  const totalPostPages = Math.ceil(posts.length / ITEMS_PER_PAGE) || 1;
  const totalReplyPages = Math.ceil(replies.length / ITEMS_PER_PAGE) || 1; 

  const currentThreads = threads.slice((threadPage - 1) * ITEMS_PER_PAGE, threadPage * ITEMS_PER_PAGE);
  const currentPosts = posts.slice((postPage - 1) * ITEMS_PER_PAGE, postPage * ITEMS_PER_PAGE);
  const currentReplies = replies.slice((replyPage - 1) * ITEMS_PER_PAGE, replyPage * ITEMS_PER_PAGE); 

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#111827] py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      
      {targetIsBanned && (
        <div className="max-w-6xl mx-auto mb-6 bg-red-600 text-white p-4 rounded-xl text-center font-bold shadow-md">
          ⚠️ This account is currently suspended.
        </div>
      )}

      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
        
        {/* ================= LEFT SIDEBAR ================= */}
        <div className="w-full md:w-1/3 space-y-6">
          <UserInfoCard 
            user={{ ...profileData.user, avatarUrl: AVAILABLE_AVATARS[profileData.user.avatarId || 0] }} 
            stats={profileData.stats} 
          />
          
          <div className="space-y-3">
            {!isOwnProfile && currentUserId !== null && (
              <button 
                onClick={handleFollowToggle}
                // DISABLE: If loading OR if the target is banned OR if the VIEWER is banned
                disabled={isFollowLoading || targetIsBanned || viewerIsBanned}
                className={`w-full py-3 px-4 font-bold rounded-xl transition-all shadow-sm ${
                  viewerIsBanned 
                    ? 'bg-amber-100 text-amber-700 cursor-not-allowed border-amber-200 dark:bg-amber-900/20 dark:text-amber-500' 
                    : targetIsBanned
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800'
                    : isFollowing 
                    ? 'bg-gray-200 text-gray-800 hover:bg-red-100 hover:text-red-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-red-900/40 dark:hover:text-red-400' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-[1.02]'
                } disabled:opacity-70`}
              >
                {isFollowLoading 
                  ? 'Updating...' 
                  : viewerIsBanned 
                  ? 'Actions Restricted' 
                  : targetIsBanned 
                  ? 'Account Suspended' 
                  : isFollowing 
                  ? 'Unfollow' 
                  : 'Follow'}
              </button>
            )}

            {showAdminControls && (
              <>
                <button 
                  onClick={handleBanToggle}
                  disabled={isBanLoading}
                  className={`w-full py-3 px-4 font-bold rounded-xl border-2 transition-all shadow-sm ${
                    targetIsBanned 
                      ? 'border-green-600 text-green-600 hover:bg-green-50 dark:border-green-500 dark:text-green-500 dark:hover:bg-green-900/20' 
                      : 'border-red-600 text-red-600 hover:bg-red-50 dark:border-red-500 dark:text-red-500 dark:hover:bg-red-900/20'
                  } disabled:opacity-50`}
                >
                  {isBanLoading ? 'Processing...' : targetIsBanned ? '🛡️ Unban User' : '🛑 Ban User'}
                </button>

                <button 
                  onClick={handlePromote}
                  disabled={isPromoteLoading || targetIsBanned}
                  className="w-full py-3 px-4 font-bold rounded-xl border-2 transition-all shadow-sm border-purple-600 text-purple-600 hover:bg-purple-50 dark:border-purple-500 dark:text-purple-500 dark:hover:bg-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPromoteLoading ? 'Processing...' : '👑 Promote to Admin'}
                </button>
              </>
            )}
          </div>

          <FavoriteTeamCard team={profileData.user.favoriteTeam} />
        </div>

        {/* ================= RIGHT MAIN CONTENT ================= */}
        <div className="w-full md:w-2/3 flex flex-col space-y-6">
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-wrap">
            {['activity', 'threads', 'posts', 'replies'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 min-w-[100px] py-4 text-sm font-bold transition-colors capitalize ${
                  activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {tab} {tab !== 'activity' && `(${(profileData as any)[tab]?.length || 0})`}
              </button>
            ))}
          </div>

          <div className="flex-1">
            {activeTab === 'activity' && (
              <div className="animate-in fade-in duration-300">
                <div className="mb-4 px-2">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">Activity Timeline</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Snapshot of participation for @{profileData.user.username}.</p>
                </div>
                {activityError ? <p className="p-4 text-red-500">{activityError}</p> : <ActivityChart data={activityData} />}
              </div>
            )}

            {activeTab === 'threads' && (
              <div className="animate-in fade-in duration-300 space-y-4">
                <div className="mb-4 px-2">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">Started Threads</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Original topics by @{profileData.user.username}.</p>
                </div>
                <RecentThreads threads={currentThreads} />
                
                {/* Threads Pagination */}
                {totalThreadPages > 1 && (
                  <div className="flex justify-between items-center p-4 bg-white dark:bg-[#1f2937] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mt-4">
                    <button 
                      disabled={threadPage === 1} 
                      onClick={() => setThreadPage(p => p - 1)}
                      className="px-4 py-2 text-sm font-bold bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Previous
                    </button>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Page</span>
                      <input 
                        type="number" 
                        min={1} 
                        max={totalThreadPages} 
                        value={threadPage}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 1 && val <= totalThreadPages) {
                            setThreadPage(val);
                          }
                        }}
                        className="w-16 text-center text-sm font-bold bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md py-1 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">of {totalThreadPages}</span>
                    </div>

                    <button 
                      disabled={threadPage === totalThreadPages} 
                      onClick={() => setThreadPage(p => p + 1)}
                      className="px-4 py-2 text-sm font-bold bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'posts' && (
              <div className="animate-in fade-in duration-300 space-y-4">
                <div className="mb-4 px-2">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">Recent Posts</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Direct contributions by @{profileData.user.username}.</p>
                </div>
                <RecentPosts posts={currentPosts} />
                
                {/* Posts Pagination */}
                {totalPostPages > 1 && (
                  <div className="flex justify-between items-center p-4 bg-white dark:bg-[#1f2937] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mt-4">
                    <button 
                      disabled={postPage === 1} 
                      onClick={() => setPostPage(p => p - 1)}
                      className="px-4 py-2 text-sm font-bold bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Previous
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Page</span>
                      <input 
                        type="number" 
                        min={1} 
                        max={totalPostPages} 
                        value={postPage}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 1 && val <= totalPostPages) {
                            setPostPage(val);
                          }
                        }}
                        className="w-16 text-center text-sm font-bold bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md py-1 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">of {totalPostPages}</span>
                    </div>

                    <button 
                      disabled={postPage === totalPostPages} 
                      onClick={() => setPostPage(p => p + 1)}
                      className="px-4 py-2 text-sm font-bold bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'replies' && (
              <div className="animate-in fade-in duration-300 space-y-4">
                <div className="mb-4 px-2">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">Recent Replies</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Responses received by @{profileData.user.username}.</p>
                </div>
                <RecentReplies replies={currentReplies} />
                
                {/* Replies Pagination */}
                {totalReplyPages > 1 && (
                  <div className="flex justify-between items-center p-4 bg-white dark:bg-[#1f2937] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mt-4">
                    <button 
                      disabled={replyPage === 1} 
                      onClick={() => setReplyPage(p => p - 1)}
                      className="px-4 py-2 text-sm font-bold bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Previous
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Page</span>
                      <input 
                        type="number" 
                        min={1} 
                        max={totalReplyPages} 
                        value={replyPage}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 1 && val <= totalReplyPages) {
                            setReplyPage(val);
                          }
                        }}
                        className="w-16 text-center text-sm font-bold bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md py-1 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">of {totalReplyPages}</span>
                    </div>

                    <button 
                      disabled={replyPage === totalReplyPages} 
                      onClick={() => setReplyPage(p => p + 1)}
                      className="px-4 py-2 text-sm font-bold bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}