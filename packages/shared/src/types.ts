export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';

export interface FieldDefinition {
  name: string;
  type: FieldType;
  nullable?: boolean;
}

export interface ResourceDefinition {
  name: string;
  count: number;
  fields: FieldDefinition[];
  endpoints: Record<string, string>;
}

export interface MockDefinition {
  id: string;
  name?: string;
  resources: ResourceDefinition[];
  baseUrl: string;
  graphqlUrl: string;
  createdAt: string;
}

export interface DelayConfig {
  type: 'uniform' | 'normal';
  min?: number;
  max?: number;
  mean?: number;
  sigma?: number;
}

export interface AuthConfig {
  type: 'apiKey' | 'bearer';
  key?: string;
}

export interface ResourceConfig {
  delay?: number | DelayConfig;
  errorRate?: number;
  errorStatus?: number;
  forceStatus?: number;
  webhookUrl?: string;
  webhookSecret?: string;
  envelope?: boolean;
  rateLimit?: number;
  auth?: AuthConfig;
}

export interface RequestLog {
  id: number;
  mockId: string;
  method: string;
  path: string;
  status: number;
  requestBody?: string;
  responseBody?: string;
  createdAt: string;
}

export interface CreateMockRequest {
  name?: string;
  sample?: Record<string, unknown>;
  prompt?: string;
  openapi?: string;
  amplify?: boolean;
  amplifyCount?: number;
  anthropicApiKey?: string;
}

export interface MockListItem {
  id: string;
  name?: string;
  resourceCount: number;
  createdAt: string;
  baseUrl: string;
}

export interface CreateMockResponse extends MockDefinition {}

export interface QueryOptions {
  filters?: Record<string, string>;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  q?: string;
  _expand?: string[];
  _embed?: string[];
}

export interface ApiError {
  error: string;
  message: string;
}
