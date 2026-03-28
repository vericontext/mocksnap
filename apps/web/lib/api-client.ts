import type { CreateMockRequest, CreateMockResponse } from '@mocksnap/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function createMock(request: CreateMockRequest): Promise<CreateMockResponse> {
  const res = await fetch(`${API_URL}/api/mocks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to create mock');
  }
  return res.json();
}

export async function fetchMock(mockId: string): Promise<CreateMockResponse> {
  const res = await fetch(`${API_URL}/api/mocks/${mockId}`);
  if (!res.ok) {
    throw new Error('Mock not found');
  }
  return res.json();
}

export async function sendRequest(url: string, method: string, body?: string): Promise<{ status: number; data: unknown }> {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body && method !== 'GET' && method !== 'DELETE') {
    opts.body = body;
  }
  const res = await fetch(url, opts);
  const data = await res.json();
  return { status: res.status, data };
}
