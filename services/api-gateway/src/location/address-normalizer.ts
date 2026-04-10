export interface OSMAddressLike {
  road?: string;
  pedestrian?: string;
  footway?: string;
  house_number?: string;
  suburb?: string;
  quarter?: string;
  neighbourhood?: string;
  village?: string;
  city?: string;
  state?: string;
  province?: string;
  county?: string;
  city_district?: string;
  district?: string;
  state_district?: string;
  county_code?: string;
  'ISO3166-2-lvl4'?: string;
  town?: string;
  municipality?: string;
}

const THU_DUC_LABEL = 'Thành phố Thủ Đức';

function titleCase(input: string): string {
  return input
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRoadKey(raw: string): string {
  return normalizeText(raw)
    .replace(/^duong\s+/i, '')
    .replace(/^pho\s+/i, '')
    .trim();
}

export function normalizeProvinceName(raw: string): string {
  const value = raw.trim();
  const normalized = normalizeText(value);

  if (!value) {
    return '';
  }

  if (normalized.includes('ho chi minh') || normalized.includes('tp hcm') || normalized.includes('thu duc')) {
    return 'TP. HCM';
  }

  if (/^thanh pho\s+/i.test(value)) {
    return value.replace(/^thanh pho\s+/i, 'TP. ').trim();
  }

  if (/^tp\.?\s*/i.test(value)) {
    return value.replace(/^tp\.?\s*/i, 'TP. ').trim();
  }

  if (/^tinh\s+/i.test(value)) {
    return titleCase(value.replace(/^tinh\s+/i, '').trim());
  }

  return value;
}

export function normalizeWardName(raw: string, sourceType: 'suburb' | 'quarter' | 'village' | 'neighbourhood' | 'unknown'): string {
  const cleaned = raw.trim();
  if (!cleaned) {
    return '';
  }

  if (/^(phường|xa|xã)\b/i.test(cleaned)) {
    return cleaned;
  }

  if (/^(ward|suburb|quarter)\b/i.test(cleaned) || sourceType === 'suburb' || sourceType === 'quarter' || sourceType === 'neighbourhood') {
    return `Phường ${cleaned.replace(/^(ward|suburb|quarter)\s*/i, '').trim()}`.trim();
  }

  if (/^village\b/i.test(cleaned) || sourceType === 'village') {
    return `Xã ${cleaned.replace(/^village\s*/i, '').trim()}`.trim();
  }

  return cleaned;
}

export function normalizeStreetName(road?: string, houseNumber?: string): string {
  if (!road) {
    return '';
  }
  return houseNumber ? `${houseNumber} ${road}`.trim() : road.trim();
}

export function isHcmContextFromAddress(address: OSMAddressLike): boolean {
  const city = normalizeText(address.city || address.town || address.municipality || '');
  const state = normalizeText(address.state || address.province || '');
  const county = normalizeText(address.county || '');
  const stateDistrict = normalizeText(address.state_district || '');
  const isoLevel4 = normalizeText(address['ISO3166-2-lvl4'] || '');

  const containsHcm = city.includes('ho chi minh')
    || state.includes('ho chi minh')
    || county.includes('ho chi minh')
    || stateDistrict.includes('ho chi minh')
    || isoLevel4 === 'vn-sg';

  const containsThuDuc = city.includes('thu duc')
    || state.includes('thu duc')
    || county.includes('thu duc')
    || stateDistrict.includes('thu duc');

  return containsHcm || containsThuDuc;
}

function hasExplicitNonThuDucDistrictSignal(address: OSMAddressLike): boolean {
  const districtSignals = [address.city_district, address.district, address.state_district, address.county, address.neighbourhood]
    .map((value) => normalizeText(value || ''))
    .filter(Boolean);

  if (!districtSignals.length) {
    return false;
  }

  return districtSignals.some((signal) => signal.includes('quan ') || signal.includes('huyen ') || signal.includes('go vap') || signal.includes('tan binh') || signal.includes('binh thanh') || signal.includes('phu nhuan') || signal.includes('tan phu') || signal.includes('quan 1') || signal.includes('quan 3') || signal.includes('quan 4') || signal.includes('quan 5') || signal.includes('quan 6') || signal.includes('quan 7') || signal.includes('quan 8') || signal.includes('quan 10') || signal.includes('quan 11') || signal.includes('quan 12'))
    && !districtSignals.some((signal) => signal.includes('thu duc'));
}

export function resolveHcmSubCity(address: OSMAddressLike): string {
  const districtSignals = [address.city_district, address.district, address.state_district, address.county, address.neighbourhood]
    .map((value) => normalizeText(value || ''))
    .filter(Boolean);

  if (districtSignals.some((signal) => signal.includes('thu duc'))) {
    return THU_DUC_LABEL;
  }

  if (hasExplicitNonThuDucDistrictSignal(address)) {
    return '';
  }

  const cityRaw = normalizeText(address.city || address.town || address.municipality || '');
  if (cityRaw.includes('thu duc')) {
    return THU_DUC_LABEL;
  }

  return '';
}

function wardOverrideForKnownHotspots(params: {
  ward: string;
  cityRaw: string;
  road: string;
  houseNumber?: string;
  neighborhood?: string;
}): string {
  const wardKey = normalizeText(params.ward);
  const cityKey = normalizeText(params.cityRaw);
  const roadKey = normalizeRoadKey(params.road || '');
  const neighborhoodKey = normalizeText(params.neighborhood || '');

  // Temporary correction for OSM labeling drift at 366 Vo Van Ngan.
  if (
    cityKey.includes('thu duc')
    && wardKey.includes('phuong thu duc')
    && roadKey.includes('vo van ngan')
    && (params.houseNumber === '366' || neighborhoodKey.includes('khu pho 2'))
  ) {
    return 'Phường Bình Thọ';
  }

  // OSM currently drifts around IUH (Gò Vấp) with "Phường An Nhơn" labels.
  if (
    wardKey.includes('phuong an nhon')
    && neighborhoodKey.includes('go vap')
    && (roadKey.includes('nguyen van bao') || roadKey.includes('nguyen van nghi'))
  ) {
    return 'Phường Hạnh Thông';
  }

  return params.ward;
}

export function formatAddressFromOSM(address: OSMAddressLike, fallback: string, poiName?: string): string {
  const street = normalizeStreetName(
    address.road || address.pedestrian || address.footway || '',
    address.house_number,
  );

  const wardRaw = address.suburb || address.quarter || address.neighbourhood || address.village || '';
  const wardSourceType: 'suburb' | 'quarter' | 'village' | 'neighbourhood' | 'unknown' =
    address.suburb
      ? 'suburb'
      : address.quarter
        ? 'quarter'
        : address.village
          ? 'village'
          : address.neighbourhood
            ? 'neighbourhood'
            : 'unknown';

  const cityRaw = address.city || address.town || address.municipality || '';
  const provinceRaw = address.state || address.province || cityRaw;

  const normalizedWard = normalizeWardName(wardRaw, wardSourceType);
  const ward = wardOverrideForKnownHotspots({
    ward: normalizedWard,
    cityRaw,
    road: address.road || '',
    houseNumber: address.house_number,
    neighborhood: address.neighbourhood,
  });

  const province = isHcmContextFromAddress(address)
    ? 'TP. HCM'
    : normalizeProvinceName(provinceRaw || cityRaw);

  const subCity = resolveHcmSubCity(address);
  const firstPart = poiName && poiName !== (address.road || '') ? poiName : street;

  const parts = [firstPart, ward, subCity, province].filter(Boolean);
  const deduped: string[] = [];
  for (const part of parts) {
    const key = normalizeText(part);
    if (!deduped.some((existing) => normalizeText(existing) === key)) {
      deduped.push(part);
    }
  }

  return deduped.length ? deduped.join(', ') : fallback;
}

export function normalizeAddressText(input: string): string {
  let value = input.trim();
  if (!value) {
    return value;
  }

  const normalized = normalizeText(value);
  if (normalized.includes('ho chi minh') || normalized.includes('tp hcm')) {
    value = value.replace(/\b(thanh pho|tp\.?|tinh)\s*ho\s*chi\s*minh\b/gi, 'TP. HCM');
  }

  // Keep Thu Duc as sub-city, never as province tail.
  value = value.replace(/\bthanh pho\s+thu\s+duc\b/gi, 'Thành phố Thủ Đức');

  // Collapse repetitive commas/spaces.
  value = value.replace(/\s*,\s*/g, ', ').replace(/,+/g, ',').replace(/\s{2,}/g, ' ').trim();

  // If ending with only Thu Duc (without HCM), append HCM context.
  if (/thanh pho thu duc$/i.test(normalizeText(value))) {
    value = `${value}, TP. HCM`;
  }

  return value;
}

export function normalizeAddressPayloadDeep(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeAddressPayloadDeep(item));
  }

  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const source = payload as Record<string, unknown>;
  const next: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string' && /(address|pickupAddress|dropoffAddress)$/i.test(key)) {
      next[key] = normalizeAddressText(value);
      continue;
    }

    next[key] = normalizeAddressPayloadDeep(value);
  }

  return next;
}
