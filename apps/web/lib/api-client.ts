import type { CreateMockRequest, CreateMockResponse, MockListItem, ModifyMockResponse, RequestLog, ResourceConfig } from '@mocksnap/shared';

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

export async function modifyMock(mockId: string, message: string, apiKey?: string): Promise<ModifyMockResponse> {
  const res = await fetch(`${API_URL}/api/mocks/${mockId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, anthropicApiKey: apiKey || undefined }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to modify mock');
  }
  return res.json();
}

export async function fetchDiagram(mockId: string): Promise<string> {
  const res = await fetch(`${API_URL}/m/${mockId}/diagram`);
  return res.text();
}

export async function listMocks(): Promise<MockListItem[]> {
  const res = await fetch(`${API_URL}/api/mocks`);
  return res.json();
}

export async function deleteMockApi(mockId: string): Promise<void> {
  await fetch(`${API_URL}/api/mocks/${mockId}`, { method: 'DELETE' });
}

export async function getResourceConfig(mockId: string, resource: string): Promise<ResourceConfig> {
  const res = await fetch(`${API_URL}/api/mocks/${mockId}/resources/${resource}/config`);
  return res.json();
}

export async function updateResourceConfig(mockId: string, resource: string, config: Partial<ResourceConfig>): Promise<ResourceConfig> {
  const res = await fetch(`${API_URL}/api/mocks/${mockId}/resources/${resource}/config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function fetchLogs(mockId: string): Promise<RequestLog[]> {
  const res = await fetch(`${API_URL}/api/mocks/${mockId}/logs`);
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
