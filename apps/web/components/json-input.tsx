'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createMock } from '@/lib/api-client';

type InputMode = 'json' | 'prompt';

const JSON_PLACEHOLDER = `{
  "users": [
    { "id": 1, "name": "Kim Minjun", "email": "kim@example.com" },
    { "id": 2, "name": "Lee Sujin", "email": "lee@example.com" }
  ],
  "posts": [
    { "id": 1, "title": "Hello World", "userId": 1 }
  ]
}`;

const PROMPT_PLACEHOLDER = `유저 CRUD API + 주문 목록, 한국어 데이터로 생성해줘

Examples:
- "E-commerce API with users, products, and orders"
- "Blog API with authors, posts, comments, and tags"
- "Task management API with projects, tasks, and team members"`;

export default function JsonInput() {
  const [mode, setMode] = useState<InputMode>('json');
  const [json, setJson] = useState('');
  const [prompt, setPrompt] = useState('');
  const [name, setName] = useState('');
  const [amplify, setAmplify] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    setError('');

    if (mode === 'json') {
      const input = json.trim() || JSON_PLACEHOLDER;
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch {
        setError('Invalid JSON. Please check the syntax.');
        return;
      }

      setLoading(true);
      try {
        const mock = await createMock({ name: name || undefined, sample: parsed as Record<string, unknown>, amplify });
        router.push(`/mock/${mock.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    } else {
      const input = prompt.trim();
      if (!input) {
        setError('Please describe the API you want to create.');
        return;
      }

      setLoading(true);
      try {
        const mock = await createMock({ name: name || undefined, prompt: input });
        router.push(`/mock/${mock.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
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

      {/* Tab switcher */}
      <div className="flex border border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => { setMode('json'); setError(''); }}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
            mode === 'json' ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-gray-200'
          }`}
        >
          JSON Input
        </button>
        <button
          onClick={() => { setMode('prompt'); setError(''); }}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
            mode === 'prompt' ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-gray-200'
          }`}
        >
          Natural Language (AI)
        </button>
      </div>

      {mode === 'json' ? (
        <>
          <textarea
            value={json}
            onChange={(e) => { setJson(e.target.value); setError(''); }}
            placeholder={JSON_PLACEHOLDER}
            rows={16}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg font-mono text-sm focus:outline-none focus:border-blue-500 resize-y"
          />
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={amplify}
              onChange={(e) => setAmplify(e.target.checked)}
              className="rounded cursor-pointer"
            />
            AI data amplification (expand seed data to ~10 realistic items per resource)
          </label>
        </>
      ) : (
        <>
          <textarea
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setError(''); }}
            placeholder={PROMPT_PLACEHOLDER}
            rows={6}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-y"
          />
          <p className="text-xs text-gray-500">
            AI will design the API structure and generate ~10 realistic data items per resource.
          </p>
        </>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400 rounded-lg font-medium transition-colors cursor-pointer"
      >
        {loading
          ? mode === 'prompt' || amplify
            ? 'AI is generating data...'
            : 'Generating...'
          : 'Generate API'}
      </button>
    </div>
  );
}
