'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createMock } from '@/lib/api-client';

type InputMode = 'json' | 'prompt' | 'openapi';

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

const OPENAPI_PLACEHOLDER = `{
  "openapi": "3.0.0",
  "info": { "title": "Petstore", "version": "1.0.0" },
  "paths": {
    "/pets": { "get": { "summary": "List pets" } },
    "/pets/{id}": { "get": { "summary": "Get pet" } }
  },
  "components": {
    "schemas": {
      "Pet": {
        "type": "object",
        "properties": {
          "id": { "type": "integer" },
          "name": { "type": "string" },
          "status": { "type": "string" }
        }
      }
    }
  }
}`;

const TABS: { key: InputMode; label: string }[] = [
  { key: 'json', label: 'JSON' },
  { key: 'prompt', label: 'Natural Language' },
  { key: 'openapi', label: 'OpenAPI Spec' },
];

export default function JsonInput() {
  const [mode, setMode] = useState<InputMode>('json');
  const [json, setJson] = useState('');
  const [prompt, setPrompt] = useState('');
  const [openapi, setOpenapi] = useState('');
  const [name, setName] = useState('');
  const [amplify, setAmplify] = useState(true);
  const [apiKey, setApiKey] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('mocksnap_api_key') || '' : '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const saveApiKey = (key: string) => {
    setApiKey(key);
    if (key) localStorage.setItem('mocksnap_api_key', key);
    else localStorage.removeItem('mocksnap_api_key');
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      if (mode === 'json') {
        const input = json.trim() || JSON_PLACEHOLDER;
        let parsed: unknown;
        try {
          parsed = JSON.parse(input);
        } catch {
          setError('Invalid JSON. Please check the syntax.');
          setLoading(false);
          return;
        }
        const mock = await createMock({ name: name || undefined, sample: parsed as Record<string, unknown>, amplify, anthropicApiKey: apiKey || undefined });
        router.push(`/mock/${mock.id}`);
      } else if (mode === 'prompt') {
        const input = prompt.trim();
        if (!input) {
          setError('Please describe the API you want to create.');
          setLoading(false);
          return;
        }
        const mock = await createMock({ name: name || undefined, prompt: input, anthropicApiKey: apiKey || undefined });
        router.push(`/mock/${mock.id}`);
      } else {
        const input = openapi.trim();
        if (!input) {
          setError('Please paste an OpenAPI spec.');
          setLoading(false);
          return;
        }
        const mock = await createMock({ name: name || undefined, openapi: input, anthropicApiKey: apiKey || undefined });
        router.push(`/mock/${mock.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const isAI = mode === 'prompt' || (mode === 'json' && amplify) || mode === 'openapi';

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Mock API name (optional)"
        className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
      />

      <details className="text-sm">
        <summary className="text-gray-400 cursor-pointer hover:text-gray-200">
          Anthropic API Key {apiKey ? '(saved)' : '(required for AI features)'}
        </summary>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => saveApiKey(e.target.value)}
          placeholder="sk-ant-..."
          className="w-full mt-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">Your key is stored in your browser only. Never sent to our servers — used directly with Anthropic API.</p>
      </details>

      {/* Tab switcher */}
      <div className="flex border border-gray-700 rounded-lg overflow-hidden">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setMode(tab.key); setError(''); }}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
              mode === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === 'json' && (
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
      )}

      {mode === 'prompt' && (
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

      {mode === 'openapi' && (
        <>
          <textarea
            value={openapi}
            onChange={(e) => { setOpenapi(e.target.value); setError(''); }}
            placeholder={OPENAPI_PLACEHOLDER}
            rows={16}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg font-mono text-sm focus:outline-none focus:border-blue-500 resize-y"
          />
          <p className="text-xs text-gray-500">
            Paste an OpenAPI 3.x spec (JSON or YAML). AI will generate realistic data matching the schema.
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
          ? isAI ? 'AI is generating data...' : 'Generating...'
          : 'Generate API'}
      </button>
    </div>
  );
}
