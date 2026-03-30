'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

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
		question?: string | null;
		reportCount?: number | null;
		aiMaxScore?: number | null;
	} | null;
};

type GetReportResponse = {
	report?: ReportDetail;
	error?: string;
};

type UpdateReportResponse = {
	report?: ReportDetail;
	error?: string;
	message?: string;
};

export default function ReportDetailPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();

	const reportId = params?.id;

	const [report, setReport] = useState<ReportDetail | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isUpdating, setIsUpdating] = useState(false);
	const [error, setError] = useState('');
	const [message, setMessage] = useState('');

	useEffect(() => {
		if (!reportId) return;

		const fetchReport = async () => {
			const token = localStorage.getItem('accessToken');

			if (!token) {
				router.push('/login');
				return;
			}

			try {
				const response = await fetch(`/api/users/reports/${reportId}`, {
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});

				const result: GetReportResponse = await response.json();

				if (!response.ok || !result.report) {
					throw new Error(result.error || 'Failed to fetch report');
				}

				setReport(result.report);
			} catch (err: any) {
				setError(err.message || 'Failed to load report');
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

	const aiMaxScore = useMemo(() => {
		if (!report) return null;
		if (report.post?.aiMaxScore !== undefined && report.post?.aiMaxScore !== null) {
			return report.post.aiMaxScore;
		}
		if (report.poll?.aiMaxScore !== undefined && report.poll?.aiMaxScore !== null) {
			return report.poll.aiMaxScore;
		}
		return null;
	}, [report]);

	const handleStatusUpdate = async (status: 'APPROVED' | 'DISMISSED') => {
		if (!reportId) return;

		setIsUpdating(true);
		setError('');
		setMessage('');

		try {
			const token = localStorage.getItem('accessToken');
			if (!token) {
				router.push('/login');
				return;
			}

			const response = await fetch(`/api/users/reports/${reportId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ status }),
			});

			const result: UpdateReportResponse = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to update report');
			}

			if (result.report) {
				setReport(result.report);
			} else if (report) {
				setReport({ ...report, status });
			}

			setMessage(result.message || `Report ${status.toLowerCase()} successfully`);
		} catch (err: any) {
			setError(err.message || 'Failed to update report');
		} finally {
			setIsUpdating(false);
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
				<p className="text-gray-500 dark:text-gray-400">Loading report...</p>
			</div>
		);
	}

	if (error || !report) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
				<div className="w-full max-w-xl p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md border-l-4 border-red-500">
					{error || 'Report not found.'}
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
			<div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6 space-y-5">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white">Report #{report.id}</h1>
					<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{report.status}</span>
				</div>

				{message && (
					<div className="p-3 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded border-l-4 border-green-500">
						{message}
					</div>
				)}

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
					<div>
						<p className="text-gray-500 dark:text-gray-400">Type</p>
						<p className="text-gray-900 dark:text-white font-medium">{targetType}</p>
					</div>
					<div>
						<p className="text-gray-500 dark:text-gray-400">Created</p>
						<p className="text-gray-900 dark:text-white font-medium">{new Date(report.createdAt).toLocaleString()}</p>
					</div>
					<div>
						<p className="text-gray-500 dark:text-gray-400">Reported by</p>
						<p className="text-gray-900 dark:text-white font-medium">
							{report.user ? `${report.user.username} (${report.user.email})` : 'Unknown user'}
						</p>
					</div>
					<div>
						<p className="text-gray-500 dark:text-gray-400">AI Score</p>
						<p className="text-gray-900 dark:text-white font-medium">{aiMaxScore ?? 'N/A'}</p>
					</div>
					<div className="sm:col-span-2">
						<p className="text-gray-500 dark:text-gray-400">Reason</p>
						<p className="text-gray-900 dark:text-white font-medium">{report.reason}</p>
					</div>
					<div className="sm:col-span-2">
						<p className="text-gray-500 dark:text-gray-400">Target Content</p>
						<p className="text-gray-900 dark:text-white font-medium break-words">
							{report.post?.content || report.thread?.title || report.poll?.question || 'N/A'}
						</p>
					</div>
					{report.thread?.aiAvgScore !== undefined && report.thread?.aiAvgScore !== null && (
						<div>
							<p className="text-gray-500 dark:text-gray-400">Thread AI Avg Score</p>
							<p className="text-gray-900 dark:text-white font-medium">{report.thread.aiAvgScore}</p>
						</div>
					)}
				</div>

				<div className="flex gap-3 pt-2">
					<button
						type="button"
						onClick={() => handleStatusUpdate('APPROVED')}
						disabled={isUpdating || report.status !== 'PENDING'}
						className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isUpdating ? 'Updating...' : 'Approve'}
					</button>
					<button
						type="button"
						onClick={() => handleStatusUpdate('DISMISSED')}
						disabled={isUpdating || report.status !== 'PENDING'}
						className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isUpdating ? 'Updating...' : 'Dismiss'}
					</button>
				</div>
			</div>
		</div>
	);
}
