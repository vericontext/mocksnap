'use client';

import { useState, useEffect } from 'react';
import { getResourceConfig, updateResourceConfig } from '@/lib/api-client';
import type { ResourceConfig } from '@mocksnap/shared';

interface Props {
  mockId: string;
  resource: string;
}

export default function ResourceConfigPanel({ mockId, resource }: Props) {
  const [config, setConfig] = useState<ResourceConfig>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getResourceConfig(mockId, resource).then(setConfig);
  }, [mockId, resource]);

  const save = async (updates: Partial<ResourceConfig>) => {
    setSaving(true);
    const updated = await updateResourceConfig(mockId, resource, updates);
    setConfig(updated);
    setSaving(false);
  };

  return (
    <div className="p-3 bg-gray-900 rounded-lg space-y-3 text-sm">
      <div className="flex items-center gap-3">
        <label className="text-gray-400 w-24">Delay (ms)</label>
        <input
          type="number"
          min={0}
          max={30000}
          step={100}
          value={config.delay || 0}
          onChange={(e) => setConfig({ ...config, delay: Number(e.target.value) })}
          className="w-24 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
        />
        <input
          type="range"
          min={0}
          max={5000}
          step={100}
          value={config.delay || 0}
          onChange={(e) => setConfig({ ...config, delay: Number(e.target.value) })}
          className="flex-1"
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-gray-400 w-24">Error rate</label>
        <span className="w-24 text-gray-300">{Math.round((config.errorRate || 0) * 100)}%</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={config.errorRate || 0}
          onChange={(e) => setConfig({ ...config, errorRate: Number(e.target.value) })}
          className="flex-1"
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-gray-400 w-24">Error status</label>
        <select
          value={config.errorStatus || 500}
          onChange={(e) => setConfig({ ...config, errorStatus: Number(e.target.value) })}
          className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm cursor-pointer"
        >
          <option value={400}>400 Bad Request</option>
          <option value={401}>401 Unauthorized</option>
          <option value={403}>403 Forbidden</option>
          <option value={404}>404 Not Found</option>
          <option value={429}>429 Too Many Requests</option>
          <option value={500}>500 Internal Server Error</option>
          <option value={502}>502 Bad Gateway</option>
          <option value={503}>503 Service Unavailable</option>
        </select>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-gray-400 w-24">Force status</label>
        <input
          type="number"
          min={0}
          max={599}
          value={config.forceStatus || 0}
          onChange={(e) => setConfig({ ...config, forceStatus: Number(e.target.value) || undefined })}
          placeholder="0 = disabled"
          className="w-24 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
        />
        <span className="text-xs text-gray-500">Set to 0 to disable</span>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-gray-400 w-24">Webhook URL</label>
        <input
          type="url"
          value={config.webhookUrl || ''}
          onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value || undefined })}
          placeholder="https://webhook.site/..."
          className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
        />
      </div>

      <button
        onClick={() => save(config)}
        disabled={saving}
        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded text-sm transition-colors cursor-pointer"
      >
        {saving ? 'Saving...' : 'Save Config'}
      </button>
    </div>
  );
}
