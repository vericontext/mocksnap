'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listMocks, deleteMockApi } from '@/lib/api-client';
import type { MockListItem } from '@mocksnap/shared';

export default function MocksListPage() {
  const [mocks, setMocks] = useState<MockListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const load = () => {
    listMocks().then((data) => {
      setMocks(data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleDelete = async (e: React.MouseEvent, mockId: string) => {
    e.stopPropagation();
    if (!confirm('Delete this mock API?')) return;
    await deleteMockApi(mockId);
    setMocks((prev) => prev.filter((m) => m.id !== mockId));
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <a href="/" className="text-sm text-gray-400 hover:text-gray-200">MockSnap</a>
          <h1 className="text-2xl font-bold mt-1">My Mock APIs</h1>
        </div>
        <a
          href="/"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
        >
          + Create New
        </a>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : mocks.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">No mock APIs yet.</p>
          <a href="/" className="text-blue-400 hover:underline">Create your first mock API</a>
        </div>
      ) : (
        <div className="space-y-3">
          {mocks.map((mock) => (
            <div
              key={mock.id}
              onClick={() => router.push(`/mock/${mock.id}`)}
              className="border border-gray-700 rounded-lg p-4 hover:border-gray-500 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{mock.name || `Mock ${mock.id}`}</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {mock.resourceCount} resource{mock.resourceCount !== 1 ? 's' : ''} &middot; Created{' '}
                    {new Date(mock.createdAt).toLocaleDateString()}
                  </p>
                  <code className="text-xs text-gray-500 mt-1 block">{mock.baseUrl}</code>
                </div>
                <button
                  onClick={(e) => handleDelete(e, mock.id)}
                  className="px-3 py-1 text-xs text-red-400 hover:bg-red-400/10 rounded transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
