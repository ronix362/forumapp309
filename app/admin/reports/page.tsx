'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

type ReportStatus = 'PENDING' | 'APPROVED' | 'DISMISSED';

type ReportItem = {
    id: number;
    reason: string;
    status: ReportStatus;
    createdAt: string;
    post?: {
        id: number;
        threadId?: number | null;
        content?: string | null;
        reportCount?: number | null;
        aiMaxScore?: number | null;
        thread?: {
            id: number;
            forum?: { type?: 'GENERAL' | 'MATCH' | 'TEAM' } | null;
        } | null;
    } | null;
    thread?: {
        id: number;
        title?: string | null;
        reportCount?: number | null;
        aiAvgScore?: number | null;
        forum?: { type?: 'GENERAL' | 'MATCH' | 'TEAM' } | null;
    } | null;
    poll?: {
        id: number;
        threadId?: number | null;
        pollDescription?: string | null;
        reportCount?: number | null;
        aiMaxScore?: number | null;
        thread?: {
            id: number;
            forum?: { type?: 'GENERAL' | 'MATCH' | 'TEAM' } | null;
        } | null;
    } | null;
};

type ReportsResponse = {
    topPostReports: ReportItem[];
    topThreadReports: ReportItem[];
    topPollReports: ReportItem[];
    postTotalCount: number;
    threadTotalCount: number;
    pollTotalCount: number;
    pageSize: number;
    error?: string;
};

const TABS = [
    { id: 'posts', label: 'Posts', icon: '📝' },
    { id: 'threads', label: 'Threads', icon: '🧵' },
    { id: 'polls', label: 'Polls', icon: '📊' },
];

function ScrollableCell({ text, maxHeight = "max-h-24" }: { text?: string | null, maxHeight?: string }) {
    if (!text) return <span className="text-gray-400 italic">No content</span>;
    return (
        <div className={`overflow-y-auto pr-2 text-sm leading-relaxed whitespace-pre-wrap ${maxHeight} scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600`}>
            {text}
        </div>
    );
}

function getTargetHref(report: ReportItem) {
    const typeToSegment = (type?: string) => type?.toLowerCase() || 'general';
    if (report.post) {
        const threadId = report.post.threadId ?? report.post.thread?.id;
        const segment = typeToSegment(report.post.thread?.forum?.type);
        return `/forums/${segment}/threads/${threadId}/posts/${report.post.id}`;
    }
    if (report.poll) {
        const threadId = report.poll.threadId ?? report.poll.thread?.id;
        const segment = typeToSegment(report.poll.thread?.forum?.type);
        return `/forums/${segment}/threads/${threadId}/polls/${report.poll.id}`;
    }
    if (report.thread) {
        const segment = typeToSegment(report.thread.forum?.type);
        return `/forums/${segment}/threads/${report.thread.id}`;
    }
    return '#';
}

export default function ReportsPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'posts' | 'threads' | 'polls'>('posts');
    const [searchQuery, setSearchQuery] = useState('');
    const [data, setData] = useState<ReportsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [postPage, setPostPage] = useState(1);
    const [threadPage, setThreadPage] = useState(1);
    const [pollPage, setPollPage] = useState(1);

    useEffect(() => {
        const fetchReports = async () => {
            const token = localStorage.getItem('accessToken');
            if (!token) { router.push('/login'); return; }
            try {
                const res = await fetch(`/api/users/reports?postPage=${postPage}&threadPage=${threadPage}&pollPage=${pollPage}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Failed to fetch reports');
                setData(result);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchReports();
    }, [router, postPage, threadPage, pollPage]);

    // Client-side filtering logic for the Search Bar
    const filteredReports = useMemo(() => {
        if (!data) return [];
        const reports = activeTab === 'posts' ? data.topPostReports : activeTab === 'threads' ? data.topThreadReports : data.topPollReports;
        
        if (!searchQuery.trim()) return reports;

        const query = searchQuery.toLowerCase();
        return reports.filter(r => {
            const content = (r.post?.content || r.thread?.title || r.poll?.pollDescription || '').toLowerCase();
            const reason = r.reason.toLowerCase();
            const aiScore = (r.poll?.aiMaxScore ?? r.thread?.aiAvgScore ?? r.post?.aiMaxScore ?? 0).toString();
            const reportsCount = (r.post?.reportCount ?? r.thread?.reportCount ?? r.poll?.reportCount ?? 0).toString();

            return content.includes(query) || reason.includes(query) || aiScore.includes(query) || reportsCount.includes(query);
        });
    }, [data, activeTab, searchQuery]);

    if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-500 font-bold">📡 Syncing Moderation Data...</div>;
    if (error || !data) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4"><div className="bg-red-100 text-red-700 p-6 rounded-2xl border-l-8 border-red-500 shadow-lg">{error}</div></div>;

    const currentPage = activeTab === 'posts' ? postPage : activeTab === 'threads' ? threadPage : pollPage;
    const setPage = activeTab === 'posts' ? setPostPage : activeTab === 'threads' ? setThreadPage : setPollPage;
    const totalCount = activeTab === 'posts' ? data.postTotalCount : activeTab === 'threads' ? data.threadTotalCount : data.pollTotalCount;
    const totalPages = Math.max(1, Math.ceil(totalCount / data.pageSize));

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f172a] py-10 px-4 transition-colors duration-300">
            <div className="max-w-7xl mx-auto space-y-6">
                
                <header className="space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Admin Moderation</h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Search and manage pending reports.</p>
                        </div>
                        <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1.5 rounded-2xl shadow-inner border border-slate-200 dark:border-slate-700">
                            {TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => { setActiveTab(tab.id as any); setSearchQuery(''); }}
                                    className={`px-6 py-2.5 text-sm font-black rounded-xl transition-all flex items-center gap-2 ${
                                        activeTab === tab.id 
                                        ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-lg' 
                                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
                                    }`}
                                >
                                    <span>{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Search Bar Section */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-slate-400 group-focus-within:text-blue-500 transition-colors">🔍</span>
                        </div>
                        <input
                            type="text"
                            placeholder={`Search ${activeTab} by content, reason, or score...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-12 pr-12 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none shadow-sm transition-all"
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-rose-500 transition-colors"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </header>

                <main className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse table-fixed">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                    <th className="w-24 px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Reports</th>
                                    <th className="w-24 px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">AI Score</th>
                                    <th className="w-1/3 px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Reason</th>
                                    <th className="w-1/3 px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Target Content</th>
                                    <th className="w-32 px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {filteredReports.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-32 text-center text-slate-400 font-medium">
                                            <div className="text-4xl mb-4">🔦</div>
                                            No reports match your current search in {activeTab}.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredReports.map((report) => (
                                        <tr key={report.id} className="align-top hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                                            <td className="px-6 py-6">
                                                <div className="inline-flex items-center justify-center bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 px-3 py-1 rounded-xl text-xs font-black ring-1 ring-rose-200 dark:ring-rose-800">
                                                    {report.post?.reportCount ?? report.thread?.reportCount ?? report.poll?.reportCount ?? 0}
                                                </div>
                                            </td>
                                            <td className="px-6 py-6">
                                                <span className={`text-sm font-mono font-bold ${
                                                    (report.poll?.aiMaxScore ?? report.thread?.aiAvgScore ?? report.post?.aiMaxScore ?? 0) > 0.7 
                                                    ? 'text-orange-500' : 'text-slate-400'
                                                }`}>
                                                    {((report.poll?.aiMaxScore ?? report.thread?.aiAvgScore ?? report.post?.aiMaxScore ?? 0)).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-6">
                                                <ScrollableCell text={report.reason} />
                                            </td>
                                            <td className="px-6 py-6">
                                                <div className="mb-2">
                                                    <Link href={getTargetHref(report)} className="text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-tighter hover:underline">
                                                        View Context ↗
                                                    </Link>
                                                </div>
                                                <ScrollableCell text={
                                                    activeTab === 'posts' ? report.post?.content : 
                                                    activeTab === 'threads' ? report.thread?.title : 
                                                    report.poll?.pollDescription
                                                } />
                                            </td>
                                            <td className="px-6 py-6 text-right">
                                                <Link 
                                                    href={`/admin/reports/${report.id}`}
                                                    className="inline-block bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-5 py-2.5 rounded-xl text-xs font-black hover:scale-105 active:scale-95 transition-all shadow-md"
                                                >
                                                    Review
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </main>

                <footer className="flex items-center justify-between bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-lg">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-6 py-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                        ← Prev
                    </button>
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-black text-slate-300 uppercase">Page</span>
                        <div className="bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white w-10 h-10 flex items-center justify-center rounded-xl text-sm font-black ring-1 ring-slate-200 dark:ring-slate-700">
                            {currentPage}
                        </div>
                        <span className="text-xs font-black text-slate-300 uppercase">of {totalPages}</span>
                    </div>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="px-6 py-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                        Next →
                    </button>
                </footer>
            </div>
        </div>
    );
}