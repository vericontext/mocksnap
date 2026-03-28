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
  createdAt: string;
}

export interface CreateMockRequest {
  name?: string;
  sample?: Record<string, unknown>;
  prompt?: string;
  amplify?: boolean;
  amplifyCount?: number;
}

export interface CreateMockResponse extends MockDefinition {}

export interface ApiError {
  error: string;
  message: string;
}
