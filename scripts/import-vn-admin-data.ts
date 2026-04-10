import { Client } from 'pg';

type ProvinceApiWard = {
  code: number;
  name: string;
};

type ProvinceApiDistrict = {
  code: number;
  name: string;
  wards?: ProvinceApiWard[];
};

type ProvinceApiProvince = {
  code: number;
  name: string;
  districts?: ProvinceApiDistrict[];
  wards?: ProvinceApiWard[];
};

const SOURCE_URL = process.env.VN_ADMIN_SOURCE_URL || 'https://provinces.open-api.vn/api/?depth=3';
const LOCATION_DATABASE_URL =
  process.env.LOCATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5433/location_db';

function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeProvinceName(name: string): string {
  const normalized = normalizeText(name);
  if (normalized.includes('ho chi minh') || normalized.includes('thu duc')) {
    return 'TP. HCM';
  }

  if (/^Thành phố\s+/i.test(name)) {
    return name.replace(/^Thành phố\s+/i, 'TP. ').trim();
  }

  if (/^Tỉnh\s+/i.test(name)) {
    return name.replace(/^Tỉnh\s+/i, '').trim();
  }

  return name.trim();
}

function normalizeProvinceKey(name: string): string {
  return normalizeText(name)
    .replace(/^thanh pho\s+/i, '')
    .replace(/^tp\.?\s*/i, '')
    .replace(/^tinh\s+/i, '');
}

function normalizeWardName(name: string): string {
  const trimmed = name.trim();
  const normalized = normalizeText(trimmed);

  if (/^(phuong|xa|thi tran)\b/i.test(normalized)) {
    return trimmed;
  }

  if (normalized.startsWith('ward') || normalized.startsWith('suburb') || normalized.startsWith('quarter')) {
    return `Phường ${trimmed.replace(/^(Ward|Suburb|Quarter)\s*/i, '').trim()}`.trim();
  }

  if (normalized.startsWith('village')) {
    return `Xã ${trimmed.replace(/^Village\s*/i, '').trim()}`.trim();
  }

  return trimmed;
}

function normalizeWardKey(name: string): string {
  return normalizeText(name)
    .replace(/^phuong\s+/i, '')
    .replace(/^xa\s+/i, '')
    .replace(/^thi tran\s+/i, '');
}

async function fetchAdminData(): Promise<ProvinceApiProvince[]> {
  const response = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'CabBookingSystem/2.0 (admin-seed)',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch VN admin source: ${response.status}`);
  }

  const payload = (await response.json()) as ProvinceApiProvince[];
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error('VN admin source returned empty payload');
  }

  return payload;
}

async function ensureTables(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS provinces (
      id BIGSERIAL PRIMARY KEY,
      code VARCHAR(20) UNIQUE,
      name VARCHAR(255) NOT NULL,
      normalized_key VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS wards (
      id BIGSERIAL PRIMARY KEY,
      code VARCHAR(30) UNIQUE,
      province_id BIGINT NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      normalized_key VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (province_id, normalized_key)
    )
  `);
}

async function run(): Promise<void> {
  const data = await fetchAdminData();

  const client = new Client({ connectionString: LOCATION_DATABASE_URL });
  await client.connect();

  try {
    await ensureTables(client);

    await client.query('BEGIN');
    await client.query('TRUNCATE TABLE wards RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE provinces RESTART IDENTITY CASCADE');

    let provinceCount = 0;
    let wardCount = 0;

    for (const province of data) {
      const provinceName = normalizeProvinceName(province.name);
      const provinceKey = normalizeProvinceKey(provinceName);
      const provinceCode = String(province.code);

      const provinceResult = await client.query<{ id: number }>(
        `
          INSERT INTO provinces (code, name, normalized_key)
          VALUES ($1, $2, $3)
          ON CONFLICT (normalized_key)
          DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, updated_at = NOW()
          RETURNING id
        `,
        [provinceCode, provinceName, provinceKey],
      );

      const provinceId = provinceResult.rows[0]?.id;
      if (!provinceId) {
        continue;
      }

      provinceCount += 1;

      const wardMap = new Map<string, { code: string; name: string; key: string }>();

      const pushWard = (ward: ProvinceApiWard) => {
        const normalizedWardName = normalizeWardName(ward.name);
        const wardKey = normalizeWardKey(normalizedWardName);
        if (!wardKey) {
          return;
        }
        if (!wardMap.has(wardKey)) {
          wardMap.set(wardKey, {
            code: String(ward.code),
            name: normalizedWardName,
            key: wardKey,
          });
        }
      };

      (province.wards || []).forEach(pushWard);
      (province.districts || []).forEach((district) => {
        (district.wards || []).forEach(pushWard);
      });

      for (const ward of wardMap.values()) {
        await client.query(
          `
            INSERT INTO wards (code, province_id, name, normalized_key)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (province_id, normalized_key)
            DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, updated_at = NOW()
          `,
          [ward.code, provinceId, ward.name, ward.key],
        );
        wardCount += 1;
      }
    }

    await client.query('COMMIT');

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          success: true,
          source: SOURCE_URL,
          database: LOCATION_DATABASE_URL,
          provinces: provinceCount,
          wards: wardCount,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('import-vn-admin-data failed:', error);
  process.exit(1);
});
