export interface EndpointMetrics {
  total: number;
  avgDurationMs: number;
  errorCount: number;
}

export interface GatewayMetrics {
  requests: {
    total: number;
    byEndpoint: Record<string, EndpointMetrics>;
    byStatus: Record<string, number>;
    avgDurationMs: number;
  };
  uptime: number;
  channels: string[];
}

interface TimingRecord {
  timestamp: number;
  durationMs: number;
  statusCode: number;
  endpoint: string;
}

const MAX_RECORDS = 10000;

export class MetricsMiddleware {
  private startTime: number;
  private records: TimingRecord[];
  private totalRequests: number;
  private requestsByEndpoint: Record<string, { count: number; totalDuration: number; errors: number }>;
  private requestsByStatus: Record<string, number>;
  private totalDuration: number;

  constructor() {
    this.startTime = Date.now();
    this.records = [];
    this.totalRequests = 0;
    this.requestsByEndpoint = {};
    this.requestsByStatus = {};
    this.totalDuration = 0;
  }

  onRequest(_request: unknown, _reply: unknown, done: () => void): void {
    done();
  }

  onResponse(request: { url?: string; method?: string }, reply: { statusCode?: number }, done: () => void): void {
    const endpoint = request.url ?? "unknown";
    const statusCode = reply.statusCode ?? 0;
    const durationMs = 0; // Will be computed externally via hook timing

    this.recordRequest(endpoint, durationMs, statusCode);
    done();
  }

  recordTimedRequest(endpoint: string, durationMs: number, statusCode: number): void {
    const record: TimingRecord = {
      timestamp: Date.now(),
      durationMs,
      statusCode,
      endpoint,
    };

    this.records.push(record);
    if (this.records.length > MAX_RECORDS) {
      this.records.shift();
    }

    this.totalRequests += 1;
    this.totalDuration += durationMs;

    if (!this.requestsByEndpoint[endpoint]) {
      this.requestsByEndpoint[endpoint] = { count: 0, totalDuration: 0, errors: 0 };
    }
    const ep = this.requestsByEndpoint[endpoint];
    ep.count += 1;
    ep.totalDuration += durationMs;
    if (statusCode >= 400) {
      ep.errors += 1;
    }

    const statusKey = String(statusCode);
    this.requestsByStatus[statusKey] = (this.requestsByStatus[statusKey] ?? 0) + 1;
  }

  getMetrics(): GatewayMetrics {
    const uptime = (Date.now() - this.startTime) / 1000;
    const avgDurationMs = this.totalRequests > 0 ? this.totalDuration / this.totalRequests : 0;

    const byEndpoint: Record<string, EndpointMetrics> = {};
    for (const [ep, data] of Object.entries(this.requestsByEndpoint)) {
      byEndpoint[ep] = {
        total: data.count,
        avgDurationMs: data.count > 0 ? data.totalDuration / data.count : 0,
        errorCount: data.errors,
      };
    }

    return {
      requests: {
        total: this.totalRequests,
        byEndpoint,
        byStatus: { ...this.requestsByStatus },
        avgDurationMs,
      },
      uptime: Math.round(uptime * 100) / 100,
      channels: [],
    };
  }

  reset(): void {
    this.startTime = Date.now();
    this.records = [];
    this.totalRequests = 0;
    this.requestsByEndpoint = {};
    this.requestsByStatus = {};
    this.totalDuration = 0;
  }
}
