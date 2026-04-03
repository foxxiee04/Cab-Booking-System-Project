import axios from 'axios';
import { redisClient } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { calculateDistance, estimateDuration } from '../utils/geo.utils';

type VehicleType = 'MOTORBIKE' | 'SCOOTER' | 'CAR_4' | 'CAR_7';
type AITimeOfDay = 'OFF_PEAK' | 'RUSH_HOUR';
type AIDayType = 'WEEKDAY' | 'WEEKEND';

interface AIPrediction {
  eta_minutes: number;
  price_multiplier: number;
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

export class PricingService {
  
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
    const aiPrediction = await this.getAIPrediction(distance);
    const durationMinutes = aiPrediction?.eta_minutes ?? baseDurationMinutes;
    const surgeMultiplier = aiPrediction
      ? Math.max(configuredSurgeMultiplier, aiPrediction.price_multiplier)
      : configuredSurgeMultiplier;

    // Calculate base components
    const baseFare = config.pricing.baseFare[vehicleType];
    const distanceFare = distance * config.pricing.perKmRate[vehicleType];
    const timeFare = durationMinutes * config.pricing.perMinuteRate[vehicleType];

    // Calculate total
    const subtotal = baseFare + distanceFare + timeFare;
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

    return {
      fare: totalFare,
      distance,
      duration: durationMinutes * 60,
      durationMinutes,
      surgeMultiplier,
      aiPrediction,
      operationalHints: {
        predictionSource: aiPrediction ? 'AI' : 'RULE_ENGINE',
        demandLevel: aiPrediction?.insights?.demand_level || 'LOW',
        etaConfidence: aiPrediction?.insights?.eta_confidence || 'MEDIUM',
        recommendedDriverRadiusKm: aiPrediction?.insights?.recommended_driver_radius_km || 3,
        surgeReason: aiPrediction?.insights?.surge_reason || 'Deterministic pricing fallback is active',
      },
      breakdown: {
        baseFare,
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

  private async getAIPrediction(distanceKm: number): Promise<AIPrediction | null> {
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
        return null;
      }

      return payload as AIPrediction;
    } catch (error) {
      logger.warn('AI prediction unavailable, using deterministic pricing', error);
      return null;
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
