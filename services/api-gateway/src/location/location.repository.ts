import Redis from 'ioredis';
import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ProvinceRecord, ResolvedLocation, WardRecord } from './types';

const DEFAULT_CACHE_TTL_SECONDS = Number(process.env.LOCATION_CACHE_TTL_SECONDS || 86400);
const GRID_SIZE = Number(process.env.LOCATION_CACHE_GRID_DEGREES || 0.001);

function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function buildProvinceKey(name: string): string {
  return normalizeText(name)
    .replace(/^thanh pho\s+/i, '')
    .replace(/^tp\.?\s*/i, '')
    .replace(/^tinh\s+/i, '');
}

function buildWardKey(name: string): string {
  return normalizeText(name)
    .replace(/^phuong\s+/i, '')
    .replace(/^xa\s+/i, '')
    .replace(/^thi tran\s+/i, '');
}

function roundGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

const FALLBACK_PROVINCES: Array<{ id: number; name: string }> = [
  { id: 1, name: 'TP. HCM' },
  { id: 2, name: 'Hà Nội' },
  { id: 3, name: 'Đà Nẵng' },
  { id: 4, name: 'Cần Thơ' },
  { id: 5, name: 'Hải Phòng' },
  { id: 6, name: 'Bình Dương' },
  { id: 7, name: 'Đồng Nai' },
  { id: 8, name: 'Khánh Hòa' },
  { id: 9, name: 'Bà Rịa - Vũng Tàu' },
  { id: 10, name: 'Lâm Đồng' },
];

const FALLBACK_WARDS: Array<{ id: number; name: string; provinceId: number }> = [
  { id: 1001, name: 'Phường Bến Thành', provinceId: 1 },
  { id: 1002, name: 'Phường Tân Sơn Hòa', provinceId: 1 },
  { id: 1003, name: 'Phường Gò Vấp', provinceId: 1 },
  { id: 1004, name: 'Phường Tân Định', provinceId: 1 },
  { id: 1005, name: 'Phường Sài Gòn', provinceId: 1 },
  { id: 2001, name: 'Phường Hoàn Kiếm', provinceId: 2 },
  { id: 2002, name: 'Phường Ba Đình', provinceId: 2 },
  { id: 3001, name: 'Phường Hải Châu', provinceId: 3 },
];

interface LocalCacheValue {
  data: ResolvedLocation;
  expiresAt: number;
}

export class LocationRepository {
  private redis: Redis | null = null;

  private pgPool: Pool | null = null;

  private localCache = new Map<string, LocalCacheValue>();

  private provinces: ProvinceRecord[];

  private wards: WardRecord[];

  private adminLoadedAt = 0;

  private adminLoadInFlight: Promise<void> | null = null;

  constructor() {
    this.provinces = FALLBACK_PROVINCES.map((item) => ({
      id: item.id,
      name: item.name,
      normalizedKey: buildProvinceKey(item.name),
    }));

    this.wards = FALLBACK_WARDS.map((item) => ({
      id: item.id,
      provinceId: item.provinceId,
      name: item.name,
      normalizedKey: buildWardKey(item.name),
    }));
  }

  private getPgPool(): Pool | null {
    if (!config.location.databaseUrl) {
      return null;
    }

    if (!this.pgPool) {
      this.pgPool = new Pool({
        connectionString: config.location.databaseUrl,
        max: 5,
        idleTimeoutMillis: 10_000,
      });

      this.pgPool.on('error', (error) => {
        logger.warn('Location catalog DB pool error', { message: error.message });
      });
    }

    return this.pgPool;
  }

  private async refreshAdminCatalogIfNeeded(): Promise<void> {
    const now = Date.now();
    const stillFresh = now - this.adminLoadedAt < config.location.adminCatalogRefreshMs;
    if (stillFresh) {
      return;
    }

    if (this.adminLoadInFlight) {
      await this.adminLoadInFlight;
      return;
    }

    this.adminLoadInFlight = (async () => {
      const pool = this.getPgPool();
      if (!pool) {
        this.adminLoadedAt = Date.now();
        return;
      }

      try {
        const [provinceResult, wardResult] = await Promise.all([
          pool.query('SELECT id, name, normalized_key FROM provinces'),
          pool.query('SELECT id, province_id, name, normalized_key FROM wards'),
        ]);

        if (provinceResult.rowCount && wardResult.rowCount) {
          this.provinces = provinceResult.rows.map((row) => ({
            id: Number(row.id),
            name: String(row.name),
            normalizedKey: String(row.normalized_key || buildProvinceKey(String(row.name))),
          }));

          this.wards = wardResult.rows.map((row) => ({
            id: Number(row.id),
            provinceId: Number(row.province_id),
            name: String(row.name),
            normalizedKey: String(row.normalized_key || buildWardKey(String(row.name))),
          }));
        }

        this.adminLoadedAt = Date.now();
      } catch (error) {
        logger.warn('Failed loading provinces/wards from DB, fallback to bundled sample catalog', {
          error: (error as Error).message,
        });
        this.adminLoadedAt = Date.now();
      }
    })();

    try {
      await this.adminLoadInFlight;
    } finally {
      this.adminLoadInFlight = null;
    }
  }

  private getRedis(): Redis {
    if (!this.redis) {
      this.redis = new Redis(config.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
      this.redis.on('error', (error) => {
        logger.warn('Location Redis error', { message: error.message });
      });
    }

    return this.redis;
  }

  public async close(): Promise<void> {
    if (!this.redis) {
      return;
    }
    const client = this.redis;
    this.redis = null;
    await client.quit();

    if (this.pgPool) {
      const pool = this.pgPool;
      this.pgPool = null;
      await pool.end();
    }
  }

  public buildGridKey(lat: number, lng: number, snapToRoad = true): string {
    const gridLat = roundGrid(lat).toFixed(3);
    const gridLng = roundGrid(lng).toFixed(3);
    const mode = snapToRoad ? 'snap' : 'raw';
    return `loc:resolve:v2:${mode}:${gridLat}:${gridLng}`;
  }

  public async getCachedLocation(cacheKey: string): Promise<ResolvedLocation | null> {
    const localHit = this.localCache.get(cacheKey);
    if (localHit && localHit.expiresAt > Date.now()) {
      return localHit.data;
    }

    this.localCache.delete(cacheKey);

    try {
      const redisClient = this.getRedis();
      const raw = await redisClient.get(cacheKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as ResolvedLocation;
      this.localCache.set(cacheKey, {
        data: parsed,
        expiresAt: Date.now() + 60_000,
      });
      return parsed;
    } catch (error) {
      logger.warn('Location cache read failed', { error: (error as Error).message });
      return null;
    }
  }

  public async setCachedLocation(cacheKey: string, location: ResolvedLocation): Promise<void> {
    this.localCache.set(cacheKey, {
      data: location,
      expiresAt: Date.now() + 60_000,
    });

    try {
      const redisClient = this.getRedis();
      await redisClient.setex(cacheKey, DEFAULT_CACHE_TTL_SECONDS, JSON.stringify(location));
    } catch (error) {
      logger.warn('Location cache write failed', { error: (error as Error).message });
    }
  }

  public async matchProvinceId(provinceName: string): Promise<number | null> {
    await this.refreshAdminCatalogIfNeeded();
    const key = buildProvinceKey(provinceName);
    const exact = this.provinces.find((item) => item.normalizedKey === key);
    if (exact) {
      return exact.id;
    }

    const fuzzy = this.provinces.find((item) => key.includes(item.normalizedKey) || item.normalizedKey.includes(key));
    return fuzzy?.id || null;
  }

  public async matchWardId(wardName: string, provinceId: number | null): Promise<number | null> {
    await this.refreshAdminCatalogIfNeeded();
    const key = buildWardKey(wardName);
    const byProvince = provinceId
      ? this.wards.filter((item) => item.provinceId === provinceId)
      : this.wards;

    const exact = byProvince.find((item) => item.normalizedKey === key);
    if (exact) {
      return exact.id;
    }

    const fuzzy = byProvince.find((item) => key.includes(item.normalizedKey) || item.normalizedKey.includes(key));
    return fuzzy?.id || null;
  }

  public async consumeNominatimQuota(limitPerMinute: number): Promise<boolean> {
    const bucket = Math.floor(Date.now() / 60_000);
    const key = `loc:nominatim:quota:${bucket}`;

    try {
      const redisClient = this.getRedis();
      const current = await redisClient.incr(key);
      if (current === 1) {
        await redisClient.expire(key, 120);
      }
      return current <= limitPerMinute;
    } catch (error) {
      logger.warn('Nominatim quota counter failed, continue fail-open', {
        error: (error as Error).message,
      });
      return true;
    }
  }
}

export const locationRepository = new LocationRepository();
