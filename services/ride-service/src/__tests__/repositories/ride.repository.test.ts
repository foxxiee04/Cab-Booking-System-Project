import { RideRepository } from '../../repositories/ride.repository';

// Mock RideStatus enum
const RideStatus = {
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

// Mock PrismaClient type
type PrismaClient = {
  ride: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
    aggregate: jest.Mock;
  };
};

// Mock the Prisma client module
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
  RideStatus: {
    PENDING: 'PENDING',
    ASSIGNED: 'ASSIGNED',
    ACCEPTED: 'ACCEPTED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
  },
}));

// Mock PrismaClient
const mockPrisma = {
  ride: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
} as unknown as PrismaClient;

describe('RideRepository', () => {
  let repository: RideRepository;

  beforeEach(() => {
    repository = new RideRepository(mockPrisma);
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return ride when found', async () => {
      const mockRide = {
        id: 'ride-123',
        customerId: 'customer-1',
        status: RideStatus.PENDING,
      };
      (mockPrisma.ride.findUnique as jest.Mock).mockResolvedValue(mockRide);

      const result = await repository.findById('ride-123');

      expect(mockPrisma.ride.findUnique).toHaveBeenCalledWith({
        where: { id: 'ride-123' },
      });
      expect(result).toEqual(mockRide);
    });

    it('should return null when ride not found', async () => {
      (mockPrisma.ride.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findActiveByCustomerId', () => {
    it('should find active ride for customer', async () => {
      const mockRide = {
        id: 'ride-123',
        customerId: 'customer-1',
        status: RideStatus.IN_PROGRESS,
      };
      (mockPrisma.ride.findFirst as jest.Mock).mockResolvedValue(mockRide);

      const result = await repository.findActiveByCustomerId('customer-1');

      expect(mockPrisma.ride.findFirst).toHaveBeenCalledWith({
        where: {
          customerId: 'customer-1',
          status: {
            in: [RideStatus.PENDING, RideStatus.ASSIGNED, RideStatus.ACCEPTED, RideStatus.IN_PROGRESS],
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockRide);
    });
  });

  describe('findByCustomerId with pagination', () => {
    it('should return paginated rides', async () => {
      const mockRides = [
        { id: 'ride-1', status: RideStatus.COMPLETED },
        { id: 'ride-2', status: RideStatus.COMPLETED },
      ];
      (mockPrisma.ride.findMany as jest.Mock).mockResolvedValue(mockRides);
      (mockPrisma.ride.count as jest.Mock).mockResolvedValue(25);

      const result = await repository.findByCustomerId('customer-1', 1, 10);

      expect(mockPrisma.ride.findMany).toHaveBeenCalledWith({
        where: { customerId: 'customer-1' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result.rides).toEqual(mockRides);
      expect(result.total).toBe(25);
    });

    it('should calculate correct skip for page 2', async () => {
      (mockPrisma.ride.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.ride.count as jest.Mock).mockResolvedValue(0);

      await repository.findByCustomerId('customer-1', 2, 10);

      expect(mockPrisma.ride.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });
  });

  describe('create', () => {
    it('should create a new ride', async () => {
      const createData = {
        id: 'ride-new',
        customerId: 'customer-1',
        status: RideStatus.PENDING,
        pickupAddress: 'Address A',
        pickupLat: 10.0,
        pickupLng: 106.0,
        dropoffAddress: 'Address B',
        dropoffLat: 10.1,
        dropoffLng: 106.1,
      };
      (mockPrisma.ride.create as jest.Mock).mockResolvedValue(createData);

      const result = await repository.create(createData as any);

      expect(mockPrisma.ride.create).toHaveBeenCalledWith({ data: createData });
      expect(result).toEqual(createData);
    });
  });

  describe('countByStatus', () => {
    it('should count rides by status', async () => {
      (mockPrisma.ride.count as jest.Mock).mockResolvedValue(15);

      const result = await repository.countByStatus(RideStatus.PENDING);

      expect(mockPrisma.ride.count).toHaveBeenCalledWith({
        where: { status: RideStatus.PENDING },
      });
      expect(result).toBe(15);
    });
  });
});
