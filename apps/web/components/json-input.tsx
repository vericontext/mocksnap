'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createMock } from '@/lib/api-client';

const PLACEHOLDER = `{
  "users": [
    { "id": 1, "name": "Kim Minjun", "email": "kim@example.com" },
    { "id": 2, "name": "Lee Sujin", "email": "lee@example.com" }
  ],
  "posts": [
    { "id": 1, "title": "Hello World", "userId": 1 }
  ]
}`;

export default function JsonInput() {
  const [json, setJson] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    setError('');
    const input = json.trim() || PLACEHOLDER;

    let parsed: unknown;
    try {
      parsed = JSON.parse(input);
    } catch {
      setError('Invalid JSON. Please check the syntax.');
      return;
    }

    setLoading(true);
    try {
      const mock = await createMock(name, parsed);
      router.push(`/mock/${mock.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Mock API name (optional)"
        className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
      />
      <textarea
        value={json}
        onChange={(e) => { setJson(e.target.value); setError(''); }}
        placeholder={PLACEHOLDER}
        rows={16}
        className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg font-mono text-sm focus:outline-none focus:border-blue-500 resize-y"
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400 rounded-lg font-medium transition-colors cursor-pointer"
      >
        {loading ? 'Generating...' : 'Generate API'}
      </button>
    </div>
  );
}
