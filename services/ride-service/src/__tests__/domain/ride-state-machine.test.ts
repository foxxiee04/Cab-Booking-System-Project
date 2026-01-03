import { RideStateMachine } from '../../domain/ride-state-machine';

// Mock RideStatus enum (matches Prisma generated enum)
enum RideStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  ACCEPTED = 'ACCEPTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// Mock the Prisma client module
jest.mock('@prisma/client', () => ({
  RideStatus: {
    PENDING: 'PENDING',
    ASSIGNED: 'ASSIGNED',
    ACCEPTED: 'ACCEPTED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
  },
}));

describe('RideStateMachine', () => {
  describe('canTransition', () => {
    it('should allow PENDING to ASSIGNED transition', () => {
      expect(RideStateMachine.canTransition(RideStatus.PENDING, RideStatus.ASSIGNED)).toBe(true);
    });

    it('should allow PENDING to CANCELLED transition', () => {
      expect(RideStateMachine.canTransition(RideStatus.PENDING, RideStatus.CANCELLED)).toBe(true);
    });

    it('should allow ASSIGNED to ACCEPTED transition', () => {
      expect(RideStateMachine.canTransition(RideStatus.ASSIGNED, RideStatus.ACCEPTED)).toBe(true);
    });

    it('should allow ASSIGNED back to PENDING (driver rejected)', () => {
      expect(RideStateMachine.canTransition(RideStatus.ASSIGNED, RideStatus.PENDING)).toBe(true);
    });

    it('should allow ACCEPTED to IN_PROGRESS transition', () => {
      expect(RideStateMachine.canTransition(RideStatus.ACCEPTED, RideStatus.IN_PROGRESS)).toBe(true);
    });

    it('should allow IN_PROGRESS to COMPLETED transition', () => {
      expect(RideStateMachine.canTransition(RideStatus.IN_PROGRESS, RideStatus.COMPLETED)).toBe(true);
    });

    it('should NOT allow COMPLETED to any transition', () => {
      expect(RideStateMachine.canTransition(RideStatus.COMPLETED, RideStatus.PENDING)).toBe(false);
      expect(RideStateMachine.canTransition(RideStatus.COMPLETED, RideStatus.CANCELLED)).toBe(false);
    });

    it('should NOT allow CANCELLED to any transition', () => {
      expect(RideStateMachine.canTransition(RideStatus.CANCELLED, RideStatus.PENDING)).toBe(false);
      expect(RideStateMachine.canTransition(RideStatus.CANCELLED, RideStatus.COMPLETED)).toBe(false);
    });

    it('should NOT allow skipping states', () => {
      expect(RideStateMachine.canTransition(RideStatus.PENDING, RideStatus.COMPLETED)).toBe(false);
      expect(RideStateMachine.canTransition(RideStatus.PENDING, RideStatus.IN_PROGRESS)).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('should not throw for valid transitions', () => {
      expect(() => {
        RideStateMachine.validateTransition(RideStatus.PENDING, RideStatus.ASSIGNED);
      }).not.toThrow();
    });

    it('should throw for invalid transitions', () => {
      expect(() => {
        RideStateMachine.validateTransition(RideStatus.PENDING, RideStatus.COMPLETED);
      }).toThrow('Invalid state transition: PENDING -> COMPLETED');
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
      expect(RideStateMachine.isTerminalState(RideStatus.PENDING)).toBe(false);
      expect(RideStateMachine.isTerminalState(RideStatus.IN_PROGRESS)).toBe(false);
    });
  });

  describe('canCancel', () => {
    it('should allow cancellation from PENDING', () => {
      expect(RideStateMachine.canCancel(RideStatus.PENDING)).toBe(true);
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
      expect(RideStateMachine.requiresDriver(RideStatus.PENDING)).toBe(false);
    });
  });
});
