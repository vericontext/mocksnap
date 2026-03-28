'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchMock } from '@/lib/api-client';
import EndpointList from '@/components/endpoint-list';
import ApiPlayground from '@/components/api-playground';
import RequestLogs from '@/components/request-logs';
import ERDiagram from '@/components/er-diagram';
import ChatPanel from '@/components/chat-panel';
import type { CreateMockResponse } from '@mocksnap/shared';

export default function MockDashboard() {
  const params = useParams();
  const mockId = params.mockId as string;
  const [mock, setMock] = useState<CreateMockResponse | null>(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const loadMock = useCallback(() => {
    fetchMock(mockId)
      .then(setMock)
      .catch(() => setError('Mock not found'));
  }, [mockId]);

  useEffect(() => { loadMock(); }, [loadMock]);

  const handleMockUpdated = () => {
    loadMock();
    setRefreshKey((k) => k + 1);
  };

  if (error) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-2">Not Found</h1>
          <p className="text-gray-400">{error}</p>
          <a href="/" className="text-blue-500 dark:text-blue-400 hover:underline mt-4 inline-block">Back to home</a>
        </div>
      </main>
    );
  }

  if (!mock) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <a href="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">MockSnap</a>
        <h1 className="text-2xl font-bold mt-1">{mock.name || `Mock ${mock.id}`}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Created {new Date(mock.createdAt).toLocaleString()}</p>
      </div>

      <div className="space-y-8">
        <ERDiagram key={`er-${refreshKey}`} mockId={mock.id} />
        <ChatPanel mockId={mock.id} onMockUpdated={handleMockUpdated} />
        <EndpointList mockId={mock.id} resources={mock.resources} baseUrl={mock.baseUrl} graphqlUrl={mock.graphqlUrl} />
        <ApiPlayground baseUrl={mock.baseUrl} />
        <RequestLogs mockId={mock.id} />
      </div>
    </main>
  );
}
