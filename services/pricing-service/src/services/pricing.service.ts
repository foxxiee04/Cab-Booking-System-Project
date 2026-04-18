import axios from 'axios';
import { redisClient } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { calculateDistance, estimateDuration } from '../utils/geo.utils';

type VehicleType =
  | 'MOTORBIKE'
  | 'SCOOTER'
  | 'CAR_4'
  | 'CAR_7'
  | 'ECONOMY'
  | 'COMFORT'
  | 'PREMIUM';
type CanonicalVehicleType = 'MOTORBIKE' | 'SCOOTER' | 'CAR_4' | 'CAR_7';
type AITimeOfDay = 'OFF_PEAK' | 'RUSH_HOUR';
type AIDayType = 'WEEKDAY' | 'WEEKEND';
type AIReasonCode =
  | 'AI_OK'
  | 'AI_TIMEOUT'
  | 'AI_HTTP_ERROR'
  | 'AI_INVALID_RESPONSE'
  | 'AI_LOW_CONFIDENCE'
  | 'AI_DISABLED_BY_FLAG';

interface AIPrediction {
  eta_minutes: number;
  price_multiplier: number;
  recommended_driver_radius_km?: number;
  surge_hint?: number;
  confidence_score?: number;
  reason_code?: AIReasonCode;
  model_version?: string;
  feature_version?: string;
  inference_ms?: number;
  distance_km: number;
  time_of_day: AITimeOfDay;
  day_type: AIDayType;
  insights?: {
    demand_level: 'LOW' | 'MEDIUM' | 'HIGH';
    eta_confidence: 'LOW' | 'MEDIUM' | 'HIGH';
    recommended_driver_radius_km: number;
    surge_reason: string;
  };
}

interface AIPredictionResult {
  prediction: AIPrediction | null;
  reasonCode: AIReasonCode;
  latencyMs: number;
}

interface WaitTimePrediction {
  wait_time_minutes: number;
  confidence: number;
  model_version: string;
  reason_code: string;
}

export class PricingService {
  private normalizeVehicleType(vehicleType: VehicleType): CanonicalVehicleType {
    switch (vehicleType) {
      case 'ECONOMY':
        return 'MOTORBIKE';
      case 'COMFORT':
        return 'CAR_4';
      case 'PREMIUM':
        return 'CAR_7';
      default:
        return vehicleType;
    }
  }


  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
  
  /**
   * Calculate fare estimate
   */
  async estimateFare(params: {
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    vehicleType: VehicleType;
  }) {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType } = params;
    const normalizedVehicleType = this.normalizeVehicleType(vehicleType);
    const pricingKey = Object.prototype.hasOwnProperty.call(config.pricing.baseFare, vehicleType)
      ? vehicleType
      : normalizedVehicleType;

    // Calculate distance & duration via OSRM (fallback to Haversine)
    let distance = 0;
    let duration = 0;

    try {
      const osrmUrl = `${config.osrm.baseUrl}/route/v1/driving/${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}?overview=false`;
      const response = await axios.get(osrmUrl, { timeout: 2000 });
      const route = response.data?.routes?.[0];

      if (route) {
        distance = Math.round((route.distance / 1000) * 100) / 100; // km
        duration = Math.round(route.duration); // seconds
      } else {
        throw new Error('OSRM returned no routes');
      }
    } catch (error) {
      logger.warn('OSRM unavailable, using fallback distance', error);
      distance = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
      duration = estimateDuration(distance);
    }
    const baseDurationMinutes = Math.ceil(duration / 60);

    // Get surge multiplier
    const configuredSurgeMultiplier = await this.getCurrentSurgeMultiplier();
    const aiResult = await this.getAIPrediction(distance);
    const aiPrediction = aiResult.prediction;
    const durationMinutes = aiPrediction?.eta_minutes ?? baseDurationMinutes;

    const surgeCandidate = aiPrediction
      ? (aiPrediction.surge_hint ?? aiPrediction.price_multiplier)
      : configuredSurgeMultiplier;
    const boundedSurge = this.clamp(surgeCandidate, config.ai.surgeMin, config.ai.surgeMax);
    // Final decision keeps rule-based baseline and allows bounded AI suggestion.
    const surgeMultiplier = this.clamp(
      Math.max(configuredSurgeMultiplier, boundedSurge),
      config.ai.surgeMin,
      config.ai.surgeMax,
    );

    const aiRadiusSuggestion =
      aiPrediction?.recommended_driver_radius_km
      ?? aiPrediction?.insights?.recommended_driver_radius_km
      ?? 3;
    const boundedRecommendedRadius = this.clamp(aiRadiusSuggestion, config.ai.radiusMinKm, config.ai.radiusMaxKm);

    // Calculate base components
    const baseFare = config.pricing.baseFare[pricingKey as keyof typeof config.pricing.baseFare];
    const distanceFare = distance * config.pricing.perKmRate[pricingKey as keyof typeof config.pricing.perKmRate];
    const timeFare = durationMinutes * config.pricing.perMinuteRate[pricingKey as keyof typeof config.pricing.perMinuteRate];
    const vehicleServiceFee = config.pricing.vehicleServiceFee[pricingKey as keyof typeof config.pricing.vehicleServiceFee];
    const shortTripFee = distance > 0 && distance < config.pricing.shortTripThresholdKm
      ? config.pricing.shortTripFee[pricingKey as keyof typeof config.pricing.shortTripFee]
      : 0;

    // Calculate total
    const subtotal = baseFare + vehicleServiceFee + distanceFare + timeFare + shortTripFee;
    const totalFare = Math.max(
      Math.round(subtotal * surgeMultiplier),
      config.pricing.minimumFare
    );

    logger.info('Fare calculated', {
      vehicleType,
      distance,
      duration: durationMinutes,
      surgeMultiplier,
      fare: totalFare,
    });

    // Fetch wait time prediction — fire in parallel, non-blocking on failure
    const waitResult = await this.getWaitTimePrediction({
      demandLevel: (aiPrediction?.insights?.demand_level || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH',
      surgeMultiplier,
      pickupLat,
      pickupLng,
    });

    return {
      fare: totalFare,
      distance,
      duration: durationMinutes * 60,
      durationMinutes,
      surgeMultiplier,
      estimatedWaitMinutes: waitResult.wait_time_minutes,
      aiPrediction,
      operationalHints: {
        predictionSource: aiPrediction ? 'AI' : 'RULE_ENGINE',
        reasonCode: aiResult.reasonCode,
        demandLevel: aiPrediction?.insights?.demand_level || 'LOW',
        etaConfidence: aiPrediction?.insights?.eta_confidence || 'MEDIUM',
        confidenceScore: aiPrediction?.confidence_score ?? null,
        modelVersion: aiPrediction?.model_version || null,
        featureVersion: aiPrediction?.feature_version || null,
        inferenceMs: aiPrediction?.inference_ms ?? aiResult.latencyMs,
        recommendedDriverRadiusKm: boundedRecommendedRadius,
        surgeReason: aiPrediction?.insights?.surge_reason || 'Deterministic pricing fallback is active',
      },
      breakdown: {
        baseFare,
        vehicleServiceFee,
        shortTripFee,
        distanceFare: Math.round(distanceFare),
        timeFare: Math.round(timeFare),
        subtotal: Math.round(subtotal),
        surgeAmount: Math.round(subtotal * (surgeMultiplier - 1)),
      },
    };
  }

  /**
   * Get current surge multiplier from Redis
   * If not set, return default 1.0
   */
  async getCurrentSurgeMultiplier(): Promise<number> {
    try {
      const surge = await redisClient.get('surge:multiplier');
      return surge ? parseFloat(surge) : 1.0;
    } catch (error) {
      logger.warn('Failed to get surge multiplier, using default', error);
      return 1.0;
    }
  }

  /**
   * Set surge multiplier (for admin/AI service)
   */
  async setSurgeMultiplier(multiplier: number): Promise<void> {
    if (multiplier < 1.0 || multiplier > 3.0) {
      throw new Error('Surge multiplier must be between 1.0 and 3.0');
    }

    await redisClient.set('surge:multiplier', multiplier.toString());
    await redisClient.expire('surge:multiplier', 3600); // 1 hour expiry

    logger.info('Surge multiplier updated', { multiplier });
  }

  /**
   * Get surge pricing zones from Redis
   */
  async getSurgeZones() {
    try {
      const zones = await redisClient.get('surge:zones');
      return zones ? JSON.parse(zones) : [];
    } catch (error) {
      logger.warn('Failed to get surge zones', error);
      return [];
    }
  }

  /**
   * Calculate demand-based surge pricing
   * This can be called periodically or triggered by events
   */
  async calculateDynamicSurge(params: {
    activeRides: number;
    availableDrivers: number;
    timeOfDay: number; // 0-23
    dayOfWeek: number; // 0-6
  }) {
    const { activeRides, availableDrivers, timeOfDay, dayOfWeek } = params;

    let multiplier = 1.0;

    // Demand/supply ratio
    const demandSupplyRatio = availableDrivers > 0 
      ? activeRides / availableDrivers 
      : 5;

    if (demandSupplyRatio > 3) {
      multiplier = config.pricing.surgeThresholds.peak;
    } else if (demandSupplyRatio > 2) {
      multiplier = config.pricing.surgeThresholds.high;
    } else if (demandSupplyRatio > 1) {
      multiplier = config.pricing.surgeThresholds.medium;
    }

    // Peak hours adjustment (7-9 AM, 5-8 PM)
    const isPeakHour = 
      (timeOfDay >= 7 && timeOfDay <= 9) || 
      (timeOfDay >= 17 && timeOfDay <= 20);
    
    if (isPeakHour) {
      multiplier = Math.min(multiplier * 1.2, 3.0);
    }

    // Weekend adjustment
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (isWeekend && timeOfDay >= 20) {
      multiplier = Math.min(multiplier * 1.15, 3.0);
    }

    // Cap at 3.0
    multiplier = Math.min(multiplier, 3.0);
    multiplier = Math.round(multiplier * 10) / 10;

    await this.setSurgeMultiplier(multiplier);

    return { multiplier, demandSupplyRatio };
  }

  private async getWaitTimePrediction(params: {
    demandLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    surgeMultiplier: number;
    pickupLat: number;
    pickupLng: number;
  }): Promise<WaitTimePrediction> {
    const fallback: WaitTimePrediction = {
      wait_time_minutes: 4.0,
      confidence: 0.4,
      model_version: 'heuristic-v1',
      reason_code: 'AI_FALLBACK',
    };
    try {
      const now = new Date();
      // Derive zone from lat/lng (central HCMC = A, inner = B, else D)
      const isZoneA =
        params.pickupLat >= 10.76 && params.pickupLat <= 10.80 &&
        params.pickupLng >= 106.69 && params.pickupLng <= 106.72;
      const isZoneB =
        params.pickupLat >= 10.70 && params.pickupLat <= 10.82 &&
        params.pickupLng >= 106.65 && params.pickupLng <= 106.75;
      const pickupZone = isZoneA ? 'A' : isZoneB ? 'B' : 'D';

      const body = {
        demand_level: params.demandLevel,
        active_booking_count: 0,
        available_driver_count: 5,
        hour_of_day: now.getHours(),
        day_of_week: now.getDay() === 0 ? 6 : now.getDay() - 1, // Mon=0…Sun=6
        surge_multiplier: params.surgeMultiplier,
        avg_accept_rate: 0.75,
        historical_wait_p50: 4.0,
        pickup_zone: pickupZone,
      };

      const response = await axios.post(
        `${config.ai.baseUrl}/api/predict/wait-time`,
        body,
        { timeout: config.ai.timeoutMs },
      );
      return response.data as WaitTimePrediction;
    } catch {
      return fallback;
    }
  }

  private async getAIPrediction(distanceKm: number): Promise<AIPredictionResult> {
    const startedAt = Date.now();
    try {
      const response = await axios.post(
        `${config.ai.baseUrl}/api/predict`,
        {
          distance_km: distanceKm,
          time_of_day: this.mapTimeOfDay(new Date().getHours()),
          day_type: this.mapDayType(new Date().getDay()),
        },
        { timeout: config.ai.timeoutMs }
      );

      const payload = response.data;
      if (!payload || typeof payload.eta_minutes !== 'number' || typeof payload.price_multiplier !== 'number') {
        return {
          prediction: null,
          reasonCode: 'AI_INVALID_RESPONSE',
          latencyMs: Date.now() - startedAt,
        };
      }

      return {
        prediction: payload as AIPrediction,
        reasonCode: 'AI_OK',
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      logger.warn('AI prediction unavailable, using deterministic pricing', error);
      const reasonCode: AIReasonCode =
        (error as { code?: string })?.code === 'ECONNABORTED'
          ? 'AI_TIMEOUT'
          : 'AI_HTTP_ERROR';
      return {
        prediction: null,
        reasonCode,
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  private mapTimeOfDay(hour: number): AITimeOfDay {
    const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
    return isRushHour ? 'RUSH_HOUR' : 'OFF_PEAK';
  }

  private mapDayType(dayOfWeek: number): AIDayType {
    return dayOfWeek === 0 || dayOfWeek === 6 ? 'WEEKEND' : 'WEEKDAY';
  }
}
