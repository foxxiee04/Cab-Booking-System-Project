import amqp, { Channel, Connection, ConsumeMessage } from 'amqplib';
import { config } from '../config';
import { logger } from '../utils/logger';
import { SocketServer } from '../socket/socket-server';
import Redis from 'ioredis';
import { driverGrpcClient } from '../grpc/driver.client';
import {
  DriverMatcher,
  DriverCandidate,
  ScoredDriver,
  DriverStats,
  buildCandidate,
  driverStatsKey,
  haversineKm,
} from '../matching/driver-matcher';
import { observeAiMatchingDecision } from '../metrics/matching-ai.metrics';

const EXCHANGE_NAME = 'domain-events';
const QUEUE_NAME = 'api-gateway-events';
const DRIVER_GEO_KEY = 'drivers:geo:online';
const DEFAULT_MATCH_RADIUS_METERS = 5000;
const DEFAULT_OFFER_TIMEOUT_SECONDS = 30;
const MATCHING_MAX_ATTEMPTS = config.matching.maxAttempts;
const MATCHING_RETRY_DELAY_MS = config.matching.retryDelayMs;
const MATCHING_MAX_WAIT_MS = config.matching.maxWaitMs;

interface DispatchRoundPlan {
  radiusKm: number;
  offerCount: number;
  surgeMultiplierHint: number;
}

const DISPATCH_ROUND_PLANS: DispatchRoundPlan[] = [
  { radiusKm: 2, offerCount: 1, surgeMultiplierHint: 1.0 },
  { radiusKm: 3, offerCount: 3, surgeMultiplierHint: 1.1 },
  { radiusKm: 5, offerCount: 5, surgeMultiplierHint: 1.2 },
];

function parseRoundPlans(raw: string): DispatchRoundPlan[] {
  if (!raw.trim()) {
    logger.warn('MATCHING_ROUNDS is empty, using built-in dispatch round plans');
    return DISPATCH_ROUND_PLANS;
  }

  const parsed = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [radiusKmRaw, offerCountRaw, surgeRaw] = item.split(':');
      const radiusKm = Number(radiusKmRaw);
      const offerCount = Number(offerCountRaw);
      const surgeMultiplierHint = Number(surgeRaw);
      if (!Number.isFinite(radiusKm) || !Number.isFinite(offerCount) || !Number.isFinite(surgeMultiplierHint)) {
        logger.warn(`Invalid MATCHING_ROUNDS item \"${item}\", skipping`);
        return null;
      }
      return {
        radiusKm: Math.max(0.5, radiusKm),
        offerCount: Math.max(1, Math.floor(offerCount)),
        surgeMultiplierHint: Math.max(1, surgeMultiplierHint),
      };
    })
    .filter((entry): entry is DispatchRoundPlan => Boolean(entry));

  if (parsed.length === 0) {
    logger.warn('No valid MATCHING_ROUNDS items found, using built-in dispatch round plans');
    return DISPATCH_ROUND_PLANS;
  }

  return parsed;
}

const ROUND_PLANS = parseRoundPlans(config.matching.rounds);

function getRoundPlan(attempt: number): DispatchRoundPlan {
  const index = Math.max(0, Math.min(attempt - 1, ROUND_PLANS.length - 1));
  return ROUND_PLANS[index];
}

interface MatchingLocation {
  lat: number;
  lng: number;
  address?: string;
}

interface RideEventPayload {
  rideId: string;
  customerId: string;
  driverId?: string;
  status: string;
  pickup?: MatchingLocation;
  dropoff?: MatchingLocation;
  fare?: number;
  distance?: number;
  duration?: number;
}

interface MatchingRequestedPayload {
  rideId: string;
  customerId: string;
  vehicleType?: string;
  pickup: MatchingLocation;
  dropoff?: MatchingLocation;
  fare?: number;
  estimatedFare?: number;
  distance?: number;
  duration?: number;
  searchRadiusKm?: number;
  excludeDriverIds?: string[];
  attempt?: number;
  maxAttempts?: number;
  matchingStartedAt?: string;
  maxWaitMs?: number;
}

interface RideOfferedPayload {
  rideId: string;
  driverId: string;
  customerId: string;
  pickup: MatchingLocation;
  dropoff: MatchingLocation;
  fare?: number;
  distance?: number;
  duration?: number;
  ttlSeconds?: number;
  expiresAt?: string;
}

interface DriverRecipient {
  driverId: string;
  userId: string;
}

interface MatchingAiContext {
  demandSupplyGap: number;
  zoneFactor: number;
  timeFactor: number;
  gapFactor: number;
  aiServiceFactor: number;
  source: 'HEURISTIC' | 'AI_SERVICE';
  reasonCode: string;
  modelVersion?: string;
  confidenceScore?: number;
  aiAdjustment: number;
}

interface MatchingAiServiceResponse {
  surge_hint?: number;
  recommended_driver_radius_km?: number;
  confidence_score?: number;
  model_version?: string;
  insights?: {
    demand_level?: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

interface AcceptDriverResult {
  driver_id: string;
  p_accept: number;
  p_accept_clamped: number;
  confidence: number;
}

interface AcceptBatchResponse {
  results: AcceptDriverResult[];
  model_version: string;
  reason_code: string;
  inference_ms: number;
}

interface WaitTimePrediction {
  wait_time_minutes: number;
  confidence: number;
  model_version: string;
  reason_code: string;
}

/** Map lat/lng to HCMC zone for P_accept feature encoding */
function mapPickupZone(lat: number, lng: number): string {
  // Zone A: Central (Q1, Q3) — lat 10.76–10.82, lng 106.68–106.74
  if (lat >= 10.76 && lat <= 10.82 && lng >= 106.68 && lng <= 106.74) return 'A';
  // Zone B: Inner suburbs (Q5, Q10, Bình Thạnh) — broader inner ring
  if (lat >= 10.72 && lat <= 10.86 && lng >= 106.62 && lng <= 106.78) return 'B';
  // Zone C: Outer ring (Tân Bình, Gò Vấp, Thủ Đức)
  if (lat >= 10.65 && lat <= 10.92 && lng >= 106.55 && lng <= 106.85) return 'C';
  return 'D'; // Suburban / outside HCMC core
}

function getCompatibleDriverVehicleTypes(requestedVehicleType?: string): string[] | null {
  switch ((requestedVehicleType || '').toUpperCase()) {
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

function isCompatibleDriverVehicleType(driverVehicleType: string | undefined, requestedVehicleType?: string): boolean {
  const compatibleDriverTypes = getCompatibleDriverVehicleTypes(requestedVehicleType);
  if (!compatibleDriverTypes || !driverVehicleType) {
    return true;
  }

  return compatibleDriverTypes.includes(driverVehicleType.toUpperCase());
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeHeuristicMatchingAiContext(
  payload: MatchingRequestedPayload,
  candidatesCount: number,
  roundPlan: DispatchRoundPlan,
): MatchingAiContext {
  const demandSupplyGap = roundPlan.offerCount / Math.max(1, candidatesCount);
  const hour = new Date().getHours();
  const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
  const timeFactor = isRushHour ? 0.02 : -0.005;

  // Lightweight zone proxy: denser core coordinates get a small positive boost.
  const inCoreZone =
    payload.pickup.lat >= 10.70
    && payload.pickup.lat <= 10.86
    && payload.pickup.lng >= 106.60
    && payload.pickup.lng <= 106.78;
  const zoneFactor = inCoreZone ? 0.01 : 0;

  let gapFactor = 0;
  if (demandSupplyGap >= 1.5) {
    gapFactor = 0.06;
  } else if (demandSupplyGap >= 1.0) {
    gapFactor = 0.03;
  } else if (demandSupplyGap <= 0.4) {
    gapFactor = -0.02;
  }

  return {
    demandSupplyGap,
    zoneFactor,
    timeFactor,
    gapFactor,
    aiServiceFactor: 0,
    source: 'HEURISTIC',
    reasonCode: 'AI_FALLBACK_HEURISTIC',
    aiAdjustment: gapFactor + zoneFactor + timeFactor,
  };
}

function deriveAiServiceFactor(
  aiResponse: MatchingAiServiceResponse,
  roundPlan: DispatchRoundPlan,
): number {
  const demandLevel = aiResponse.insights?.demand_level;
  const demandFactor =
    demandLevel === 'HIGH'
      ? 0.04
      : demandLevel === 'MEDIUM'
        ? 0.02
        : -0.005;

  const surgeHint = typeof aiResponse.surge_hint === 'number' ? aiResponse.surge_hint : 1;
  const surgeFactor = clamp((surgeHint - 1) * 0.05, -0.03, 0.06);

  const radiusSuggestion =
    typeof aiResponse.recommended_driver_radius_km === 'number'
      ? aiResponse.recommended_driver_radius_km
      : roundPlan.radiusKm;
  const radiusFactor = clamp((radiusSuggestion - roundPlan.radiusKm) * 0.02, -0.04, 0.04);

  const confidence = clamp(
    typeof aiResponse.confidence_score === 'number' ? aiResponse.confidence_score : 0.5,
    0.1,
    1,
  );

  return (demandFactor + surgeFactor + radiusFactor) * confidence;
}

export class EventConsumer {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private socketServer: SocketServer;
  private redis: Redis;
  private driverUserCache = new Map<string, string>();

  constructor(socketServer: SocketServer) {
    this.socketServer = socketServer;
    this.redis = new Redis(config.redisUrl);
  }

  async connect(): Promise<void> {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
      this.connection = await amqp.connect(rabbitmqUrl) as any as Connection;
      this.channel = await (this.connection as any).createChannel();

      await this.channel!.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
      await this.channel!.assertQueue(QUEUE_NAME, { durable: true });

      // Bind to events we care about
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.finding_driver_requested');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.reassignment_requested');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.offered');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.assigned');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.offer_timeout');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.accepted');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.picking_up');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.started');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.completed');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.cancelled');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.no_driver_found');

      await this.channel!.consume(QUEUE_NAME, this.handleMessage.bind(this), { noAck: false });

      logger.info('API Gateway EventConsumer connected to RabbitMQ');
    } catch (error) {
      this.channel = null;
      this.connection = null;
      logger.error('Failed to connect to RabbitMQ:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }

  private async handleMessage(msg: ConsumeMessage | null): Promise<void> {
    if (!msg) return;

    try {
      const content = JSON.parse(msg.content.toString());
      const eventType = content.eventType || msg.fields.routingKey;

      logger.info(`Received event: ${eventType}`);

      switch (eventType) {
        case 'ride.finding_driver_requested':
        case 'ride.reassignment_requested':
          await this.handleMatchingRequested(content.payload);
          break;
        case 'ride.offered':
          await this.handleRideOffered(content.payload);
          break;
        case 'ride.assigned':
          await this.handleRideAssigned(content.payload);
          break;
        case 'ride.offer_timeout':
          await this.handleRideOfferTimeout(content.payload);
          break;
        case 'ride.accepted':
          await this.handleRideAccepted(content.payload);
          break;
        case 'ride.picking_up':
          await this.handleRidePickingUp(content.payload);
          break;
        case 'ride.started':
          await this.handleRideStarted(content.payload);
          break;
        case 'ride.completed':
          await this.handleRideCompleted(content.payload);
          break;
        case 'ride.cancelled':
          await this.handleRideCancelled(content.payload);
          break;
        case 'ride.no_driver_found':
          await this.handleRideNoDriverFound(content.payload);
          break;
        default:
          logger.debug(`Unhandled event type: ${eventType}`);
      }

      this.channel?.ack(msg);
    } catch (error) {
      logger.error('Error processing message:', error);
      this.channel?.nack(msg, false, false);
    }
  }

  private async handleMatchingRequested(payload: MatchingRequestedPayload): Promise<void> {
    logger.info(`Processing driver matching request for ride ${payload.rideId}`);

    try {
      const attempt = Math.max(1, payload.attempt ?? 1);
      const maxAttempts = MATCHING_MAX_ATTEMPTS;
      const roundPlan = getRoundPlan(attempt);
      const startedAt = payload.matchingStartedAt ?? new Date().toISOString();
      const maxWaitMs = MATCHING_MAX_WAIT_MS;
      const elapsedMs = Date.now() - new Date(startedAt).getTime();

      if (elapsedMs >= maxWaitMs) {
        logger.warn(
          `Matching time budget exceeded for ride ${payload.rideId} ` +
          `(elapsedMs=${elapsedMs}, maxWaitMs=${maxWaitMs})`,
        );
        this.socketServer.emitToCustomer(payload.customerId, 'RIDE_MATCHING_FAILED', {
          rideId: payload.rideId,
          attempt,
          maxAttempts,
          message: 'Không tìm thấy tài xế phù hợp trong thời gian cho phép.',
        });
        return;
      }

      // 1. Fetch all geo-candidates and enrich with stats
      const candidates = await this.buildCandidates(
        payload.pickup,
        this.getMatchRadiusMeters(roundPlan.radiusKm),
        payload.excludeDriverIds,
      );

      const aiContext = await this.resolveMatchingAiContext(payload, candidates.length, roundPlan);

      // 2a. Derive demand level from AI context for P_accept call
      const demandLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
        aiContext.source === 'AI_SERVICE'
          ? ((aiContext as { demandLevel?: string }).demandLevel as 'LOW' | 'MEDIUM' | 'HIGH') ?? 'MEDIUM'
          : aiContext.demandSupplyGap >= 1.5 ? 'HIGH' : aiContext.demandSupplyGap <= 0.5 ? 'LOW' : 'MEDIUM';

      // 2b. Fetch per-driver accept probabilities in parallel (separate AI call, own timeout)
      const acceptProbMap = await this.fetchAcceptProbabilities(candidates, payload, { demandLevel });

      // 2c. Predict wait time — auto-adjust radius/surge if wait is too high
      const avgAcceptRate = candidates.length > 0
        ? candidates.reduce((s, c) => s + c.acceptanceRate, 0) / candidates.length
        : 0.75;
      const waitPrediction = await this.fetchWaitTimePrediction(
        payload, candidates.length, demandLevel, avgAcceptRate, roundPlan.surgeMultiplierHint,
      );

      // Adjust round plan values if wait > threshold (only on first attempt to avoid oscillation)
      let effectiveRadiusKm = roundPlan.radiusKm;
      let effectiveSurge = roundPlan.surgeMultiplierHint;
      const waitThreshold = config.matching.waitThresholdMinutes;
      if (attempt === 1 && waitPrediction.wait_time_minutes > waitThreshold) {
        effectiveRadiusKm = Math.min(roundPlan.radiusKm * 1.2, config.matching.maxRadiusKm);
        effectiveSurge = Math.min(roundPlan.surgeMultiplierHint * 1.05, 1.5);
        logger.info(
          `[WaitAdj] ride=${payload.rideId} predictedWait=${waitPrediction.wait_time_minutes.toFixed(1)}min ` +
          `> threshold=${waitThreshold}min → radius ${roundPlan.radiusKm}→${effectiveRadiusKm.toFixed(2)}km ` +
          `surge ${roundPlan.surgeMultiplierHint.toFixed(2)}→${effectiveSurge.toFixed(2)}`,
        );
      }

      const aiAdjustedCandidates = candidates.map((candidate) => ({
        ...candidate,
        ...(config.matching.aiAdjustmentEnabled ? { aiAdjustment: aiContext.aiAdjustment } : {}),
        ...(config.matching.pAcceptEnabled ? { pAccept: acceptProbMap.get(candidate.driverId) } : {}),
      }));

      // 2. Score & rank — returns top-N ordered by composite score
      const matcher = new DriverMatcher({
        topN: roundPlan.offerCount,
        dispatchMode: roundPlan.offerCount === 1 ? 'sequential' : 'broadcast',
        aiAdjustmentEnabled: config.matching.aiAdjustmentEnabled,
        aiAdjustmentDeltaMax: config.matching.aiAdjustmentDeltaMax,
        pAcceptEnabled: config.matching.pAcceptEnabled,
        pAcceptClampMin: config.matching.pAcceptClampMin,
        pAcceptClampMax: config.matching.pAcceptClampMax,
      });
      const result = matcher.match(aiAdjustedCandidates, payload.vehicleType);

      if (DriverMatcher.noDriverFound(result)) {
        logger.warn(
          `No suitable drivers found for ride ${payload.rideId} ` +
          `(attempt=${attempt}/${maxAttempts}, radiusKm=${roundPlan.radiusKm}, candidates=${candidates.length})`,
        );

        if (attempt < maxAttempts) {
          await this.publishMatchingRetry(
            { ...payload, matchingStartedAt: startedAt, maxWaitMs },
            attempt + 1,
            maxAttempts,
            roundPlan.surgeMultiplierHint,
          );
        } else {
          this.socketServer.emitToCustomer(payload.customerId, 'RIDE_MATCHING_FAILED', {
            rideId: payload.rideId,
            attempt,
            maxAttempts,
            message: 'Không tìm thấy tài xế phù hợp. Vui lòng thử lại sau ít phút.',
          });
        }
        return;
      }

      const offeredDrivers = result.ranked.slice(0, roundPlan.offerCount);
      const effectiveFare = Math.round((payload.fare ?? payload.estimatedFare ?? 0) * effectiveSurge);

      const baseNotification = {
        rideId: payload.rideId,
        customerId: payload.customerId,
        pickup: payload.pickup,
        dropoff: payload.dropoff,
        estimatedFare: effectiveFare,
        surgeMultiplierHint: effectiveSurge,
        vehicleType: payload.vehicleType,
        distance: payload.distance,
        duration: payload.duration,
        timeoutSeconds: DEFAULT_OFFER_TIMEOUT_SECONDS,
        searchAttempt: attempt,
        searchRadiusKm: effectiveRadiusKm,
        offerBatchSize: offeredDrivers.length,
      };

      for (const candidate of offeredDrivers) {
        this.socketServer.emitToDriver(candidate.userId, 'NEW_RIDE_AVAILABLE', {
          ...baseNotification,
          etaMinutes: candidate.etaMinutes,
          etaText: candidate.etaText,
          driverScore: candidate.score.toFixed(3),
          driverPriority: ((candidate.driverPriority ?? 0) * 100).toFixed(0),
        });
      }

      logger.info(
        `[Round ${attempt}/${maxAttempts}] Dispatched to ${offeredDrivers.length} drivers for ride ${payload.rideId} ` +
        `(radiusKm=${effectiveRadiusKm.toFixed(2)}, surgeHint=${effectiveSurge.toFixed(2)}, elapsedMs=${elapsedMs}, maxWaitMs=${maxWaitMs}, ` +
        `predictedWait=${waitPrediction.wait_time_minutes.toFixed(1)}min, ` +
        `aiEnabled=${config.matching.aiAdjustmentEnabled}, aiSource=${aiContext.source}, aiReason=${aiContext.reasonCode}, ` +
        `aiAdj=${aiContext.aiAdjustment.toFixed(3)}, aiSvc=${aiContext.aiServiceFactor.toFixed(3)}, ` +
        `gap=${aiContext.demandSupplyGap.toFixed(2)}, model=${aiContext.modelVersion ?? 'n/a'})`,
      );

      logger.info(
        `Matching summary for ride ${payload.rideId}: ` +
        result.ranked.slice(0, offeredDrivers.length).map(
          (d, i) =>
            `#${i + 1} driver=${d.driverId} score=${d.score.toFixed(3)} eta=${d.etaText} ` +
            `[eta=${d.scoreBreakdown.etaScore.toFixed(3)} rating=${d.scoreBreakdown.ratingScore.toFixed(3)} ` +
            `accept=${d.scoreBreakdown.acceptScore.toFixed(3)} cancel=-${d.scoreBreakdown.cancelPenalty.toFixed(3)} ` +
            `idle=${d.scoreBreakdown.idleScore.toFixed(3)} distance=-${d.scoreBreakdown.distancePenalty.toFixed(3)} ` +
            `priority=${d.scoreBreakdown.priorityScore.toFixed(3)} aiAdj=${d.scoreBreakdown.aiAdjustment.toFixed(3)} | raw(distanceKm=${d.distanceKm.toFixed(3)} ` +
            `rating=${d.rating.toFixed(2)} acceptRate=${(d.acceptanceRate * 100).toFixed(1)}% ` +
            `cancelRate=${(d.cancelRate * 100).toFixed(1)}% idleSeconds=${Math.round(d.idleSeconds)} ` +
            `driverPriority=${((d.driverPriority ?? 0) * 100).toFixed(1)}%)]`,
        ).join(' | '),
      );

      if (config.matching.scoreLogVerbose) {
        logger.info(
          `Matching verbose ranking for ride ${payload.rideId}: ` +
          result.ranked.map(
            (d, i) =>
              `#${i + 1} driver=${d.driverId} score=${d.score.toFixed(3)} ` +
              `[eta=${d.scoreBreakdown.etaScore.toFixed(3)} rating=${d.scoreBreakdown.ratingScore.toFixed(3)} ` +
              `accept=${d.scoreBreakdown.acceptScore.toFixed(3)} cancel=-${d.scoreBreakdown.cancelPenalty.toFixed(3)} ` +
              `idle=${d.scoreBreakdown.idleScore.toFixed(3)} distance=-${d.scoreBreakdown.distancePenalty.toFixed(3)} ` +
              `priority=${d.scoreBreakdown.priorityScore.toFixed(3)}]`,
          ).join(' | '),
        );
      }
    } catch (error) {
      logger.error('Error handling driver matching request:', error);
    }
  }

  private async resolveMatchingAiContext(
    payload: MatchingRequestedPayload,
    candidatesCount: number,
    roundPlan: DispatchRoundPlan,
  ): Promise<MatchingAiContext> {
    const heuristic = computeHeuristicMatchingAiContext(payload, candidatesCount, roundPlan);

    if (!config.matching.aiAdjustmentEnabled) {
      observeAiMatchingDecision({
        source: 'HEURISTIC',
        reasonCode: 'AI_DISABLED_BY_FLAG',
        latencyMs: 0,
      });
      return {
        ...heuristic,
        reasonCode: 'AI_DISABLED_BY_FLAG',
      };
    }

    const aiSignal = await this.fetchMatchingAiSignal(payload);
    if (!aiSignal.data) {
      observeAiMatchingDecision({
        source: 'HEURISTIC',
        reasonCode: aiSignal.reasonCode,
        latencyMs: aiSignal.latencyMs,
      });
      return {
        ...heuristic,
        reasonCode: aiSignal.reasonCode,
      };
    }

    const aiServiceFactor = deriveAiServiceFactor(aiSignal.data, roundPlan);
    observeAiMatchingDecision({
      source: 'AI_SERVICE',
      reasonCode: aiSignal.reasonCode,
      latencyMs: aiSignal.latencyMs,
    });
    return {
      ...heuristic,
      aiServiceFactor,
      source: 'AI_SERVICE',
      reasonCode: aiSignal.reasonCode,
      modelVersion: aiSignal.data.model_version,
      confidenceScore: aiSignal.data.confidence_score,
      aiAdjustment: heuristic.gapFactor + heuristic.zoneFactor + heuristic.timeFactor + aiServiceFactor,
    };
  }

  private getDistanceForAi(payload: MatchingRequestedPayload): number {
    const distance = payload.distance;
    if (typeof distance === 'number' && Number.isFinite(distance) && distance > 0) {
      // Some producers send meters; normalize to km for AI input.
      return distance > 200 ? distance / 1000 : distance;
    }

    if (payload.dropoff) {
      const km = haversineKm(
        payload.pickup.lat,
        payload.pickup.lng,
        payload.dropoff.lat,
        payload.dropoff.lng,
      );
      return Math.max(0.1, km);
    }

    return 1;
  }

  private mapAiTimeOfDay(hour: number): 'OFF_PEAK' | 'RUSH_HOUR' {
    const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
    return isRushHour ? 'RUSH_HOUR' : 'OFF_PEAK';
  }

  private mapAiDayType(dayOfWeek: number): 'WEEKDAY' | 'WEEKEND' {
    return dayOfWeek === 0 || dayOfWeek === 6 ? 'WEEKEND' : 'WEEKDAY';
  }

  private async fetchMatchingAiSignal(
    payload: MatchingRequestedPayload,
  ): Promise<{ data: MatchingAiServiceResponse | null; reasonCode: string; latencyMs: number }> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.matching.aiTimeoutMs);
    timer.unref();

    try {
      const now = new Date();
      const response = await fetch(`${config.services.ai}/api/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          distance_km: this.getDistanceForAi(payload),
          time_of_day: this.mapAiTimeOfDay(now.getHours()),
          day_type: this.mapAiDayType(now.getDay()),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return { data: null, reasonCode: 'AI_HTTP_ERROR', latencyMs: Date.now() - startedAt };
      }

      const body = (await response.json()) as MatchingAiServiceResponse;
      if (!body || typeof body !== 'object') {
        return { data: null, reasonCode: 'AI_INVALID_RESPONSE', latencyMs: Date.now() - startedAt };
      }

      return { data: body, reasonCode: 'AI_OK', latencyMs: Date.now() - startedAt };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { data: null, reasonCode: 'AI_TIMEOUT', latencyMs: Date.now() - startedAt };
      }

      return { data: null, reasonCode: 'AI_HTTP_ERROR', latencyMs: Date.now() - startedAt };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Calls ai-service batch accept endpoint to get per-driver P_accept.
   * Returns a Map<driverId, p_accept_clamped>.
   * Falls back to empty map (all drivers use neutral multiplier 1.0) on timeout/error.
   */
  private async fetchAcceptProbabilities(
    candidates: DriverCandidate[],
    payload: MatchingRequestedPayload,
    aiContext: { demandLevel: 'LOW' | 'MEDIUM' | 'HIGH' },
  ): Promise<Map<string, number>> {
    if (!config.matching.pAcceptEnabled || candidates.length === 0) {
      return new Map();
    }

    const now = new Date();
    const fareEstimate = payload.fare ?? payload.estimatedFare ?? 0;
    const distanceKm = this.getDistanceForAi(payload);
    const pickupZone = mapPickupZone(payload.pickup.lat, payload.pickup.lng);

    const requestBody = {
      context: {
        distance_km: distanceKm,
        fare_estimate: fareEstimate,
        surge_multiplier: 1.0,                    // ride-level surge (unknown here, use neutral)
        hour_of_day: now.getHours(),
        pickup_zone: pickupZone,
        demand_level: aiContext.demandLevel,
        available_driver_count: candidates.length,
      },
      drivers: candidates.map((c) => ({
        driver_id: c.driverId,
        eta_minutes: (c.distanceKm / config.matching.avgUrbanSpeedKmh) * 60,
        driver_accept_rate: c.acceptanceRate,
        driver_cancel_rate: c.cancelRate,
      })),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.matching.aiTimeoutMs);
    timer.unref();

    try {
      const response = await fetch(`${config.services.ai}/api/predict/accept/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        logger.warn(`Accept batch API returned ${response.status} for ride ${payload.rideId}`);
        return new Map();
      }

      const data = (await response.json()) as AcceptBatchResponse;
      const resultMap = new Map<string, number>();
      for (const r of data.results ?? []) {
        resultMap.set(r.driver_id, r.p_accept_clamped);
      }

      logger.debug(
        `Accept batch: ride=${payload.rideId} drivers=${candidates.length} ` +
        `model=${data.model_version} latency=${data.inference_ms}ms reason=${data.reason_code}`,
      );

      return resultMap;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.debug(`Accept batch timeout for ride ${payload.rideId}`);
      } else {
        logger.debug(`Accept batch error for ride ${payload.rideId}: ${error}`);
      }
      return new Map();
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Calls ai-service POST /api/predict/wait-time.
   * Falls back to a heuristic if unavailable or timeout.
   * Safe to ignore on error — returns a neutral 4-minute estimate.
   */
  private async fetchWaitTimePrediction(
    payload: MatchingRequestedPayload,
    availableDriverCount: number,
    demandLevel: 'LOW' | 'MEDIUM' | 'HIGH',
    avgAcceptRate: number,
    surgeMultiplier: number,
  ): Promise<WaitTimePrediction> {
    const fallback: WaitTimePrediction = {
      wait_time_minutes: 4.0,
      confidence: 0.4,
      model_version: 'heuristic-v1',
      reason_code: 'AI_FALLBACK',
    };

    if (!config.matching.waitPredictionEnabled) {
      return fallback;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.matching.aiTimeoutMs);
    timer.unref();

    try {
      const now = new Date();
      const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; // Mon=0…Sun=6

      const response = await fetch(`${config.services.ai}/api/predict/wait-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          demand_level: demandLevel,
          active_booking_count: 0,
          available_driver_count: availableDriverCount,
          hour_of_day: now.getHours(),
          day_of_week: dayOfWeek,
          surge_multiplier: surgeMultiplier,
          avg_accept_rate: avgAcceptRate,
          historical_wait_p50: 4.0,
          pickup_zone: mapPickupZone(payload.pickup.lat, payload.pickup.lng),
        }),
        signal: controller.signal,
      });

      if (!response.ok) return fallback;
      const data = (await response.json()) as WaitTimePrediction;
      return data ?? fallback;
    } catch {
      return fallback;
    } finally {
      clearTimeout(timer);
    }
  }

  private async publishMatchingRetry(
    payload: MatchingRequestedPayload,
    nextAttempt: number,
    maxAttempts: number,
    lastSurgeHint: number,
  ): Promise<void> {
    if (!this.channel) {
      logger.warn(`Cannot publish reassignment_requested for ride ${payload.rideId}: channel unavailable`);
      return;
    }

    const excluded = Array.isArray(payload.excludeDriverIds) ? payload.excludeDriverIds : [];
    const nextEvent = {
      eventId: `${payload.rideId}-retry-${nextAttempt}-${Date.now()}`,
      eventType: 'ride.reassignment_requested',
      occurredAt: new Date().toISOString(),
      correlationId: payload.rideId,
      payload: {
        ...payload,
        fare: Math.round((payload.fare ?? payload.estimatedFare ?? 0) * Math.max(1, lastSurgeHint)),
        searchRadiusKm: getRoundPlan(nextAttempt).radiusKm,
        excludeDriverIds: excluded,
        attempt: nextAttempt,
        maxAttempts,
      },
    };

    const nextRound = getRoundPlan(nextAttempt);
    const delayMs = Math.max(0, MATCHING_RETRY_DELAY_MS);

    const timer = setTimeout(() => {
      if (!this.channel) {
        logger.warn(`Skip delayed reassignment for ride ${payload.rideId}: channel unavailable`);
        return;
      }

      this.channel.publish(
        EXCHANGE_NAME,
        'ride.reassignment_requested',
        Buffer.from(JSON.stringify(nextEvent)),
        { persistent: true },
      );
    }, delayMs);
    timer.unref();

    logger.info(
      `Queued reassignment for ride ${payload.rideId} ` +
      `(nextAttempt=${nextAttempt}/${maxAttempts}, radiusKm=${nextRound.radiusKm}, ` +
      `offerCount=${nextRound.offerCount}, surgeHint=${nextRound.surgeMultiplierHint.toFixed(2)}, ` +
      `delayMs=${delayMs})`,
    );
  }

  private async handleRideNoDriverFound(payload: RideEventPayload): Promise<void> {
    logger.info(`Processing ride.no_driver_found for ride ${payload.rideId}`);

    this.socketServer.emitToCustomer(payload.customerId, 'RIDE_MATCHING_FAILED', {
      rideId: payload.rideId,
      status: 'CANCELLED',
      message: 'Không tìm thấy tài xế phù hợp. Cuốc xe đã được hủy tự động.',
    });
  }

  /**
   * Build scored DriverCandidate list from Raw Redis geo results.
   * Enriches each candidate with stats (idle time, acceptance/cancel rates)
   * stored in driver:stats:{driverId} Redis hash.
   */
  private async buildCandidates(
    location: { lat: number; lng: number },
    radiusMeters: number,
    excludeDriverIds: string[] = [],
  ): Promise<DriverCandidate[]> {
    const geoResults = await this.redis.georadius(
      DRIVER_GEO_KEY,
      location.lng,
      location.lat,
      radiusMeters,
      'm',
      'WITHDIST',
      'ASC',
    ).catch(() => [] as any[]);

    if (!geoResults || geoResults.length === 0) return [];

    const excluded = new Set(excludeDriverIds);
    const candidates: DriverCandidate[] = [];

    for (const entry of geoResults) {
      const driverId = Array.isArray(entry) ? String(entry[0]) : String(entry);
      const distanceKm = Array.isArray(entry) ? parseFloat(entry[1]) / 1000 : 0;

      if (excluded.has(driverId)) continue;

      const driver = await driverGrpcClient.getDriverById(driverId).catch(() => null);
      if (!driver?.userId) continue;
      // Check in-memory first (fast), fall back to Redis presence for reconnecting sockets
      const online = this.socketServer.isUserOnline(driver.userId)
        || await this.socketServer.isUserOnlineRedis(driver.userId);
      if (!online) continue;

      // Cache userId
      this.driverUserCache.set(driverId, driver.userId);

      // Fetch stats from Redis hash
      const statsRaw = await this.redis.hgetall(driverStatsKey(driverId)).catch(() => null);
      const stats: DriverStats | null = statsRaw && Object.keys(statsRaw).length > 0
        ? {
            lastTripEndAt: parseInt(statsRaw.lastTripEndAt || '0', 10),
            totalAccepted: parseInt(statsRaw.totalAccepted || '0', 10),
            totalDeclined: parseInt(statsRaw.totalDeclined || '0', 10),
            totalCancelled: parseInt(statsRaw.totalCancelled || '0', 10),
          }
        : null;

      candidates.push(
        buildCandidate(
          driverId,
          driver.userId,
          driver.lastLocationLat ?? location.lat,
          driver.lastLocationLng ?? location.lng,
          distanceKm,
          driver.vehicleType ?? 'CAR',
          driver.ratingAverage ?? 5.0,
          stats,
        ),
      );
    }

    return candidates;
  }

  private async handleRideOffered(payload: RideOfferedPayload): Promise<void> {
    logger.info(`Processing ride.offered for ride ${payload.rideId}`);

    const driverUserId = await this.resolveDriverUserId(payload.driverId);
    if (!driverUserId) {
      logger.warn(`Unable to resolve realtime recipient for driver ${payload.driverId}`);
      return;
    }

    this.socketServer.emitToDriver(driverUserId, 'NEW_RIDE_AVAILABLE', {
      rideId: payload.rideId,
      customerId: payload.customerId,
      pickup: payload.pickup,
      dropoff: payload.dropoff,
      estimatedFare: payload.fare,
      distance: payload.distance,
      duration: payload.duration,
      timeoutSeconds: payload.ttlSeconds ?? DEFAULT_OFFER_TIMEOUT_SECONDS,
      expiresAt: payload.expiresAt,
    });
  }

  private async handleRideAssigned(payload: RideEventPayload): Promise<void> {
    logger.info(`Processing ride.assigned for ride ${payload.rideId}`);

    const data = {
      rideId: payload.rideId,
      status: 'ASSIGNED',
      driverId: payload.driverId,
      message: 'A driver has been assigned to your ride',
    };

    this.socketServer.emitToCustomer(payload.customerId, 'RIDE_STATUS_UPDATE', data);

    // Emit legacy ride:assigned event with driver profile for the tracking page
    if (payload.driverId) {
      const rawDriver = await driverGrpcClient.getDriverFullProfile(payload.driverId);
      if (rawDriver) {
        const driverProfile = {
          id: rawDriver.id,
          firstName: '',
          lastName: '',
          vehicleMake: rawDriver.vehicleBrand || '',
          vehicleModel: rawDriver.vehicleModel || '',
          vehicleColor: rawDriver.vehicleColor || '',
          licensePlate: rawDriver.vehiclePlate || '',
          rating: rawDriver.ratingAverage ?? 5,
          totalRides: rawDriver.ratingCount ?? 0,
        };
        this.socketServer.emitToCustomer(payload.customerId, 'ride:assigned', {
          ride: { id: payload.rideId, status: 'ASSIGNED', driverId: payload.driverId },
          driver: driverProfile,
        });
      }
    }

    const driverUserId = await this.resolveDriverUserId(payload.driverId);
    if (driverUserId) {
      this.socketServer.emitToDriver(driverUserId, 'ride:status', {
        rideId: payload.rideId,
        status: 'ASSIGNED',
      });
    }
  }

  private async handleRideOfferTimeout(payload: RideEventPayload & { timedOutDriverId?: string }): Promise<void> {
    logger.info(`Processing ride.offer_timeout for ride ${payload.rideId}`);

    if (payload.timedOutDriverId) {
      const driverUserId = await this.resolveDriverUserId(payload.timedOutDriverId);
      if (driverUserId) {
        this.socketServer.emitToDriver(driverUserId, 'ride:timeout', {
          rideId: payload.rideId,
        });
      }
      // Count timeout as a declined offer for scoring purposes
      this.redis.hincrby(driverStatsKey(payload.timedOutDriverId), 'totalDeclined', 1).catch(() => {});
    }

    this.socketServer.emitToCustomer(payload.customerId, 'RIDE_STATUS_UPDATE', {
      rideId: payload.rideId,
      status: 'FINDING_DRIVER',
      message: 'Looking for another driver',
    });
  }

  private async handleRideAccepted(payload: RideEventPayload): Promise<void> {
    logger.info(`Processing ride.accepted for ride ${payload.rideId}`);

    const data = {
      rideId: payload.rideId,
      status: 'ACCEPTED',
      driverId: payload.driverId,
      message: 'Driver has accepted your ride',
    };

    // Notify customer
    this.socketServer.emitToCustomer(payload.customerId, 'RIDE_STATUS_UPDATE', data);

    // Emit legacy ride:assigned event with driver profile so the tracking page can show driver card
    if (payload.driverId) {
      const rawDriver = await driverGrpcClient.getDriverFullProfile(payload.driverId);
      if (rawDriver) {
        const driverProfile = {
          id: rawDriver.id,
          firstName: '',
          lastName: '',
          vehicleMake: rawDriver.vehicleBrand || '',
          vehicleModel: rawDriver.vehicleModel || '',
          vehicleColor: rawDriver.vehicleColor || '',
          licensePlate: rawDriver.vehiclePlate || '',
          rating: rawDriver.ratingAverage ?? 5,
          totalRides: rawDriver.ratingCount ?? 0,
        };
        this.socketServer.emitToCustomer(payload.customerId, 'ride:assigned', {
          ride: { id: payload.rideId, status: 'ACCEPTED', driverId: payload.driverId },
          driver: driverProfile,
        });
      }
    }

    const driverUserId = await this.resolveDriverUserId(payload.driverId);
    if (driverUserId) {
      this.socketServer.emitToDriver(driverUserId, 'ride:status', {
        rideId: payload.rideId,
        status: 'ACCEPTED',
      });
    }

    // Track acceptance for scoring
    if (payload.driverId) {
      this.redis.hincrby(driverStatsKey(payload.driverId), 'totalAccepted', 1).catch(() => {});
    }
  }

  private async handleRideStarted(payload: RideEventPayload): Promise<void> {
    logger.info(`Processing ride.started for ride ${payload.rideId}`);

    const data = {
      rideId: payload.rideId,
      status: 'IN_PROGRESS',
      message: 'Your ride has started',
    };

    this.socketServer.emitToCustomer(payload.customerId, 'RIDE_STATUS_UPDATE', data);

    const driverUserId = await this.resolveDriverUserId(payload.driverId);
    if (driverUserId) {
      this.socketServer.emitToDriver(driverUserId, 'ride:status', {
        rideId: payload.rideId,
        status: 'IN_PROGRESS',
      });
    }
  }

  private async handleRidePickingUp(payload: RideEventPayload): Promise<void> {
    logger.info(`Processing ride.picking_up for ride ${payload.rideId}`);

    const data = {
      rideId: payload.rideId,
      status: 'PICKING_UP',
      driverId: payload.driverId,
      message: 'Driver has arrived and is picking you up',
    };

    this.socketServer.emitToCustomer(payload.customerId, 'RIDE_STATUS_UPDATE', data);

    const driverUserId = await this.resolveDriverUserId(payload.driverId);
    if (driverUserId) {
      this.socketServer.emitToDriver(driverUserId, 'ride:status', {
        rideId: payload.rideId,
        status: 'PICKING_UP',
      });
    }
  }

  private async handleRideCompleted(payload: RideEventPayload): Promise<void> {
    logger.info(`Processing ride.completed for ride ${payload.rideId}`);

    const data = {
      rideId: payload.rideId,
      status: 'COMPLETED',
      fare: payload.fare,
      distance: payload.distance,
      duration: payload.duration,
      message: 'Your ride has been completed',
    };

    this.socketServer.emitToCustomer(payload.customerId, 'RIDE_COMPLETED', data);

    const driverUserId = await this.resolveDriverUserId(payload.driverId);
    if (driverUserId) {
      this.socketServer.emitToDriver(driverUserId, 'ride:status', {
        rideId: payload.rideId,
        status: 'COMPLETED',
      });
    }

    // Track idle-time start for future matching scoring
    if (payload.driverId) {
      this.redis.hset(driverStatsKey(payload.driverId), 'lastTripEndAt', String(Date.now())).catch(() => {});
    }
  }

  private async handleRideCancelled(payload: RideEventPayload): Promise<void> {
    logger.info(`Processing ride.cancelled for ride ${payload.rideId}`);

    const data = {
      rideId: payload.rideId,
      status: 'CANCELLED',
      message: 'Ride has been cancelled',
    };

    // Notify customer
    this.socketServer.emitToCustomer(payload.customerId, 'RIDE_STATUS_UPDATE', data);

    const driverUserId = await this.resolveDriverUserId(payload.driverId);
    if (driverUserId) {
      this.socketServer.emitToDriver(driverUserId, 'ride:cancelled', {
        rideId: payload.rideId,
        reason: payload.status,
      });
    }

    // Track driver-side cancellation (penalises cancel rate in future scoring)
    if (payload.driverId) {
      this.redis.hincrby(driverStatsKey(payload.driverId), 'totalCancelled', 1).catch(() => {});
    }
  }

  /**
   * Find nearby online drivers using Redis geospatial queries
   * Assumes driver locations are stored in Redis with GEOADD
   */
  /** @deprecated Use buildCandidates + matcher.match() instead */
  private async findNearbyOnlineDrivers(
    location: { lat: number; lng: number },
    radiusMeters: number,
    excludeDriverIds: string[] = [],
    requestedVehicleType?: string,
  ): Promise<DriverRecipient[]> {
    const candidates = await this.buildCandidates(location, radiusMeters, excludeDriverIds);
    return candidates
      .filter((c) => !requestedVehicleType || isCompatibleDriverVehicleType(c.vehicleType, requestedVehicleType))
      .map((c) => ({ driverId: c.driverId, userId: c.userId }));
  }

  private getMatchRadiusMeters(searchRadiusKm?: number): number {
    if (!searchRadiusKm || searchRadiusKm <= 0) {
      return DEFAULT_MATCH_RADIUS_METERS;
    }

    return Math.round(searchRadiusKm * 1000);
  }

  private async resolveDriverUserId(driverId?: string): Promise<string | null> {
    if (!driverId) {
      return null;
    }

    const cachedUserId = this.driverUserCache.get(driverId);
    if (cachedUserId) {
      return cachedUserId;
    }

    try {
      const driver = await driverGrpcClient.getDriverById(driverId);
      const userId = driver?.userId;
      if (userId) {
        this.driverUserCache.set(driverId, userId);
        return userId;
      }
    } catch (error) {
      logger.warn(`Failed to resolve driver ${driverId} to socket user`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await (this.connection as any)?.close();
    await this.redis.quit();
    this.channel = null;
    this.connection = null;
    logger.info('EventConsumer closed');
  }
}
