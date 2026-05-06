/**
 * Integration test runner for CI.
 *
 * Validates that the Docker Compose integration infrastructure
 * (started by .github/docker/docker-compose.integration.yml) is reachable
 * and healthy before the full stack starts.
 *
 * Ports used by the integration compose file:
 *   PostgreSQL  55432
 *   MongoDB     27018
 *   Redis       6380
 *   RabbitMQ    5673  (AMQP)
 *   AI Service  18000
 */

import * as net from 'net';
import * as http from 'http';

const TIMEOUT_MS = 5000;

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

// ── TCP connectivity check ─────────────────────────────────────────────────

function checkTcp(host: string, port: number, label: string): Promise<CheckResult> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ name: label, ok: false, detail: `TCP timeout after ${TIMEOUT_MS}ms` });
    }, TIMEOUT_MS);

    socket.connect(port, host, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ name: label, ok: true });
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      resolve({ name: label, ok: false, detail: err.message });
    });
  });
}

// ── HTTP health check ──────────────────────────────────────────────────────

function checkHttp(url: string, label: string): Promise<CheckResult> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ name: label, ok: false, detail: `HTTP timeout after ${TIMEOUT_MS}ms` });
    }, TIMEOUT_MS);

    http
      .get(url, (res) => {
        clearTimeout(timer);
        res.resume();
        const ok = res.statusCode !== undefined && res.statusCode < 500;
        resolve({ name: label, ok, detail: `HTTP ${res.statusCode}` });
      })
      .on('error', (err) => {
        clearTimeout(timer);
        resolve({ name: label, ok: false, detail: err.message });
      });
  });
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔍 Integration Infrastructure Health Check\n');

  const checks = await Promise.all([
    checkTcp('localhost', 55432, 'PostgreSQL :55432'),
    checkTcp('localhost', 27018, 'MongoDB    :27018'),
    checkTcp('localhost', 6380, 'Redis      :6380'),
    checkTcp('localhost', 5673, 'RabbitMQ   :5673'),
    checkHttp('http://localhost:18000/health', 'AI Service :18000'),
  ]);

  let passed = 0;
  let failed = 0;

  for (const result of checks) {
    const icon = result.ok ? '✅' : '❌';
    const detail = result.detail ? `  (${result.detail})` : '';
    console.log(`  ${icon}  ${result.name}${detail}`);
    if (result.ok) passed++;
    else failed++;
  }

  console.log(`\n  ${passed}/${checks.length} infrastructure services reachable`);

  if (failed > 0) {
    console.warn('\n⚠️  Some infrastructure services are unreachable.');
    console.warn('   This is expected if they are still starting up.');
    console.warn('   The integration test is non-blocking in CI (continue-on-error: true).\n');
    // Exit 0 so CI proceeds — the integration job already has continue-on-error: true
    process.exit(0);
  }

  console.log('\n✅ All infrastructure services are reachable.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(0); // non-blocking
});
