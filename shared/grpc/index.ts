import path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const loaderOptions: protoLoader.Options = {
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

export interface GrpcServiceRegistration {
  protoFile: string;
  packageName: string;
  serviceName: string;
  implementation: grpc.UntypedServiceImplementation;
}

export interface StartGrpcServerOptions {
  address: string;
  registrations: GrpcServiceRegistration[];
}

function getProtoPath(protoFile: string): string {
  return path.resolve(__dirname, 'proto', protoFile);
}

function getNestedProperty(target: Record<string, any>, keyPath: string): any {
  return keyPath.split('.').reduce<any>((current, key) => current?.[key], target);
}

const hopByHopProxyHeaders = new Set([
  'connection',
  'content-length',
  'host',
  'transfer-encoding',
]);

function sanitizeProxyHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};

  Object.entries(headers).forEach(([key, value]) => {
    const normalizedKey = key.toLowerCase();

    if (!value || hopByHopProxyHeaders.has(normalizedKey)) {
      return;
    }

    sanitized[normalizedKey] = value;
  });

  return sanitized;
}

export function loadGrpcPackage(protoFile: string): Record<string, any> {
  const packageDefinition = protoLoader.loadSync(getProtoPath(protoFile), loaderOptions);
  return grpc.loadPackageDefinition(packageDefinition) as unknown as Record<string, any>;
}

export function getGrpcServiceDefinition(
  protoFile: string,
  packageName: string,
  serviceName: string,
): any {
  const loadedPackage = loadGrpcPackage(protoFile);
  const packageNamespace = getNestedProperty(loadedPackage, packageName);

  if (!packageNamespace?.[serviceName]) {
    throw new Error(`Unable to load gRPC service ${packageName}.${serviceName} from ${protoFile}`);
  }

  return packageNamespace[serviceName];
}

export async function startGrpcServer({
  address,
  registrations,
}: StartGrpcServerOptions): Promise<grpc.Server> {
  const server = new grpc.Server();

  for (const registration of registrations) {
    const definition = getGrpcServiceDefinition(
      registration.protoFile,
      registration.packageName,
      registration.serviceName,
    );

    server.addService(definition.service, registration.implementation);
  }

  await new Promise<void>((resolve, reject) => {
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (error) => {
      if (error) {
        reject(error);
        return;
      }

      server.start();
      resolve();
    });
  });

  return server;
}

export async function shutdownGrpcServer(server?: grpc.Server | null): Promise<void> {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve) => {
    server.tryShutdown(() => resolve());
  });
}

export function createGrpcClient<T = any>(
  protoFile: string,
  packageName: string,
  serviceName: string,
  address: string,
): T {
  const ServiceDefinition = getGrpcServiceDefinition(protoFile, packageName, serviceName);
  return new ServiceDefinition(address, grpc.credentials.createInsecure()) as T;
}

export async function invokeUnary<RequestType, ResponseType>(
  client: Record<string, any>,
  methodName: string,
  payload: RequestType,
  deadlineMs = 1500,
): Promise<ResponseType> {
  const deadline = new Date(Date.now() + deadlineMs);

  return new Promise<ResponseType>((resolve, reject) => {
    client[methodName](payload, { deadline }, (error: grpc.ServiceError | null, response: ResponseType) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(response);
    });
  });
}

export function createHealthServiceRegistration(
  serviceName: string,
  getReadiness: () => Promise<Record<string, boolean>>,
): GrpcServiceRegistration {
  return {
    protoFile: 'common.proto',
    packageName: 'cab.booking.grpc.common',
    serviceName: 'HealthService',
    implementation: {
      Check: async (_call: unknown, callback: (error: Error | null, response?: unknown) => void) => {
        try {
          const dependencies = await getReadiness();
          callback(null, {
            service: serviceName,
            status: 'healthy',
            dependencies,
          });
        } catch (error) {
          callback(error as Error);
        }
      },
      Ready: async (_call: unknown, callback: (error: Error | null, response?: unknown) => void) => {
        try {
          const dependencies = await getReadiness();
          const ready = Object.values(dependencies).every(Boolean);
          callback(null, {
            service: serviceName,
            status: ready ? 'ready' : 'not_ready',
            dependencies,
          });
        } catch (error) {
          callback(error as Error);
        }
      },
    },
  };
}

export function createHttpBridgeServiceRegistration(httpBaseUrl: string): GrpcServiceRegistration {
  return {
    protoFile: 'httpbridge.proto',
    packageName: 'cab.booking.grpc.bridge',
    serviceName: 'HttpBridgeService',
    implementation: {
      Forward: async (
        call: {
          request: {
            method: string;
            path: string;
            queryJson?: string;
            bodyJson?: string;
            headers?: Record<string, string>;
          };
        },
        callback: (error: Error | null, response?: unknown) => void,
      ) => {
        try {
          const query = call.request.queryJson ? JSON.parse(call.request.queryJson) : {};
          const body = call.request.bodyJson ? JSON.parse(call.request.bodyJson) : undefined;
          const searchParams = new URLSearchParams();

          Object.entries(query || {}).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              value.forEach((entry) => searchParams.append(key, String(entry)));
              return;
            }

            if (value !== undefined && value !== null) {
              searchParams.append(key, String(value));
            }
          });

          const search = searchParams.toString();
          const url = `${httpBaseUrl}${call.request.path}${search ? `?${search}` : ''}`;
          const method = (call.request.method || 'GET').toUpperCase();
          const headers = sanitizeProxyHeaders(call.request.headers || {});
          const shouldSendJsonBody = ['POST', 'PUT', 'PATCH'].includes(method);
          const requestBody = shouldSendJsonBody
            ? JSON.stringify(body ?? {})
            : body !== undefined && method !== 'GET' && method !== 'HEAD'
              ? JSON.stringify(body)
              : undefined;

          if (shouldSendJsonBody && !headers['content-type']) {
            headers['content-type'] = 'application/json';
          }

          const response = await fetch(url, {
            method,
            headers,
            body: requestBody,
          });

          const responseText = await response.text();
          const responseHeaders: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });

          callback(null, {
            statusCode: response.status,
            headers: responseHeaders,
            bodyJson: responseText || '{}',
          });
        } catch (error) {
          callback(error as Error);
        }
      },
    },
  };
}

export function grpcAddressFromHttpUrl(url: string, grpcPort: number): string {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.hostname}:${grpcPort}`;
  } catch {
    return `localhost:${grpcPort}`;
  }
}