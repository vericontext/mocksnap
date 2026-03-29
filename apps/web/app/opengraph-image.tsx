import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'MockSnap — AI-powered Mock API Generator';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: '#ffffff',
            marginBottom: 16,
          }}
        >
          MockSnap
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#94a3b8',
            textAlign: 'center',
            maxWidth: 800,
            lineHeight: 1.4,
            marginBottom: 40,
          }}
        >
          Describe your API in words — get live REST + GraphQL with docs in seconds
        </div>
        <div
          style={{
            display: 'flex',
            gap: 16,
          }}
        >
          {['REST', 'GraphQL', 'Swagger Docs', 'ER Diagram', 'AI Data'].map((tag) => (
            <div
              key={tag}
              style={{
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: 8,
                padding: '8px 20px',
                color: '#60a5fa',
                fontSize: 20,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            color: '#64748b',
            fontSize: 18,
          }}
        >
          mocksnap.dev — Open Source
        </div>
      </div>
    ),
    { ...size }
  );
}
