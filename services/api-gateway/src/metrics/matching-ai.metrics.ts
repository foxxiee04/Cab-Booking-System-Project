import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

const registry = new Registry();
collectDefaultMetrics({ register: registry, prefix: 'api_gateway_' });

const aiMatchingDecisionsTotal = new Counter({
  name: 'api_gateway_ai_matching_decisions_total',
  help: 'Total AI matching decisions by source and reason code',
  labelNames: ['source', 'reason_code'] as const,
  registers: [registry],
});

const aiMatchingTimeoutsTotal = new Counter({
  name: 'api_gateway_ai_matching_timeouts_total',
  help: 'Total AI matching timeout occurrences',
  registers: [registry],
});

const aiMatchingRequestDurationMs = new Histogram({
  name: 'api_gateway_ai_matching_request_duration_ms',
  help: 'AI matching signal request duration in milliseconds',
  labelNames: ['source'] as const,
  buckets: [25, 50, 75, 100, 150, 200, 300, 500, 1000],
  registers: [registry],
});

const aiMatchingTimeoutRate = new Gauge({
  name: 'api_gateway_ai_matching_timeout_rate',
  help: 'Ratio of AI timeout decisions over total matching AI decisions',
  registers: [registry],
});

let totalDecisions = 0;
let totalTimeouts = 0;

export function observeAiMatchingDecision(input: {
  source: 'AI_SERVICE' | 'HEURISTIC';
  reasonCode: string;
  latencyMs: number;
}): void {
  aiMatchingDecisionsTotal.inc({ source: input.source, reason_code: input.reasonCode });

  const latency = Number.isFinite(input.latencyMs) ? Math.max(0, input.latencyMs) : 0;
  aiMatchingRequestDurationMs.observe({ source: input.source }, latency);

  totalDecisions += 1;
  if (input.reasonCode === 'AI_TIMEOUT') {
    aiMatchingTimeoutsTotal.inc();
    totalTimeouts += 1;
  }

  aiMatchingTimeoutRate.set(totalDecisions > 0 ? totalTimeouts / totalDecisions : 0);
}

export async function collectMetricsText(): Promise<string> {
  return registry.metrics();
}

export function getMetricsContentType(): string {
  return registry.contentType;
}
