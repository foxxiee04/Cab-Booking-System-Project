/**
 * API Gateway serves HTTP under `/api` (nginx → :3000, routes like `/api/auth/...`).
 * CI secrets often omit the suffix (e.g. `https://api.foxgo.io.vn`).
 */
export function normalizeGatewayApiBaseUrl(raw: string | undefined): string {
  const fallback = 'http://localhost:3000/api';
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;
  const v = trimmed.replace(/\/+$/, '');
  if (v.endsWith('/api')) return v;
  return `${v}/api`;
}

/** Gateway origin without `/api` (e.g. static URLs like `/uploads/...`). */
export function normalizeGatewayOriginUrl(raw: string | undefined): string {
  return normalizeGatewayApiBaseUrl(raw).replace(/\/api\/?$/, '');
}
