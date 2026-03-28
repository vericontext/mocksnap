'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchMock } from '@/lib/api-client';
import EndpointList from '@/components/endpoint-list';
import ApiPlayground from '@/components/api-playground';
import type { CreateMockResponse } from '@mocksnap/shared';

export default function MockDashboard() {
  const params = useParams();
  const mockId = params.mockId as string;
  const [mock, setMock] = useState<CreateMockResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMock(mockId)
      .then(setMock)
      .catch(() => setError('Mock not found'));
  }, [mockId]);

  if (error) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-2">Not Found</h1>
          <p className="text-gray-400">{error}</p>
          <a href="/" className="text-blue-400 hover:underline mt-4 inline-block">Back to home</a>
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
        <a href="/" className="text-sm text-gray-400 hover:text-gray-200">MockSnap</a>
        <h1 className="text-2xl font-bold mt-1">{mock.name || `Mock ${mock.id}`}</h1>
        <p className="text-sm text-gray-400 mt-1">Created {new Date(mock.createdAt).toLocaleString()}</p>
      </div>

      <div className="space-y-8">
        <EndpointList mockId={mock.id} resources={mock.resources} baseUrl={mock.baseUrl} graphqlUrl={mock.graphqlUrl} />
        <ApiPlayground baseUrl={mock.baseUrl} />
      </div>
    </main>
  );
}
