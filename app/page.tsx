// app/page.tsx

import Whiteboard from '@/components/Whiteboard';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12 bg-gray-50">
      <h1 className="text-4xl font-bold mb-8 text-black">Real-time Collaborative Whiteboard</h1>
      <p className="mb-6 text-gray-600">
      Open this page in another tab to see it work!
      </p>
      <Whiteboard />
    </main>
  );
}