import { Request } from 'express';
import { createGrpcClient, invokeUnary } from '../../../../shared/dist';
import { config } from '../config';

type ServiceKey = keyof typeof config.grpcServices;

interface BridgeResponse<T = any> {
  statusCode: number;
  headers: Record<string, string>;
  bodyJson: string;
  body: T;
}

export interface ForwardableRequestLike {
  method: string;
  originalUrl: string;
  query?: Record<string, unknown>;
  body?: unknown;
  headers: Request['headers'];
}

function normalizeHeaders(headers: Request['headers']): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      normalized[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      normalized[key] = value.join(',');
    }
  }

  return normalized;
}

export class GrpcBridgeClient {
  private clients = new Map<ServiceKey, Record<string, any>>();

  private getClient(service: ServiceKey): Record<string, any> {
    const existing = this.clients.get(service);
    if (existing) {
      return existing;
    }

    const client = createGrpcClient<Record<string, any>>(
      'httpbridge.proto',
      'cab.booking.grpc.bridge',
      'HttpBridgeService',
      config.grpcServices[service],
    );
    this.clients.set(service, client);
    return client;
  }

  async forward<T = any>(service: ServiceKey, req: ForwardableRequestLike, pathOverride?: string): Promise<BridgeResponse<T>> {
    const client = this.getClient(service);
    const path = pathOverride || req.originalUrl.split('?')[0];

    const response = await invokeUnary<any, any>(client, 'Forward', {
      method: req.method,
      path,
      queryJson: JSON.stringify(req.query || {}),
      bodyJson: req.body !== undefined ? JSON.stringify(req.body) : '',
      headers: normalizeHeaders(req.headers),
    }, 5000);

    let parsedBody: T;
    try {
      parsedBody = (response.bodyJson ? JSON.parse(response.bodyJson) : {}) as T;
    } catch {
      parsedBody = response.bodyJson as T;
    }

    return {
      statusCode: response.statusCode,
      headers: response.headers || {},
      bodyJson: response.bodyJson,
      body: parsedBody,
    };
  }
}

export const grpcBridgeClient = new GrpcBridgeClient();