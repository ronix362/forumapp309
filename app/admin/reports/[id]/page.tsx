'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type ReportStatus = 'PENDING' | 'APPROVED' | 'DISMISSED';

type ReportDetail = {
    id: number;
    reason: string;
    status: ReportStatus;
    createdAt: string;
    user?: {
        id: number;
        username: string;
        email: string;
    } | null;
    post?: {
        id: number;
        content?: string | null;
        reportCount?: number | null;
        aiMaxScore?: number | null;
    } | null;
    thread?: {
        id: number;
        title?: string | null;
        reportCount?: number | null;
        aiAvgScore?: number | null;
    } | null;
    poll?: {
        id: number;
        pollDescription?: string | null; // Corrected to match your earlier schema
        reportCount?: number | null;
        aiMaxScore?: number | null;
    } | null;
};

export default function ReportDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const reportId = params?.id;

    const [report, setReport] = useState<ReportDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!reportId) return;
        const fetchReport = async () => {
            const token = localStorage.getItem('accessToken');
            if (!token) { router.push('/login'); return; }

            try {
                const response = await fetch(`/api/users/reports/${reportId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const result = await response.json();
                if (!response.ok || !result.report) throw new Error(result.error || 'Failed to fetch report');
                setReport(result.report);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchReport();
    }, [reportId, router]);

    const targetType = useMemo(() => {
        if (!report) return 'N/A';
        if (report.post) return 'POST';
        if (report.thread) return 'THREAD';
        if (report.poll) return 'POLL';
        return 'N/A';
    }, [report]);

    const aiScore = useMemo(() => {
        if (!report) return 0;
        return report.post?.aiMaxScore ?? report.poll?.aiMaxScore ?? report.thread?.aiAvgScore ?? 0;
    }, [report]);

    const handleStatusUpdate = async (status: 'APPROVED' | 'DISMISSED') => {
        if (!reportId) return;
        setIsUpdating(true);

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`/api/users/reports/${reportId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status }),
            });

            if (!response.ok) throw new Error('Failed to update report');
            
            // Success! Redirect back to the main moderation queue
            router.push('/admin/reports');
            router.refresh();
        } catch (err: any) {
            setError(err.message);
            setIsUpdating(false);
        }
    };

    if (isLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0f172a]">
            <div className="animate-pulse text-slate-400 font-black tracking-widest uppercase">Analyzing Evidence...</div>
        </div>
    );

    if (error || !report) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0f172a] p-4">
            <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 p-6 rounded-2xl border border-rose-200 dark:border-rose-800 max-w-md w-full text-center">
                <p className="font-bold">{error || 'Report Data Missing'}</p>
                <button onClick={() => router.back()} className="mt-4 text-sm underline">Return to Queue</button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] py-12 px-4 transition-colors">
            <div className="max-w-4xl mx-auto space-y-6">
                
                {/* Header / Back Navigation */}
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => router.push('/admin/reports')}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold transition-colors"
                    >
                        <span className="text-xl">←</span> Back to Queue
                    </button>
                    <div className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase shadow-sm ${
                        report.status === 'PENDING' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' : 'bg-slate-200 text-slate-600'
                    }`}>
                        Status: {report.status}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {/* Top Section: Quick Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100 dark:divide-slate-700 border-b border-slate-100 dark:border-slate-700">
                        <div className="p-6">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Report ID</p>
                            <p className="text-xl font-black text-slate-900 dark:text-white">#{report.id}</p>
                        </div>
                        <div className="p-6">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Target Type</p>
                            <p className="text-xl font-black text-blue-600 dark:text-blue-400">{targetType}</p>
                        </div>
						<div className="p-6">
						<p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">AI Toxicity</p>
						<p className={`text-xl font-black ${aiScore > 0.7 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
							{/* Fix: Check if score is already > 1 (like 99), otherwise multiply by 100 */}
							{aiScore > 1 ? Math.round(aiScore) : Math.round(aiScore * 100)}%
						</p>
						</div>
                        <div className="p-6">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Flags</p>
                            <p className="text-xl font-black text-slate-900 dark:text-white">
                                {report.post?.reportCount ?? report.thread?.reportCount ?? report.poll?.reportCount ?? 1}
                            </p>
                        </div>
                    </div>

                    <div className="p-8 space-y-8">
                        {/* Reporter Section */}
                        <section>
                            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-slate-300"></span> Reporter Information
                            </h3>
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <p className="text-slate-900 dark:text-white font-bold">@{report.user?.username || 'System'}</p>
                                <p className="text-slate-500 text-sm">{report.user?.email || 'N/A'}</p>
                            </div>
                        </section>

                        {/* Violation Section */}
                        <section>
                            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-rose-400"></span> Alleged Violation (Reason)
                            </h3>
                            <div className="bg-rose-50/50 dark:bg-rose-900/10 p-6 rounded-2xl border border-rose-100 dark:border-rose-900/30 text-slate-800 dark:text-slate-200 leading-relaxed font-medium italic">
                                "{report.reason}"
                            </div>
                        </section>

                        {/* Evidence Section */}
                        <section>
                            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-400"></span> Target Content (Evidence)
                            </h3>
                            <div className="bg-slate-900 text-slate-50 p-6 rounded-2xl font-mono text-sm leading-relaxed whitespace-pre-wrap shadow-inner ring-1 ring-white/10">
                                {report.post?.content || report.thread?.title || report.poll?.pollDescription || 'Content not found.'}
                            </div>
                        </section>

                        {/* Action Buttons */}
                        <div className="pt-6 flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={() => handleStatusUpdate('APPROVED')}
                                disabled={isUpdating || report.status !== 'PENDING'}
                                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 transition-all active:scale-95 disabled:opacity-30"
                            >
                                {isUpdating ? 'Executing...' : 'Approve & Remove'}
                            </button>
                            <button
                                onClick={() => handleStatusUpdate('DISMISSED')}
                                disabled={isUpdating || report.status !== 'PENDING'}
                                className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-95 disabled:opacity-30"
                            >
                                {isUpdating ? 'Executing...' : 'Dismiss Report'}
                            </button>
                        </div>
                    </div>
                </div>

                <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    Generated: {new Date(report.createdAt).toUTCString()}
                </p>
            </div>
        </div>
    );
}