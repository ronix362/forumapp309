'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CreateReportButton from '@/components/Moderation/CreateReportButton';

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
			forum?: {
				type?: 'GENERAL' | 'MATCH' | 'TEAM';
			} | null;
		} | null;
	} | null;
	thread?: {
		id: number;
		title?: string | null;
		reportCount?: number | null;
		aiAvgScore?: number | null;
		forum?: {
			type?: 'GENERAL' | 'MATCH' | 'TEAM';
		} | null;
	} | null;
	poll?: {
		id: number;
		threadId?: number | null;
		pollDescription?: string | null;
		reportCount?: number | null;
		aiMaxScore?: number | null;
		thread?: {
			id: number;
			forum?: {
				type?: 'GENERAL' | 'MATCH' | 'TEAM';
			} | null;
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

function truncateText(value: string | null | undefined, maxLength: number) {
	if (!value) return '';
	return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function forumTypeToSegment(type?: 'GENERAL' | 'MATCH' | 'TEAM') {
	if (!type) return null;
	return type.toLowerCase();
}

function getTargetHref(report: ReportItem) {
	if (report.post) {
		const threadId = report.post.threadId ?? report.post.thread?.id;
		const forumSegment = forumTypeToSegment(report.post.thread?.forum?.type);
		if (threadId && forumSegment) {
			return `/forums/${forumSegment}/threads/${threadId}/posts/${report.post.id}`;
		}
	}

	if (report.poll) {
		const threadId = report.poll.threadId ?? report.poll.thread?.id;
		const forumSegment = forumTypeToSegment(report.poll.thread?.forum?.type);
		if (threadId && forumSegment) {
			return `/forums/${forumSegment}/threads/${threadId}/polls/${report.poll.id}`;
		}
	}

	if (report.thread) {
		const forumSegment = forumTypeToSegment(report.thread.forum?.type);
		if (forumSegment) {
			return `/forums/${forumSegment}/threads/${report.thread.id}`;
		}
	}

	return null;
}

function ReportSection({
	title,
	reports,
	emptyText,
	renderTarget,
}: {
	title: string;
	reports: ReportItem[];
	emptyText: string;
	renderTarget: (report: ReportItem) => string;
}) {
	return (
		<section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-4">
			<h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{title}</h2>

			{reports.length === 0 ? (
				<p className="text-sm text-gray-500 dark:text-gray-400">{emptyText}</p>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-600 dark:text-gray-300">
								<th className="text-center py-2 pr-4 w-16">Number of Reports</th>
								<th className="text-center py-2 pr-4 w-12">AI Score</th>
								<th className="py-2 pl-8">Reason</th>
								<th className=" py-2 pl-8 w-60">Target</th>
								<th className="text-center py-2 pr-4 w-28">Created</th>
								<th className="text-center py-2 w-16">Action</th>
							</tr>
						</thead>
						<tbody>
							{reports.map((report) => (
								<tr key={report.id} className="odd:bg-gray-300 dark:odd:bg-gray-700 border-b border-gray-100 dark:border-gray-700/70 text-gray-800 dark:text-gray-100">
									<td className="text-center py-2 pr-4">{report.post?.reportCount ?? report.thread?.reportCount ?? report.poll?.reportCount}</td>
									<td className="text-center py-2 pr-4">{report.poll?.aiMaxScore ?? report.thread?.aiAvgScore ?? report.post?.aiMaxScore}</td>
									<td className="py-2 pr-4">{truncateText(report.reason, 180)}</td>
									<td className="py-2 pr-4">
										{getTargetHref(report) ? (
											<Link href={getTargetHref(report)!} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
												{renderTarget(report)}
											</Link>
										) : (
											renderTarget(report)
										)}
									</td>
									<td className="text-center py-2 pr-4">{new Date(report.createdAt).toLocaleString()}</td>
									<td className="text-center py-2">
										<Link
											href={`/admin/reports/${report.id}`}
											className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
										>
											View
										</Link>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
}

function Pagination({ page, setPage, totalPages }: { page: number; setPage: React.Dispatch<React.SetStateAction<number>>; totalPages: number }) {
	return (
		<div className="flex items-center justify-between pt-1 pb-2">
			<button
				onClick={() => setPage((p) => Math.max(1, p - 1))}
				disabled={page === 1}
				className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
			>
				Previous
			</button>
			<span className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
			<button
				onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
				disabled={page >= totalPages}
				className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
			>
				Next
			</button>
		</div>
	);
}

export default function ReportsPage() {
	const router = useRouter();

	const [data, setData] = useState<ReportsResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');
	const [postPage, setPostPage] = useState(1);
	const [threadPage, setThreadPage] = useState(1);
	const [pollPage, setPollPage] = useState(1);

	useEffect(() => {
		const fetchReports = async () => {
			const token = localStorage.getItem('accessToken');

			if (!token) {
				router.push('/login');
				return;
			}

			try {
				const response = await fetch(`/api/users/reports?postPage=${postPage}&threadPage=${threadPage}&pollPage=${pollPage}`, {
					method: 'GET',
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});

				const result: ReportsResponse = await response.json();

				if (!response.ok) {
					throw new Error(result.error || 'Failed to fetch reports');
				}

				setData(result);
			} catch (err: any) {
				setError(err.message || 'Failed to load reports');
			} finally {
				setIsLoading(false);
			}
		};

		fetchReports();
	}, [router, postPage, threadPage, pollPage]);

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
				<p className="text-gray-500 dark:text-gray-400">Loading reports...</p>
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
				<div className="w-full max-w-lg p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md border-l-4 border-red-500">
					{error || 'Unable to load reports.'}
				</div>
			</div>
		);
	}

	const pageSize = data.pageSize || 10;
	const postTotalPages = Math.max(1, Math.ceil(data.postTotalCount / pageSize));
	const threadTotalPages = Math.max(1, Math.ceil(data.threadTotalCount / pageSize));
	const pollTotalPages = Math.max(1, Math.ceil(data.pollTotalCount / pageSize));

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
			<div className="max-w-6xl mx-auto space-y-6">
				<h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Reports</h1>

				<CreateReportButton />

				<ReportSection
					title="Top Post Reports"
					reports={data.topPostReports}
					emptyText="No pending post reports found."
					renderTarget={(report) => truncateText(report.post?.content, 80) || `Post #${report.post?.id ?? ''}`}
				/>
				<Pagination page={postPage} setPage={setPostPage} totalPages={postTotalPages} />

				<ReportSection
					title="Top Thread Reports"
					reports={data.topThreadReports}
					emptyText="No pending thread reports found."
					renderTarget={(report) => truncateText(report.thread?.title, 80) || `Thread #${report.thread?.id ?? ''}`}
				/>
				<Pagination page={threadPage} setPage={setThreadPage} totalPages={threadTotalPages} />

				<ReportSection
					title="Top Poll Reports"
					reports={data.topPollReports}
					emptyText="No pending poll reports found."
					renderTarget={(report) => truncateText(report.poll?.pollDescription, 80) || `Poll #${report.poll?.id ?? ''}`}
				/>
				<Pagination page={pollPage} setPage={setPollPage} totalPages={pollTotalPages} />
			</div>
		</div>
	);
}
