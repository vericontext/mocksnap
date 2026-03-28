import JsonInput from '@/components/json-input';

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-16">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-3">MockSnap</h1>
        <p className="text-gray-400 text-lg">Paste JSON, get a live REST API instantly</p>
      </div>
      <JsonInput />
    </main>
  );
}
