export const LICENSE_CLASS_2026_VALUES = [
  'A1',
  'A',
  'B',
  'C1',
  'C',
  'D1',
  'D2',
  'D',
  'BE',
  'C1E',
  'CE',
  'D1E',
  'D2E',
  'DE',
] as const;

export type LicenseClass2026 = typeof LICENSE_CLASS_2026_VALUES[number];

const LICENSE_CLASS_2026_SET = new Set<string>(LICENSE_CLASS_2026_VALUES);

const LEGACY_TO_2026_MAP: Record<string, LicenseClass2026> = {
  A1: 'A1',
  A2: 'A',
  B1: 'B',
  B2: 'B',
  C: 'C',
  D: 'D2',
  E: 'D',
  FC: 'CE',
};

const CAR_CAB_LICENSE_CLASSES = new Set<LicenseClass2026>([
  'B',
  'C1',
  'C',
  'D1',
  'D2',
  'D',
  'BE',
  'C1E',
  'CE',
  'D1E',
  'D2E',
  'DE',
]);

const BIKE_LICENSE_CLASSES = new Set<LicenseClass2026>(['A1', 'A']);

const normalizeRaw = (value: unknown) => String(value || '').trim().toUpperCase();

export const normalizeLicenseClass = (value: unknown): LicenseClass2026 | null => {
  const normalized = normalizeRaw(value);
  if (!normalized) {
    return null;
  }

  if (LICENSE_CLASS_2026_SET.has(normalized)) {
    return normalized as LicenseClass2026;
  }

  return LEGACY_TO_2026_MAP[normalized] || null;
};

export const isSupportedLicenseClassInput = (value: unknown) => normalizeLicenseClass(value) !== null;

export const isLicenseClassCompatible = (vehicleType: string, licenseClassInput: unknown) => {
  const normalized = normalizeLicenseClass(licenseClassInput);
  if (!normalized) {
    return false;
  }

  if (vehicleType === 'CAR_4' || vehicleType === 'CAR_7') {
    return CAR_CAB_LICENSE_CLASSES.has(normalized);
  }

  if (vehicleType === 'MOTORBIKE' || vehicleType === 'SCOOTER') {
    return BIKE_LICENSE_CLASSES.has(normalized);
  }

  return true;
};
