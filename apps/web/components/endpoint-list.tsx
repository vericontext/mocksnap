'use client';

import { useState } from 'react';
import type { ResourceDefinition } from '@mocksnap/shared';

interface Props {
  resources: ResourceDefinition[];
  baseUrl: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-purple-400',
  DELETE: 'text-red-400',
};

export default function EndpointList({ resources, baseUrl }: Props) {
  const [copied, setCopied] = useState('');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Base URL</h2>
        <code className="px-3 py-1 bg-gray-800 rounded text-sm font-mono">{baseUrl}</code>
        <button
          onClick={() => copyToClipboard(baseUrl)}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors cursor-pointer"
        >
          {copied === baseUrl ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {resources.map((resource) => (
        <div key={resource.name} className="border border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
            <h3 className="font-medium">/{resource.name}</h3>
            <p className="text-xs text-gray-400 mt-1">
              Fields: {resource.fields.map((f) => `${f.name} (${f.type})`).join(', ')}
            </p>
          </div>
          <div className="divide-y divide-gray-800">
            {Object.entries(resource.endpoints).map(([key, endpoint]) => {
              const [method, ...pathParts] = endpoint.trim().split(/\s+/);
              const path = pathParts.join(' ');
              const fullUrl = `${baseUrl}${path.replace(/^\/m\/[^/]+/, '')}`;

              return (
                <div
                  key={key}
                  className="px-4 py-2 flex items-center gap-3 hover:bg-gray-800/50 cursor-pointer"
                  onClick={() => copyToClipboard(fullUrl)}
                >
                  <span className={`font-mono text-xs font-bold w-16 ${METHOD_COLORS[method] || 'text-gray-400'}`}>
                    {method}
                  </span>
                  <span className="font-mono text-sm text-gray-300 flex-1">{path}</span>
                  <span className="text-xs text-gray-500">
                    {copied === fullUrl ? 'Copied!' : 'Click to copy'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
