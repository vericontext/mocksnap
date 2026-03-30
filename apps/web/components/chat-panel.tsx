'use client';

import { useState } from 'react';
import { modifyMock } from '@/lib/api-client';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  changes?: string[];
}

interface Props {
  mockId: string;
  onMockUpdated: () => void;
}

export default function ChatPanel({ mockId, onMockUpdated }: Props) {
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const apiKey = typeof window !== 'undefined' ? localStorage.getItem('mocksnap_api_key') || '' : '';

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    const userMsg = message.trim();
    setMessage('');
    setError('');
    setHistory((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const result = await modifyMock(mockId, userMsg, apiKey || undefined);
      setHistory((prev) => [
        ...prev,
        { role: 'assistant', content: result.message, changes: result.changes },
      ]);
      onMockUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
        <h3 className="font-medium">Modify API</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Describe changes in natural language.
          {!apiKey && <span className="text-amber-500 dark:text-amber-400"> Set your Anthropic API key on the home page to enable this feature.</span>}
        </p>
      </div>

      {history.length > 0 && (
        <div className="max-h-64 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800">
          {history.map((msg, i) => (
            <div key={i} className={`px-4 py-2 text-sm ${msg.role === 'user' ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}>
              <span className="font-medium text-xs text-gray-400">{msg.role === 'user' ? 'You' : 'MockSnap'}</span>
              <p className="mt-0.5">{msg.content}</p>
              {msg.changes && msg.changes.length > 0 && (
                <ul className="mt-1 text-xs text-gray-500 list-disc list-inside">
                  {msg.changes.map((c, j) => <li key={j}>{c}</li>)}
                </ul>
              )}
            </div>
          ))}
          {loading && (
            <div className="px-4 py-2 text-sm text-gray-400">
              AI is modifying the API...
            </div>
          )}
        </div>
      )}

      {error && <p className="px-4 py-2 text-red-400 text-sm">{error}</p>}

      <div className="p-3 flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={apiKey ? 'e.g. "Add a tags resource linked to posts" or "Add email field to users"' : 'API key required — set it on the home page first'}
          disabled={loading || !apiKey}
          className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={handleSend}
          disabled={loading || !message.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
