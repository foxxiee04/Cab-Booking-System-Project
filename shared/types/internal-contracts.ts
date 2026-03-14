import type { ApiResponse } from './index';

export interface InternalDriverRecord {
  id: string;
  userId: string;
  [key: string]: unknown;
}

export type InternalDriverByUserResponse = ApiResponse<{
  driver: InternalDriverRecord;
}>;