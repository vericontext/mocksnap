import JsonInput from '@/components/json-input';

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-16">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold tracking-tight mb-4">MockSnap</h1>
        <p className="text-gray-500 dark:text-gray-400 text-xl max-w-xl mx-auto">
          Describe your API in words, paste JSON, or drop an OpenAPI spec — get a live REST + GraphQL API with docs in seconds.
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <a
            href="/mocks"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>
            My Mock APIs
          </a>
          <a
            href="https://github.com/vericontext/mocksnap"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
            Star on GitHub
          </a>
        </div>
      </div>
      <JsonInput />

      <footer className="mt-16 text-center text-sm text-gray-400 dark:text-gray-500 space-y-1">
        <p className="text-xs">Instant mock APIs for developers</p>
        <p>
          Open source &middot;{' '}
          <a href="https://github.com/vericontext/mocksnap" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            GitHub
          </a>
          {' '}&middot;{' '}
          <a href="https://x.com/vericontext" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            @vericontext
          </a>
        </p>
      </footer>
    </main>
  );
}
