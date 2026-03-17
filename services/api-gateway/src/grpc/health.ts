import { createGrpcClient, invokeUnary } from '../../../../shared/dist';
import { config } from '../config';

export function createServiceHealthChecker() {
  const clients = Object.fromEntries(
    Object.entries(config.grpcServices).map(([name, address]) => [
      name,
      createGrpcClient<Record<string, any>>(
        'common.proto',
        'cab.booking.grpc.common',
        'HealthService',
        address,
      ),
    ]),
  );

  return async () => {
    const results: Record<string, string> = {};

    for (const [name, client] of Object.entries(clients)) {
      try {
        const response = await invokeUnary<Record<string, never>, any>(client, 'Check', {}, 1000);
        results[name] = response?.status === 'healthy' ? 'healthy' : 'unhealthy';
      } catch {
        results[name] = 'unreachable';
      }
    }

    return results;
  };
}