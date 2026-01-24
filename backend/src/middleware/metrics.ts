import type { MiddlewareHandler } from "hono";

/**
 * Simple in-memory metrics collector
 * For production, integrate with Prometheus, Datadog, or CloudWatch
 */
class MetricsCollector {
  private requestCount = 0;
  private errorCount = 0;
  private responseTimeSum = 0;
  private responseTimes: number[] = [];
  private statusCodes: Record<number, number> = {};
  private endpointCounts: Record<string, number> = {};
  private startTime = Date.now();

  recordRequest(
    method: string,
    path: string,
    status: number,
    duration: number
  ) {
    this.requestCount++;
    this.responseTimeSum += duration;
    this.responseTimes.push(duration);

    // Keep only last 1000 response times for percentile calculation
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }

    // Count by status code
    this.statusCodes[status] = (this.statusCodes[status] || 0) + 1;

    // Count errors
    if (status >= 400) {
      this.errorCount++;
    }

    // Count by endpoint (group by path pattern)
    const endpoint = `${method} ${this.normalizePath(path)}`;
    this.endpointCounts[endpoint] = (this.endpointCounts[endpoint] || 0) + 1;
  }

  private normalizePath(path: string): string {
    // Replace UUIDs and IDs with placeholders
    return path
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, ':id')
      .replace(/\/[a-z0-9]{20,}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }

  getMetrics() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const avgResponseTime = this.requestCount > 0
      ? Math.round(this.responseTimeSum / this.requestCount)
      : 0;

    // Calculate percentiles
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

    return {
      uptime_seconds: uptime,
      requests: {
        total: this.requestCount,
        errors: this.errorCount,
        error_rate: this.requestCount > 0
          ? Math.round((this.errorCount / this.requestCount) * 10000) / 100
          : 0,
      },
      response_time_ms: {
        avg: avgResponseTime,
        p50,
        p95,
        p99,
      },
      status_codes: this.statusCodes,
      top_endpoints: Object.entries(this.endpointCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
    };
  }

  // Prometheus-compatible format
  getPrometheusMetrics(): string {
    const metrics = this.getMetrics();
    const lines: string[] = [];

    lines.push('# HELP hayqc_requests_total Total number of requests');
    lines.push('# TYPE hayqc_requests_total counter');
    lines.push(`hayqc_requests_total ${metrics.requests.total}`);

    lines.push('# HELP hayqc_errors_total Total number of errors');
    lines.push('# TYPE hayqc_errors_total counter');
    lines.push(`hayqc_errors_total ${metrics.requests.errors}`);

    lines.push('# HELP hayqc_response_time_ms Response time in milliseconds');
    lines.push('# TYPE hayqc_response_time_ms gauge');
    lines.push(`hayqc_response_time_ms{quantile="0.5"} ${metrics.response_time_ms.p50}`);
    lines.push(`hayqc_response_time_ms{quantile="0.95"} ${metrics.response_time_ms.p95}`);
    lines.push(`hayqc_response_time_ms{quantile="0.99"} ${metrics.response_time_ms.p99}`);

    lines.push('# HELP hayqc_uptime_seconds Server uptime in seconds');
    lines.push('# TYPE hayqc_uptime_seconds gauge');
    lines.push(`hayqc_uptime_seconds ${metrics.uptime_seconds}`);

    for (const [code, count] of Object.entries(metrics.status_codes)) {
      lines.push(`hayqc_http_responses{code="${code}"} ${count}`);
    }

    return lines.join('\n');
  }

  reset() {
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimeSum = 0;
    this.responseTimes = [];
    this.statusCodes = {};
    this.endpointCounts = {};
  }
}

export const metrics = new MetricsCollector();

/**
 * Metrics collection middleware
 */
export function metricsMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();

    await next();

    const duration = Date.now() - start;
    metrics.recordRequest(
      c.req.method,
      c.req.path,
      c.res.status,
      duration
    );
  };
}
