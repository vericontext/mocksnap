'use client';

import { useEffect, useState } from 'react';
import { fetchLogs } from '@/lib/api-client';
import type { RequestLog } from '@mocksnap/shared';

interface Props {
  mockId: string;
}

const STATUS_COLORS: Record<string, string> = {
  '2': 'text-green-400',
  '3': 'text-yellow-400',
  '4': 'text-red-400',
  '5': 'text-red-500',
};

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-purple-400',
  DELETE: 'text-red-400',
};

export default function RequestLogs({ mockId }: Props) {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = () => fetchLogs(mockId).then(setLogs);

  useEffect(() => { load(); }, [mockId]);

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-medium">Request Logs</h3>
        <button
          onClick={load}
          className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="p-4 text-sm text-gray-500">No requests logged yet. Make some API calls to see them here.</div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-800 max-h-96 overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id}>
              <div
                className="px-4 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800/50 cursor-pointer text-sm"
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}
              >
                <span className={`font-mono text-xs font-bold w-16 ${METHOD_COLORS[log.method] || 'text-gray-400'}`}>
                  {log.method}
                </span>
                <span className={`font-mono text-xs font-bold w-10 ${STATUS_COLORS[String(log.status)[0]] || 'text-gray-400'}`}>
                  {log.status}
                </span>
                <span className="font-mono text-xs text-gray-300 flex-1 truncate">{log.path}</span>
                <span className="text-xs text-gray-500">{new Date(log.createdAt + 'Z').toLocaleTimeString()}</span>
              </div>
              {expanded === log.id && (
                <div className="px-4 pb-3 space-y-2">
                  {log.requestBody && (
                    <div>
                      <span className="text-xs text-gray-500">Request Body:</span>
                      <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs font-mono overflow-x-auto max-h-32 overflow-y-auto">
                        {(() => { try { return JSON.stringify(JSON.parse(log.requestBody), null, 2); } catch { return log.requestBody; } })()}
                      </pre>
                    </div>
                  )}
                  {log.responseBody && (
                    <div>
                      <span className="text-xs text-gray-500">Response Body:</span>
                      <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs font-mono overflow-x-auto max-h-32 overflow-y-auto">
                        {(() => { try { return JSON.stringify(JSON.parse(log.responseBody), null, 2); } catch { return log.responseBody; } })()}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
