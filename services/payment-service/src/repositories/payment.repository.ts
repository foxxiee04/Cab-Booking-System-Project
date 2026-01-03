import { PrismaClient, Payment, PaymentStatus, PaymentMethod, Prisma } from '@prisma/client';

export interface IPaymentRepository {
  findById(id: string): Promise<Payment | null>;
  findByRideId(rideId: string): Promise<Payment | null>;
  findByCustomerId(customerId: string, page: number, limit: number): Promise<{ payments: Payment[]; total: number }>;
  findByDriverId(driverId: string, page: number, limit: number): Promise<{ payments: Payment[]; total: number }>;
  create(data: Prisma.PaymentCreateInput): Promise<Payment>;
  update(id: string, data: Prisma.PaymentUpdateInput): Promise<Payment>;
}

export class PaymentRepository implements IPaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Payment | null> {
    return this.prisma.payment.findUnique({
      where: { id },
    });
  }

  async findByRideId(rideId: string): Promise<Payment | null> {
    return this.prisma.payment.findUnique({
      where: { rideId },
    });
  }

  async findByCustomerId(
    customerId: string,
    page: number,
    limit: number
  ): Promise<{ payments: Payment[]; total: number }> {
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where: { customerId } }),
    ]);

    return { payments, total };
  }

  async findByDriverId(
    driverId: string,
    page: number,
    limit: number
  ): Promise<{ payments: Payment[]; total: number }> {
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { driverId, status: PaymentStatus.COMPLETED },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({
        where: { driverId, status: PaymentStatus.COMPLETED },
      }),
    ]);

    return { payments, total };
  }

  async create(data: Prisma.PaymentCreateInput): Promise<Payment> {
    return this.prisma.payment.create({ data });
  }

  async update(id: string, data: Prisma.PaymentUpdateInput): Promise<Payment> {
    return this.prisma.payment.update({
      where: { id },
      data,
    });
  }

  async sumEarningsByDriverId(
    driverId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    byMethod: { cash: number; card: number; wallet: number };
  }> {
    const result = await this.prisma.payment.aggregate({
      where: {
        driverId,
        status: PaymentStatus.COMPLETED,
        completedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: { amount: true },
    });

    const byMethod = await this.prisma.payment.groupBy({
      by: ['method'],
      where: {
        driverId,
        status: PaymentStatus.COMPLETED,
        completedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: { amount: true },
    });

    const methodTotals = { cash: 0, card: 0, wallet: 0 };
    byMethod.forEach((item) => {
      const method = item.method.toLowerCase() as 'cash' | 'card' | 'wallet';
      methodTotals[method] = item._sum.amount || 0;
    });

    return {
      total: result._sum.amount || 0,
      byMethod: methodTotals,
    };
  }

  async getStats(startDate: Date, endDate: Date): Promise<{
    totalPayments: number;
    totalAmount: number;
    completedCount: number;
    failedCount: number;
    refundedCount: number;
  }> {
    const [stats, completed, failed, refunded] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: PaymentStatus.COMPLETED,
        },
        _count: true,
        _sum: { amount: true },
      }),
      this.prisma.payment.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: PaymentStatus.COMPLETED,
        },
      }),
      this.prisma.payment.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: PaymentStatus.FAILED,
        },
      }),
      this.prisma.payment.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: PaymentStatus.REFUNDED,
        },
      }),
    ]);

    return {
      totalPayments: stats._count,
      totalAmount: stats._sum.amount || 0,
      completedCount: completed,
      failedCount: failed,
      refundedCount: refunded,
    };
  }
}
