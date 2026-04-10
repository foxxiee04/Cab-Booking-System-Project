# Location Resolution Architecture (Vietnam 2026, OSM-only)

## 1) Why a dedicated module (not separate microservice yet)

For current traffic target (100k requests/day), a dedicated module inside `api-gateway` is enough if you enforce:

- Grid cache in Redis (high hit rate)
- Snap + reverse only on cache miss
- Provider rate limiting (Nominatim protection)
- Fast fallback strategy

You only need a standalone service when:

- Location QPS becomes isolated hot path across many channels
- Team ownership split requires independent deployment lifecycle
- You need dedicated autoscaling and separate SLO/alerting domain

## 2) Runtime pipeline (`GET /api/location/resolve-location`)

1. Validate `lat,lng`.
2. Build grid cache key (rounded coordinates).
3. Return from local memory cache (hot 1-minute cache) if found.
4. Return from Redis if found.
5. Optional `snapToRoad` using OSRM `/nearest`.
6. Consume Redis quota counter for Nominatim (per-minute).
7. Reverse geocode from primary Nominatim (self-host).
8. On failure, try `NOMINATIM_FALLBACK_URL`.
9. Normalize to Vietnam 2026 shape:

- `suburb/quarter/village/neighbourhood -> ward`
- `city/state/town/municipality -> province`
- Drop `county`
- Build `display_address = street + ward + province`

10. Fuzzy match `province_id` + `ward_id` from internal dictionary.
11. Save Redis cache + return response.

## 3) API output contract

```json
{
  "lat": 10.77689,
  "lng": 106.70095,
  "street": "Lê Lợi",
  "ward": "Phường Bến Thành",
  "province": "TP. HCM",
  "ward_id": 1001,
  "province_id": 1,
  "display_address": "Lê Lợi, Phường Bến Thành, TP. HCM",
  "osm_place_id": "123456789",
  "source": "OSM"
}
```

## 4) Scale plan for 100k requests/day (<200ms p95)

Target throughput:

- Daily: 100,000 requests/day
- Average RPS: about 1.16
- Peak factor 20x: about 23 RPS

Latency budget (cache-hit path):

- In-memory cache: < 5 ms
- Redis cache: 5-20 ms
- Serialization + app processing: 10-20 ms
- Total p95 cache-hit: < 60 ms

Cache miss path (provider call):

- OSRM nearest (self-host same LAN/VPC): 20-60 ms
- Nominatim reverse (self-host): 60-140 ms
- Normalize + mapping + write cache: 10-20 ms
- Total p95 miss: ~120-220 ms

To keep overall p95 < 200 ms:

- Raise cache hit ratio above 80%
- Keep OSRM + Nominatim on same private network
- Use grid cache key (0.001 deg by default)
- Keep provider timeout low (`LOCATION_TIMEOUT_MS=1500`)

## 5) Suggested infra (production)

- `api-gateway`: 2-4 replicas behind LB
- `redis`: single primary + replica (or managed Redis)
- `nominatim-self-host`: dedicated DB host with NVMe
- `osrm-backend`: 1-2 replicas (car profile)

## 6) Environment variables

- `NOMINATIM_URL=http://nominatim:8080`
- `NOMINATIM_FALLBACK_URL=https://nominatim.openstreetmap.org`
- `NOMINATIM_LIMIT_PER_MIN=1200`
- `LOCATION_TIMEOUT_MS=1500`
- `LOCATION_CACHE_TTL_SECONDS=86400`
- `LOCATION_CACHE_GRID_DEGREES=0.001`
- `OSRM_URL=http://osrm:5000`

## 7) Frontend debounce recommendation (Leaflet)

- Trigger on `click` and `dragend`, not on every `drag` frame.
- Debounce `300-500 ms` before calling `/api/location/resolve-location`.
- Cancel in-flight requests using `AbortController` when a new event fires.

## 8) Self-host Nominatim notes (bonus)

Pros vs Google:

- No per-request Google billing
- Full control over data + query policy
- Works with OSM + OSRM stack end-to-end

Cons vs Google:

- Import + update operations are heavy
- Global POI quality/coverage can be uneven by area
- You own reliability, scaling and operations

High-level self-host setup:

1. Provision PostgreSQL+PostGIS machine with fast SSD.
2. Import Vietnam or SEA extract (`.pbf`) into Nominatim.
3. Enable replication updates for fresh data.
4. Put Nginx in front with rate limiting + caching headers.
5. Monitor p95 latency, timeout, and error ratio.
