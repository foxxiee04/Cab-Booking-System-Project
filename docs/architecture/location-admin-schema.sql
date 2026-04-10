-- Vietnam 2026 two-level administrative model
-- county/district is intentionally excluded from canonical output model.

CREATE TABLE IF NOT EXISTS provinces (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE,
  name VARCHAR(255) NOT NULL,
  normalized_key VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wards (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE,
  province_id BIGINT NOT NULL REFERENCES provinces(id),
  name VARCHAR(255) NOT NULL,
  normalized_key VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (province_id, normalized_key)
);

CREATE INDEX IF NOT EXISTS idx_wards_province_id ON wards(province_id);
CREATE INDEX IF NOT EXISTS idx_wards_normalized_key ON wards(normalized_key);
