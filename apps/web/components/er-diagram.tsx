'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchDiagram } from '@/lib/api-client';

interface Props {
  mockId: string;
}

export default function ERDiagram({ mockId }: Props) {
  const [mermaidText, setMermaidText] = useState('');
  const [open, setOpen] = useState(true);
  const [svg, setSvg] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDiagram(mockId).then(setMermaidText);
  }, [mockId]);

  useEffect(() => {
    if (!mermaidText || !open) return;

    import('mermaid').then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({ startOnLoad: false, theme: 'dark' });
      mermaid.render('er-diagram', mermaidText).then(({ svg: rendered }) => {
        setSvg(rendered);
      });
    });
  }, [mermaidText, open]);

  if (!mermaidText) return null;

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
      <div
        className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <h3 className="font-medium">ER Diagram</h3>
        <span className="text-xs text-gray-400">{open ? 'Hide' : 'Show'}</span>
      </div>
      {open && (
        <div className="p-4">
          {svg ? (
            <div
              ref={containerRef}
              className="flex justify-center overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <p className="text-sm text-gray-500">Loading diagram...</p>
          )}
          <details className="mt-3">
            <summary className="text-xs text-gray-500 cursor-pointer">Mermaid source</summary>
            <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs font-mono overflow-x-auto">{mermaidText}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
