import { RideStateMachine } from '../../domain/ride-state-machine';

// Mock RideStatus enum (matches Prisma generated enum)
enum RideStatus {
  CREATED = 'CREATED',
  FINDING_DRIVER = 'FINDING_DRIVER',
  ASSIGNED = 'ASSIGNED',
  ACCEPTED = 'ACCEPTED',
  PICKING_UP = 'PICKING_UP',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

// Mock the Prisma client module
jest.mock('@prisma/client', () => ({
  RideStatus: {
    CREATED: 'CREATED',
    FINDING_DRIVER: 'FINDING_DRIVER',
    ASSIGNED: 'ASSIGNED',
    ACCEPTED: 'ACCEPTED',
    PICKING_UP: 'PICKING_UP',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    REJECTED: 'REJECTED',
  },
}));

describe('RideStateMachine', () => {
  describe('canTransition', () => {
    it('should allow CREATED to FINDING_DRIVER transition', () => {
      expect(RideStateMachine.canTransition(RideStatus.CREATED, RideStatus.FINDING_DRIVER)).toBe(true);
    });

    it('should allow FINDING_DRIVER to CANCELLED transition', () => {
      expect(RideStateMachine.canTransition(RideStatus.FINDING_DRIVER, RideStatus.CANCELLED)).toBe(true);
    });

    it('should allow ASSIGNED to ACCEPTED transition', () => {
      expect(RideStateMachine.canTransition(RideStatus.ASSIGNED, RideStatus.ACCEPTED)).toBe(true);
    });

    it('should allow ASSIGNED back to FINDING_DRIVER (driver rejected)', () => {
      expect(RideStateMachine.canTransition(RideStatus.ASSIGNED, RideStatus.FINDING_DRIVER)).toBe(true);
    });

    it('should allow ACCEPTED to PICKING_UP transition', () => {
      expect(RideStateMachine.canTransition(RideStatus.ACCEPTED, RideStatus.PICKING_UP)).toBe(true);
    });

    it('should allow IN_PROGRESS to COMPLETED transition', () => {
      expect(RideStateMachine.canTransition(RideStatus.IN_PROGRESS, RideStatus.COMPLETED)).toBe(true);
    });

    it('should NOT allow COMPLETED to any transition', () => {
      expect(RideStateMachine.canTransition(RideStatus.COMPLETED, RideStatus.CREATED)).toBe(false);
      expect(RideStateMachine.canTransition(RideStatus.COMPLETED, RideStatus.CANCELLED)).toBe(false);
    });

    it('should NOT allow CANCELLED to any transition', () => {
      expect(RideStateMachine.canTransition(RideStatus.CANCELLED, RideStatus.CREATED)).toBe(false);
      expect(RideStateMachine.canTransition(RideStatus.CANCELLED, RideStatus.COMPLETED)).toBe(false);
    });

    it('should NOT allow skipping states', () => {
      expect(RideStateMachine.canTransition(RideStatus.CREATED, RideStatus.COMPLETED)).toBe(false);
      expect(RideStateMachine.canTransition(RideStatus.CREATED, RideStatus.IN_PROGRESS)).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('should not throw for valid transitions', () => {
      expect(() => {
        RideStateMachine.validateTransition(RideStatus.CREATED, RideStatus.FINDING_DRIVER);
      }).not.toThrow();
    });

    it('should throw for invalid transitions', () => {
      expect(() => {
        RideStateMachine.validateTransition(RideStatus.CREATED, RideStatus.COMPLETED);
      }).toThrow('Invalid state transition: CREATED -> COMPLETED');
    });
  });

  describe('isTerminalState', () => {
    it('should return true for COMPLETED', () => {
      expect(RideStateMachine.isTerminalState(RideStatus.COMPLETED)).toBe(true);
    });

    it('should return true for CANCELLED', () => {
      expect(RideStateMachine.isTerminalState(RideStatus.CANCELLED)).toBe(true);
    });

    it('should return false for non-terminal states', () => {
      expect(RideStateMachine.isTerminalState(RideStatus.CREATED)).toBe(false);
      expect(RideStateMachine.isTerminalState(RideStatus.IN_PROGRESS)).toBe(false);
    });
  });

  describe('canCancel', () => {
    it('should allow cancellation from CREATED', () => {
      expect(RideStateMachine.canCancel(RideStatus.CREATED)).toBe(true);
    });

    it('should allow cancellation from ASSIGNED', () => {
      expect(RideStateMachine.canCancel(RideStatus.ASSIGNED)).toBe(true);
    });

    it('should allow cancellation from ACCEPTED', () => {
      expect(RideStateMachine.canCancel(RideStatus.ACCEPTED)).toBe(true);
    });

    it('should NOT allow cancellation from IN_PROGRESS', () => {
      expect(RideStateMachine.canCancel(RideStatus.IN_PROGRESS)).toBe(false);
    });

    it('should NOT allow cancellation from terminal states', () => {
      expect(RideStateMachine.canCancel(RideStatus.COMPLETED)).toBe(false);
      expect(RideStateMachine.canCancel(RideStatus.CANCELLED)).toBe(false);
    });
  });

  describe('requiresDriver', () => {
    it('should return true for states requiring driver', () => {
      expect(RideStateMachine.requiresDriver(RideStatus.ACCEPTED)).toBe(true);
      expect(RideStateMachine.requiresDriver(RideStatus.IN_PROGRESS)).toBe(true);
      expect(RideStateMachine.requiresDriver(RideStatus.COMPLETED)).toBe(true);
    });

    it('should return false for states not requiring driver', () => {
      expect(RideStateMachine.requiresDriver(RideStatus.CREATED)).toBe(false);
    });
  });
});
