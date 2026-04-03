/**
 * Easing functions for smooth animations
 */

// Cubic easing - smooth acceleration and deceleration
export function easeInOutCubic(progress: number): number {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

// Quad easing - medium smooth
export function easeInOutQuad(progress: number): number {
  return progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
}

// Quart easing - very smooth
export function easeInOutQuart(progress: number): number {
  return progress < 0.5
    ? 8 * progress * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 4) / 8;
}

// Linear easing - constant speed
export function easeLinear(progress: number): number {
  return progress;
}

/**
 * Position interpolation with configurable easing
 */
export function interpolatePosition(
  from: google.maps.LatLngLiteral,
  to: google.maps.LatLngLiteral,
  progress: number,
  easing: (p: number) => number = easeInOutCubic,
): google.maps.LatLngLiteral {
  const easedProgress = easing(progress);
  return {
    lat: from.lat + (to.lat - from.lat) * easedProgress,
    lng: from.lng + (to.lng - from.lng) * easedProgress,
  };
}

/**
 * Calculate bearing between two points for vehicle rotation
 */
export function calculateHeading(
  from: google.maps.LatLngLiteral,
  to: google.maps.LatLngLiteral,
): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Interpolate heading with shortest rotation path
 */
export function interpolateHeading(from: number, to: number, progress: number): number {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return (from + delta * progress + 360) % 360;
}

/**
 * Estimate animation duration based on distance
 * Drivers typically travel 40-60 km/h in cities
 */
export function estimateAnimationDurationMs(
  from: google.maps.LatLngLiteral,
  to: google.maps.LatLngLiteral,
): number {
  const latDelta = to.lat - from.lat;
  const lngDelta = to.lng - from.lng;
  
  // Approximate meters using Mercator projection
  const approxMeters = Math.sqrt(latDelta * latDelta + lngDelta * lngDelta) * 111_320;

  // Assume 50 km/h average speed = 13.89 m/s
  // Duration in ms = distance / speed * 1000 = distance / 0.01389
  const baseDuration = (approxMeters / 13.89) * 1000;

  // Clamp between min and max durations
  return Math.min(5000, Math.max(300, baseDuration));
}

/**
 * Spring-like animation for bouncy effect
 */
export function easeSpring(progress: number, damping: number = 0.5): number {
  // Over-shooting spring animation
  const x = progress * Math.PI;
  return 1 - Math.cos(x) * Math.exp(-damping * progress * 3);
}

/**
 * Bounce in animation
 */
export function easeBounceIn(progress: number): number {
  return 1 - easeBounceOut(1 - progress);
}

/**
 * Bounce out animation
 */
export function easeBounceOut(progress: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (progress < 1 / d1) {
    return n1 * progress * progress;
  } else if (progress < 2 / d1) {
    return n1 * (progress -= 1.5 / d1) * progress + 0.75;
  } else if (progress < 2.5 / d1) {
    return n1 * (progress -= 2.25 / d1) * progress + 0.9375;
  } else {
    return n1 * (progress -= 2.625 / d1) * progress + 0.984375;
  }
}

/**
 * Animation frame scheduler with cancellation
 */
export class AnimationScheduler {
  private frameId: number | null = null;
  private startTime: number = 0;
  private completedCallback: (() => void) | null = null;

  start(
    duration: number,
    onFrame: (progress: number) => void,
    onComplete?: () => void
  ): void {
    if (this.frameId !== null) {
      this.cancel();
    }

    this.startTime = performance.now();
    this.completedCallback = onComplete || null;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - this.startTime;
      const progress = Math.min(1, elapsed / duration);

      onFrame(progress);

      if (progress < 1) {
        this.frameId = requestAnimationFrame(animate);
      } else {
        this.frameId = null;
        this.completedCallback?.();
      }
    };

    this.frameId = requestAnimationFrame(animate);
  }

  cancel(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  isRunning(): boolean {
    return this.frameId !== null;
  }
}