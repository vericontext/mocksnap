import JsonInput from '@/components/json-input';

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-16">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-3">MockSnap</h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg">Paste JSON, get a live REST API instantly</p>
        <a href="/mocks" className="text-sm text-blue-500 dark:text-blue-400 hover:underline mt-2 inline-block">
          View my mock APIs
        </a>
      </div>
      <JsonInput />
    </main>
  );
}
