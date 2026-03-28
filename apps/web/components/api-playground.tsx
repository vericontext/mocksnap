'use client';

import { useState } from 'react';
import { sendRequest } from '@/lib/api-client';

interface Props {
  baseUrl: string;
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export default function ApiPlayground({ baseUrl }: Props) {
  const [method, setMethod] = useState<string>('GET');
  const [url, setUrl] = useState(baseUrl);
  const [body, setBody] = useState('');
  const [response, setResponse] = useState<{ status: number; data: unknown } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    setError('');
    setResponse(null);
    setLoading(true);

    try {
      const result = await sendRequest(url, method, body || undefined);
      setResponse(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const statusColor = response
    ? response.status < 300
      ? 'text-green-400'
      : response.status < 400
        ? 'text-yellow-400'
        : 'text-red-400'
    : '';

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
        <h3 className="font-medium">API Playground</h3>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-mono cursor-pointer"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-300 dark:disabled:bg-gray-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>

        {(method === 'POST' || method === 'PUT' || method === 'PATCH') && (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder='{"key": "value"}'
            rows={4}
            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg font-mono text-sm focus:outline-none focus:border-blue-500 resize-y"
          />
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {response && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Status:</span>
              <span className={`text-sm font-mono font-bold ${statusColor}`}>{response.status}</span>
            </div>
            <pre className="p-3 bg-gray-100 dark:bg-gray-900 rounded-lg text-sm font-mono overflow-x-auto max-h-80 overflow-y-auto">
              {JSON.stringify(response.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
