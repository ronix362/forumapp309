'use client';

import { useState } from 'react';

type TargetType = 'THREAD' | 'POST' | 'POLL';

export default function CreateReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('POST');
  const [targetId, setTargetId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    const token = localStorage.getItem('accessToken');
    if (!token) {
      setMessage('Not logged in.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/users/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason,
          targetType,
          targetId: Number(targetId),
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create report');
      setMessage('Report created successfully!');
      setReason('');
      setTargetId('');
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg"
        >
          + Create Report
        </button>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 w-80">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Create Report</h3>
            <button
              onClick={() => { setIsOpen(false); setMessage(''); }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Target Type</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as TargetType)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="POST">POST</option>
                <option value="THREAD">THREAD</option>
                <option value="POLL">POLL</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Target ID</label>
              <input
                type="number"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="e.g. 26"
                required
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for report..."
                required
                rows={3}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              />
            </div>

            {message && (
              <p className={`text-xs ${message.startsWith('Error') ? 'text-red-500' : 'text-green-500'}`}>
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium py-1.5 rounded-md"
            >
              {isLoading ? 'Submitting...' : 'Submit Report'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}