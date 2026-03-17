import { createHealthServiceRegistration } from '../../../../shared/dist';
import { config } from '../config';
import { DriverService } from '../services/driver.service';

function mapDriver(driver: any) {
  return {
    id: driver?.id || '',
    userId: driver?.userId || '',
    vehicleType: driver?.vehicleType || '',
    status: driver?.status || '',
    availabilityStatus: driver?.availabilityStatus || '',
    lastLocationLat: driver?.lastLocationLat ?? 0,
    lastLocationLng: driver?.lastLocationLng ?? 0,
  };
}

export function createDriverGrpcRegistrations(
  driverService: DriverService,
  getReadiness: () => Promise<Record<string, boolean>>,
) {
  return [
    createHealthServiceRegistration(config.serviceName, getReadiness),
    {
      protoFile: 'driver.proto',
      packageName: 'cab.booking.grpc.driver',
      serviceName: 'DriverService',
      implementation: {
        GetDriverById: async (
          call: { request: { driverId: string } },
          callback: (error: Error | null, response?: unknown) => void,
        ) => {
          try {
            const driver = await driverService.getDriverById(call.request.driverId);
            callback(null, { driver: mapDriver(driver) });
          } catch (error) {
            callback(error as Error);
          }
        },
        GetDriverByUserId: async (
          call: { request: { userId: string } },
          callback: (error: Error | null, response?: unknown) => void,
        ) => {
          try {
            const driver = await driverService.getDriverByUserId(call.request.userId);
            callback(null, { driver: mapDriver(driver) });
          } catch (error) {
            callback(error as Error);
          }
        },
      },
    },
  ];
}