import { Ride, RideStatus, Prisma } from '../generated/prisma-client';

type RideDelegateLike = {
  findUnique: (...args: any[]) => Promise<any>;
  findFirst: (...args: any[]) => Promise<any>;
  findMany: (...args: any[]) => Promise<any>;
  create: (...args: any[]) => Promise<any>;
  update: (...args: any[]) => Promise<any>;
  count: (...args: any[]) => Promise<any>;
  aggregate: (...args: any[]) => Promise<any>;
};

type PrismaClientLike = { ride: RideDelegateLike };

export interface IRideRepository {
  findById(id: string): Promise<Ride | null>;
  findByIdWithTransitions(id: string): Promise<Ride | null>;
  findActiveByCustomerId(customerId: string): Promise<Ride | null>;
  findActiveByDriverId(driverId: string): Promise<Ride | null>;
  findByCustomerId(customerId: string, page: number, limit: number): Promise<{ rides: Ride[]; total: number }>;
  findByDriverId(driverId: string, page: number, limit: number): Promise<{ rides: Ride[]; total: number }>;
  create(data: Prisma.RideCreateInput): Promise<Ride>;
  update(id: string, data: Prisma.RideUpdateInput): Promise<Ride>;
  updateStatus(id: string, status: RideStatus, actorId: string, actorType: string, reason?: string): Promise<Ride>;
}

export class RideRepository implements IRideRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async findById(id: string): Promise<Ride | null> {
    return this.prisma.ride.findUnique({
      where: { id },
    });
  }

  async findByIdWithTransitions(id: string): Promise<Ride | null> {
    return this.prisma.ride.findUnique({
      where: { id },
      include: {
        transitions: {
          orderBy: { occurredAt: 'desc' },
        },
      },
    });
  }

  async findActiveByCustomerId(customerId: string): Promise<Ride | null> {
    return this.prisma.ride.findFirst({
      where: {
        customerId,
        status: {
          in: [
            RideStatus.CREATED,
            RideStatus.FINDING_DRIVER,
            RideStatus.ASSIGNED,
            RideStatus.PICKING_UP,
            RideStatus.ACCEPTED,
            RideStatus.IN_PROGRESS,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActiveByDriverId(driverId: string): Promise<Ride | null> {
    return this.prisma.ride.findFirst({
      where: {
        driverId,
        status: {
          in: [RideStatus.ASSIGNED, RideStatus.PICKING_UP, RideStatus.IN_PROGRESS],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByCustomerId(customerId: string, page: number, limit: number): Promise<{ rides: Ride[]; total: number }> {
    const skip = (page - 1) * limit;

    const [rides, total] = await Promise.all([
      this.prisma.ride.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ride.count({ where: { customerId } }),
    ]);

    return { rides, total };
  }

  async findByDriverId(driverId: string, page: number, limit: number): Promise<{ rides: Ride[]; total: number }> {
    const skip = (page - 1) * limit;

    const [rides, total] = await Promise.all([
      this.prisma.ride.findMany({
        where: { driverId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ride.count({ where: { driverId } }),
    ]);

    return { rides, total };
  }

  async create(data: Prisma.RideCreateInput): Promise<Ride> {
    return this.prisma.ride.create({ data });
  }

  async update(id: string, data: Prisma.RideUpdateInput): Promise<Ride> {
    return this.prisma.ride.update({
      where: { id },
      data,
    });
  }

  async updateStatus(
    id: string,
    status: RideStatus,
    actorId: string,
    actorType: string,
    reason?: string
  ): Promise<Ride> {
    const ride = await this.findById(id);
    if (!ride) {
      throw new Error('Ride not found');
    }

    return this.prisma.ride.update({
      where: { id },
      data: {
        status,
        transitions: {
          create: {
            fromStatus: ride.status,
            toStatus: status,
            actorId,
            actorType,
            reason,
          },
        },
      },
    });
  }

  async findPendingRidesOlderThan(minutes: number): Promise<Ride[]> {
    const threshold = new Date(Date.now() - minutes * 60 * 1000);
    
    return this.prisma.ride.findMany({
      where: {
        status: RideStatus.FINDING_DRIVER,
        createdAt: { lt: threshold },
      },
    });
  }

  async countByStatus(status: RideStatus): Promise<number> {
    return this.prisma.ride.count({ where: { status } });
  }

  async getStatsByDateRange(startDate: Date, endDate: Date): Promise<{
    total: number;
    completed: number;
    cancelled: number;
    totalFare: number;
  }> {
    const [total, completed, cancelled, fareResult] = await Promise.all([
      this.prisma.ride.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      this.prisma.ride.count({
        where: { status: RideStatus.COMPLETED, createdAt: { gte: startDate, lte: endDate } },
      }),
      this.prisma.ride.count({
        where: { status: RideStatus.CANCELLED, createdAt: { gte: startDate, lte: endDate } },
      }),
      this.prisma.ride.aggregate({
        where: { status: RideStatus.COMPLETED, createdAt: { gte: startDate, lte: endDate } },
        _sum: { fare: true },
      }),
    ]);

    return {
      total,
      completed,
      cancelled,
      totalFare: fareResult._sum.fare || 0,
    };
  }
}
