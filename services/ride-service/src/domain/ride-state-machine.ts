import { RideStatus } from '../generated/prisma-client';

// Valid state transitions
const VALID_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  CREATED: [RideStatus.FINDING_DRIVER, RideStatus.CANCELLED],
  FINDING_DRIVER: [RideStatus.ASSIGNED, RideStatus.CANCELLED],
  ASSIGNED: [RideStatus.ACCEPTED, RideStatus.PICKING_UP, RideStatus.FINDING_DRIVER, RideStatus.CANCELLED],
  ACCEPTED: [RideStatus.PICKING_UP, RideStatus.FINDING_DRIVER, RideStatus.CANCELLED],
  PICKING_UP: [RideStatus.IN_PROGRESS, RideStatus.CANCELLED],
  IN_PROGRESS: [RideStatus.COMPLETED, RideStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export class RideStateMachine {
  private static readonly CANCELLABLE_STATUSES: RideStatus[] = [
    RideStatus.CREATED,
    RideStatus.FINDING_DRIVER,
    RideStatus.ASSIGNED,
    RideStatus.ACCEPTED,
    RideStatus.PICKING_UP,
  ];

  private static readonly DRIVER_REQUIRED_STATUSES: RideStatus[] = [
    RideStatus.ACCEPTED,
    RideStatus.IN_PROGRESS,
    RideStatus.COMPLETED,
  ];

  static canTransition(from: RideStatus, to: RideStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  static validateTransition(from: RideStatus, to: RideStatus): void {
    if (!this.canTransition(from, to)) {
      throw new Error(`Invalid state transition: ${from} -> ${to}`);
    }
  }

  static isTerminalState(status: RideStatus): boolean {
    return status === RideStatus.COMPLETED || status === RideStatus.CANCELLED;
  }

  static canCancel(status: RideStatus): boolean {
    return this.CANCELLABLE_STATUSES.includes(status);
  }

  static requiresDriver(status: RideStatus): boolean {
    return this.DRIVER_REQUIRED_STATUSES.includes(status);
  }
}
