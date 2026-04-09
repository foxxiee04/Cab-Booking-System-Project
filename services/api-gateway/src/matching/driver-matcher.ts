/**
 * DriverMatcher — Production-quality driver–passenger matching algorithm
 *
 * ## Algorithm Overview
 * ─────────────────────────────────────────────────────────────────────
 * Scoring formula (all components normalised to [0, 1]):
 *
 *   score = − w_distance  * norm(distance)
 *           + w_rating    * norm(rating)
 *           + w_idle      * norm(idle_time)
 *           + w_accept    * acceptance_rate
 *           − w_cancel    * cancel_rate
 *
 * Default weights: distance=0.40, rating=0.25, idle=0.15, accept=0.15, cancel=0.05
 *
 * ## Distance
 * Calculated via the Haversine formula. Drivers outside `maxRadiusKm` are
 * filtered out before scoring.
 *
 * ## ETA
 * Estimated Time of Arrival = distance / avg_urban_speed (25 km/h).
 * In production replace with OSRM / Google Maps Duration API.
 *
 * ## Dispatch Modes
 * - sequential : offer to the top-ranked driver first; move to the next
 *                if no acceptance within `offerTimeoutSeconds`.
 * - broadcast  : push the offer to the top-N drivers simultaneously.
 *
 * ## Redis Geo-indexing for Scale
 * ─────────────────────────────────────────────────────────────────────
 * Drivers are stored in a Redis Sorted Set via `GEOADD drivers:geo:online`.
 * A `GEORADIUS` (or `GEOSEARCH`, preferred on Redis >= 6.2) query with
 * `WITHDIST ASC` returns candidates sorted by distance in O(N+log M) time,
 * where N is the number of results and M is the total number of members.
 *
 * Additional per-driver stats are kept in a Redis Hash:
 *   HSET driver:stats:{driverId}
 *       lastTripEndAt       <unix-ms>
 *       totalAccepted       <int>
 *       totalDeclined       <int>
 *       totalCancelled      <int>
 *       offersThisWeek      <int>
 *       firstSeenThisWeek   <unix-ms>
 *
 * ## ML Enhancement Ideas (future)
 * ─────────────────────────────────────────────────────────────────────
 * 1. Accept-probability model: a gradient-boosted classifier (XGBoost /
 *    LightGBM) trained on (driver, ride-request) feature pairs predicts
 *    P(accept). Replaces the hand-tuned acceptance_rate weight.
 * 2. ETA model: a regression model trained on historical GPS traces and
 *    traffic patterns gives a more accurate arrival-time estimate.
 * 3. Contextual bandits / reinforcement learning: the system learns optimal
 *    weights per city zone / time-of-day by maximising the reward signal
 *    (ride accepted and completed without cancellation).
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface DriverCandidate {
  driverId: string;
  userId: string;

  /** Driver's current latitude */
  lat: number;
  /** Driver's current longitude */
  lng: number;

  /** Average rating 0–5 */
  rating: number;

  /** Seconds elapsed since driver's last completed trip (idle time) */
  idleSeconds: number;

  /**
   * Fraction of ride offers accepted this week (0–1).
   * Defaults to ASSUMED_ACCEPTANCE_RATE when missing.
   */
  acceptanceRate: number;

  /**
   * Fraction of accepted rides cancelled before completion this week (0–1).
   * Defaults to ASSUMED_CANCEL_RATE when missing.
   */
  cancelRate: number;

  /** 'CAR' | 'MOTORCYCLE' | 'SUV' */
  vehicleType: string;

  /** Pre-calculated great-circle distance from passenger (km) */
  distanceKm: number;

  /** Optional system priority boost in range [0, 1] */
  driverPriority?: number;

  /** Optional AI score adjustment before bounded clamp */
  aiAdjustment?: number;

  /**
   * Accept probability multiplier from ML model — clamped [0.3, 1.2].
   * Defaults to 1.0 (neutral) when disabled or on fallback.
   */
  pAccept?: number;
}

export interface ScoredDriver extends DriverCandidate {
  /** Composite score — higher is better */
  score: number;
  /** Estimated minutes to reach the passenger */
  etaMinutes: number;
  /** Human-readable ETA string */
  etaText: string;
  /** Component-wise breakdown for observability/demo */
  scoreBreakdown: {
    etaScore: number;
    ratingScore: number;
    acceptScore: number;
    cancelPenalty: number;
    idleScore: number;
    distancePenalty: number;
    priorityScore: number;
    aiAdjustment: number;
    /** Accept-probability multiplier actually applied (1.0 = no effect) */
    pAcceptMultiplier: number;
  };
}

export interface MatchingResult {
  ranked: ScoredDriver[];
  dispatchList: ScoredDriver[];
  dispatchMode: 'sequential' | 'broadcast';
}

export interface MatchingConfig {
  /** Maximum search radius in km (default: 5) */
  maxRadiusKm: number;

  /** How many top drivers to return / offer simultaneously (default: 5) */
  topN: number;

  /**
   * 'sequential': offer to rank-1 first; escalate on timeout.
   * 'broadcast' : offer to all topN at once (first-accept-wins).
   */
  dispatchMode: 'sequential' | 'broadcast';

  // ── Scoring weights ──────────────────────────────────────────────────────

  /** Reward weight for inverse ETA (0–1) */
  wEta: number;

  /** Penalty weight for distance (0–1) */
  wDistance: number;
  /** Reward weight for driver rating (0–1) */
  wRating: number;
  /** Reward weight for idle time (0–1) */
  wIdleTime: number;
  /** Reward weight for acceptance rate (0–1) */
  wAcceptance: number;
  /** Penalty weight for cancel rate (0–1) */
  wCancelRate: number;

  /** Reward weight for system-level driver priority (0–1) */
  wDriverPriority: number;

  /** Enable bounded AI score adjustment */
  aiAdjustmentEnabled: boolean;

  /** Absolute max delta added by AI adjustment */
  aiAdjustmentDeltaMax: number;

  /** Enable P_accept score multiplier from ML model */
  pAcceptEnabled: boolean;

  /** Clamp floor for P_accept multiplier (default 0.3) */
  pAcceptClampMin: number;

  /** Clamp ceiling for P_accept multiplier (default 1.2) */
  pAcceptClampMax: number;

  // ── Normalisation caps ───────────────────────────────────────────────────

  /** Idle time value that maps to 1.0 (default: 2 hours) */
  maxIdleSeconds: number;

  /** Average urban speed used for ETA estimation (km/h, default: 25) */
  avgUrbanSpeedKmh: number;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

/** Fallback acceptance rate when driver has no recorded offers this week */
const ASSUMED_ACCEPTANCE_RATE = 0.85;
/** Fallback cancel rate when driver has no history */
const ASSUMED_CANCEL_RATE = 0.05;

export const DEFAULT_CONFIG: Readonly<MatchingConfig> = {
  maxRadiusKm: 5,
  topN: 5,
  dispatchMode: 'sequential',

  wEta: 0.40,
  wDistance: 0.05,
  wRating: 0.20,
  wIdleTime: 0.05,
  wAcceptance: 0.15,
  wCancelRate: 0.15,
  wDriverPriority: 0.05,

  aiAdjustmentEnabled: false,
  aiAdjustmentDeltaMax: 0.08,

  pAcceptEnabled: false,
  pAcceptClampMin: 0.3,
  pAcceptClampMax: 1.2,

  maxIdleSeconds: 7_200, // 2 hours
  avgUrbanSpeedKmh: 25,
};

// ── Haversine distance ────────────────────────────────────────────────────────

/**
 * Returns the great-circle distance between two WGS-84 coordinates in km.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371; // Earth mean radius km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── ETA estimation ────────────────────────────────────────────────────────────

/**
 * Estimates driver arrival time in minutes.
 * Assumes constant urban speed; replace with routing API in production.
 */
export function estimateEtaMinutes(distanceKm: number, avgSpeedKmh: number): number {
  return Math.ceil((distanceKm / avgSpeedKmh) * 60);
}

function formatEta(minutes: number): string {
  if (minutes < 1) return '< 1 phút';
  if (minutes < 60) return `${minutes} phút`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
}

// ── DriverMatcher class ───────────────────────────────────────────────────────

export class DriverMatcher {
  private readonly cfg: MatchingConfig;

  constructor(config: Partial<MatchingConfig> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
  }

  private boundedAiAdjustment(raw: number | undefined): number {
    if (!this.cfg.aiAdjustmentEnabled) {
      return 0;
    }

    const maxDelta = Math.max(0, this.cfg.aiAdjustmentDeltaMax);
    const value = Number.isFinite(raw) ? (raw as number) : 0;
    return Math.max(-maxDelta, Math.min(maxDelta, value));
  }

  /**
   * Returns the P_accept multiplier to apply to the final score.
   * - If pAcceptEnabled is false → 1.0 (neutral, no effect)
   * - If driver.pAccept is missing → 1.0 (fallback)
   * - Otherwise → clamp(pAccept, clampMin, clampMax)
   */
  private resolvedPAccept(raw: number | undefined): number {
    if (!this.cfg.pAcceptEnabled) return 1.0;
    if (raw === undefined || !Number.isFinite(raw)) return 1.0;
    return Math.max(this.cfg.pAcceptClampMin, Math.min(this.cfg.pAcceptClampMax, raw));
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Score a single driver candidate.
   * Returns a value in approximately [−0.40, +1.00].
   * Higher score → better match.
   */
  scoreDriver(driver: DriverCandidate): number {
    const {
      wEta,
      wDistance,
      wRating,
      wIdleTime,
      wAcceptance,
      wCancelRate,
      wDriverPriority,
      maxRadiusKm,
      maxIdleSeconds,
      avgUrbanSpeedKmh,
    } = this.cfg;

    // Normalise each factor to [0, 1] — cap outliers at the defined max.
    const etaMinutes = estimateEtaMinutes(driver.distanceKm, avgUrbanSpeedKmh);
    const etaScore = Math.max(0, Math.min(1, 1 / Math.max(1, etaMinutes)));
    const normDist = Math.min(driver.distanceKm, maxRadiusKm) / maxRadiusKm;
    const normRating = driver.rating / 5;
    const normIdle = Math.min(driver.idleSeconds, maxIdleSeconds) / maxIdleSeconds;
    const normAccept = Math.max(0, Math.min(1, driver.acceptanceRate));
    const normCancel = Math.max(0, Math.min(1, driver.cancelRate));
    const normPriority = Math.max(0, Math.min(1, driver.driverPriority ?? 0));
    const aiAdjustment = this.boundedAiAdjustment(driver.aiAdjustment);
    const pAcceptMultiplier = this.resolvedPAccept(driver.pAccept);

    const baseScore =
      + wEta * etaScore
      + wRating * normRating
      + wAcceptance * normAccept
      - wCancelRate * normCancel
      + wIdleTime * normIdle
      - wDistance * normDist
      + wDriverPriority * normPriority
      + aiAdjustment;

    return baseScore * pAcceptMultiplier;
  }

  scoreBreakdown(driver: DriverCandidate): ScoredDriver['scoreBreakdown'] {
    const {
      wEta,
      wDistance,
      wRating,
      wIdleTime,
      wAcceptance,
      wCancelRate,
      wDriverPriority,
      maxRadiusKm,
      maxIdleSeconds,
      avgUrbanSpeedKmh,
    } = this.cfg;

    const etaMinutes = estimateEtaMinutes(driver.distanceKm, avgUrbanSpeedKmh);
    const etaScore = Math.max(0, Math.min(1, 1 / Math.max(1, etaMinutes)));
    const normDist = Math.min(driver.distanceKm, maxRadiusKm) / maxRadiusKm;
    const normRating = driver.rating / 5;
    const normIdle = Math.min(driver.idleSeconds, maxIdleSeconds) / maxIdleSeconds;
    const normAccept = Math.max(0, Math.min(1, driver.acceptanceRate));
    const normCancel = Math.max(0, Math.min(1, driver.cancelRate));
    const normPriority = Math.max(0, Math.min(1, driver.driverPriority ?? 0));
    const aiAdjustment = this.boundedAiAdjustment(driver.aiAdjustment);
    const pAcceptMultiplier = this.resolvedPAccept(driver.pAccept);

    return {
      etaScore: wEta * etaScore,
      ratingScore: wRating * normRating,
      acceptScore: wAcceptance * normAccept,
      cancelPenalty: wCancelRate * normCancel,
      idleScore: wIdleTime * normIdle,
      distancePenalty: wDistance * normDist,
      priorityScore: wDriverPriority * normPriority,
      aiAdjustment,
      pAcceptMultiplier,
    };
  }

  /**
   * Given a list of raw candidates, filter by radius & vehicle type,
   * score, rank descending, and return the top-N with ETA attached.
   *
   * @param candidates       Raw driver candidates from Redis geo query
   * @param requestedVehicle Optional vehicle type filter (e.g. 'ECONOMY', 'CAR')
   */
  rank(candidates: DriverCandidate[], requestedVehicle?: string): ScoredDriver[] {
    const { maxRadiusKm, topN, avgUrbanSpeedKmh } = this.cfg;

    return candidates
      .filter((d) => {
        if (d.distanceKm > maxRadiusKm) return false;
        if (requestedVehicle && !isVehicleCompatible(d.vehicleType, requestedVehicle)) return false;
        return true;
      })
      .map((d) => {
        const eta = estimateEtaMinutes(d.distanceKm, avgUrbanSpeedKmh);
        const breakdown = this.scoreBreakdown(d);
        return {
          ...d,
          acceptanceRate: d.acceptanceRate ?? ASSUMED_ACCEPTANCE_RATE,
          cancelRate: d.cancelRate ?? ASSUMED_CANCEL_RATE,
          score: (
            breakdown.etaScore +
            breakdown.ratingScore +
            breakdown.acceptScore -
            breakdown.cancelPenalty +
            breakdown.idleScore -
            breakdown.distancePenalty +
            breakdown.priorityScore +
            breakdown.aiAdjustment
          ) * breakdown.pAcceptMultiplier,
          etaMinutes: eta,
          etaText: formatEta(eta),
          scoreBreakdown: breakdown,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
  }

  /**
   * Full matching pipeline: rank candidates, build the dispatch list
   * according to the configured dispatch mode, and return the result.
   *
   * - **sequential**: dispatch list = [rank-1 only].  The caller is expected
   *   to escalate to rank-2, rank-3 … on timeout.
   * - **broadcast**: dispatch list = all topN drivers.
   */
  match(candidates: DriverCandidate[], requestedVehicle?: string): MatchingResult {
    const ranked = this.rank(candidates, requestedVehicle);

    const dispatchList =
      this.cfg.dispatchMode === 'broadcast'
        ? ranked
        : ranked.slice(0, 1); // sequential: only the best driver first

    return { ranked, dispatchList, dispatchMode: this.cfg.dispatchMode };
  }

  // ── Fallback ────────────────────────────────────────────────────────────────

  /**
   * Returns true when no drivers were found and the caller should widen the
   * search radius or publish a no-driver event.
   */
  static noDriverFound(result: MatchingResult): boolean {
    return result.ranked.length === 0;
  }
}

// ── Vehicle-type compatibility ────────────────────────────────────────────────

/**
 * Maps passenger-facing vehicle category to the set of driver vehicle types
 * that can fulfil it.
 *
 * ECONOMY  → any (CAR or MOTORCYCLE)
 * COMFORT  → CAR only
 * PREMIUM  → SUV only
 * Direct vehicle type string is also accepted (e.g. 'CAR', 'SUV').
 */
function getCompatibleVehicleTypes(requested: string): string[] | null {
  switch (requested.toUpperCase()) {
    case 'MOTORBIKE':
      return ['MOTORBIKE'];
    case 'SCOOTER':
      return ['SCOOTER'];
    case 'CAR_4':
      return ['CAR_4'];
    case 'CAR_7':
      return ['CAR_7'];
    // legacy fallback
    case 'ECONOMY':
      return ['MOTORBIKE'];
    case 'COMFORT':
      return ['CAR_4'];
    case 'PREMIUM':
      return ['CAR_7'];
    default:
      return null;
  }
}

function isVehicleCompatible(driverType: string, requested: string): boolean {
  const compatible = getCompatibleVehicleTypes(requested);
  return !compatible || compatible.includes(driverType.toUpperCase());
}

// ── Redis stats helpers ───────────────────────────────────────────────────────
// Use these helpers to read/write per-driver statistics in Redis.

export interface DriverStats {
  /** Unix timestamp (ms) when the last trip ended — used to compute idleSeconds */
  lastTripEndAt: number;
  /** Lifetime accepted offers */
  totalAccepted: number;
  /** Lifetime declined offers */
  totalDeclined: number;
  /** Lifetime cancelled rides (after accepting) */
  totalCancelled: number;
}

/** Redis hash key for a driver's running stats */
export const driverStatsKey = (driverId: string) => `driver:stats:${driverId}`;

/**
 * Compute acceptance and cancel rates from raw counts.
 * Uses a minimum of 5 total offers before deviating from the assumed rate,
 * to avoid penalising brand-new drivers unfairly.
 */
export function computeRates(stats: DriverStats): { acceptanceRate: number; cancelRate: number } {
  const MIN_SAMPLE = 5;
  const totalOffered = stats.totalAccepted + stats.totalDeclined;

  const acceptanceRate =
    totalOffered >= MIN_SAMPLE
      ? stats.totalAccepted / totalOffered
      : ASSUMED_ACCEPTANCE_RATE;

  const cancelRate =
    stats.totalAccepted >= MIN_SAMPLE
      ? stats.totalCancelled / stats.totalAccepted
      : ASSUMED_CANCEL_RATE;

  return { acceptanceRate, cancelRate };
}

/**
 * Build a DriverCandidate from raw data fetched from Redis / gRPC.
 */
export function buildCandidate(
  driverId: string,
  userId: string,
  lat: number,
  lng: number,
  distanceKm: number,
  vehicleType: string,
  rating: number,
  stats: DriverStats | null,
): DriverCandidate {
  const now = Date.now();
  const idleSeconds = stats?.lastTripEndAt
    ? Math.max(0, Math.floor((now - stats.lastTripEndAt) / 1_000))
    : 0;

  const { acceptanceRate, cancelRate } = stats
    ? computeRates(stats)
    : { acceptanceRate: ASSUMED_ACCEPTANCE_RATE, cancelRate: ASSUMED_CANCEL_RATE };

  const totalOffers = stats ? (stats.totalAccepted + stats.totalDeclined) : 0;
  const newDriverBoost = totalOffers < 5 ? 0.35 : 0;
  const idleBoost = Math.min(idleSeconds / 3_600, 1) * 0.45;
  const reliabilityPenalty = cancelRate * 0.25;
  const driverPriority = Math.max(0, Math.min(1, newDriverBoost + idleBoost - reliabilityPenalty));

  return {
    driverId,
    userId,
    lat,
    lng,
    rating,
    idleSeconds,
    acceptanceRate,
    cancelRate,
    vehicleType,
    distanceKm,
    driverPriority,
  };
}
