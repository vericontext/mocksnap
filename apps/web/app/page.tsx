import JsonInput from '@/components/json-input';

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-16">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold tracking-tight mb-4">MockSnap</h1>
        <p className="text-gray-500 dark:text-gray-400 text-xl max-w-xl mx-auto">
          Describe your API in words, paste JSON, or drop an OpenAPI spec — get a live REST + GraphQL API with docs in seconds.
        </p>
        <div className="flex items-center justify-center gap-4 mt-4">
          <a href="/mocks" className="text-sm text-blue-500 dark:text-blue-400 hover:underline">
            My mock APIs
          </a>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <a href="https://github.com/vericontext/mocksnap" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
            GitHub
          </a>
        </div>
      </div>
      <JsonInput />
    </main>
  );
}
