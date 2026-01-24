import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { env } from "./env";

// Middleware
import { structuredLogger, logger } from "./middleware/logger";
import { apiRateLimit, authRateLimit } from "./middleware/rate-limit";
import { errorTracking } from "./middleware/sentry";
import { securityHeaders, requestSizeLimit } from "./middleware/security";
import { metricsMiddleware, metrics } from "./middleware/metrics";

// Auth
import { authMiddleware } from "./auth/middleware";

// Routes
import { companiesRouter } from "./routes/companies";
import { usersRouter } from "./routes/users";
import { authRouter } from "./routes/auth";
import { purchaseOrdersRouter } from "./routes/purchase-orders";
import { shipmentsRouter } from "./routes/shipments";
import { containersRouter } from "./routes/containers";
import { assignmentsRouter } from "./routes/assignments";
import { poAssignmentsRouter } from "./routes/po-assignments";
import { poNotesRouter } from "./routes/po-notes";
import { balesRouter } from "./routes/bales";
import { statsRouter } from "./routes/stats";
import { uploadsRouter } from "./routes/uploads";

const app = new Hono<{
  Variables: {
    requestId: string;
    auth?: { userId: string; companyId: string; role: string };
  };
}>();

// Server start time for uptime calculation
const startTime = Date.now();

// Security headers (first - applies to all responses)
app.use("*", securityHeaders());

// Request size limit (10MB)
app.use("*", requestSizeLimit(10 * 1024 * 1024));

// CORS middleware - validates origin against allowlist
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecodeapp\.com$/,
];

app.use(
  "*",
  cors({
    origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
    credentials: true,
  })
);

// Structured logging with request ID
app.use("*", structuredLogger());

// Metrics collection
app.use("*", metricsMiddleware());

// Error tracking (Sentry)
app.use("*", errorTracking());

// Rate limiting (skip health check)
app.use("*", apiRateLimit);

// Stricter rate limit for auth endpoints
app.use("/api/auth/*", authRateLimit);

// Auth middleware - reads token and sets c.var.auth
app.use("*", authMiddleware());

// Health check endpoint - comprehensive status
app.get("/health", async (c) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  // Basic health response
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: `${uptime}s`,
    version: process.env.npm_package_version || "1.0.0",
    environment: env.NODE_ENV,
  };

  return c.json(health);
});

// Detailed health check (for monitoring systems)
app.get("/health/ready", async (c) => {
  const checks: Record<string, { status: string; latency?: number }> = {};

  // Database check
  try {
    const dbStart = Date.now();
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    checks.database = { status: "ok", latency: Date.now() - dbStart };
  } catch {
    checks.database = { status: "error" };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");

  return c.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    allOk ? 200 : 503
  );
});

// Metrics endpoint (JSON format)
app.get("/metrics", (c) => {
  return c.json(metrics.getMetrics());
});

// Prometheus-compatible metrics endpoint
app.get("/metrics/prometheus", (c) => {
  c.header("Content-Type", "text/plain; version=0.0.4");
  return c.text(metrics.getPrometheusMetrics());
});

// Static file serving for uploads
app.use("/uploads/*", serveStatic({ root: "./" }));

// Routes
app.route("/api/companies", companiesRouter);
app.route("/api/users", usersRouter);
app.route("/api/auth", authRouter);
app.route("/api/purchase-orders", purchaseOrdersRouter);
app.route("/api/shipments", shipmentsRouter);
app.route("/api/containers", containersRouter);
app.route("/api/assignments", assignmentsRouter);
app.route("/api/po-assignments", poAssignmentsRouter);
app.route("/api/po-notes", poNotesRouter);
app.route("/api/bales", balesRouter);
app.route("/api/stats", statsRouter);
app.route("/api/uploads", uploadsRouter);

// Global error handler
app.onError((err, c) => {
  const requestId = c.get("requestId") || "unknown";

  // Log error with structured logger
  logger.error({
    requestId,
    method: c.req.method,
    path: c.req.path,
    error: {
      message: err.message,
      stack: err.stack,
    },
  });

  // Get Sentry ID if captured
  const sentryId = c.res.headers.get("X-Sentry-ID");

  // Handle HTTPException from guards
  if ("status" in err && typeof err.status === "number") {
    return c.json(
      {
        error: {
          message: err.message,
          code: "HTTP_ERROR",
          requestId,
          ...(sentryId && { sentryId }),
        },
      },
      err.status as 401 | 403 | 404 | 500
    );
  }

  // Don't expose internal error details in production
  const message =
    env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : err.message;

  return c.json(
    {
      error: {
        message,
        code: "INTERNAL_ERROR",
        requestId,
        ...(sentryId && { sentryId }),
      },
    },
    500
  );
});

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
