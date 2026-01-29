import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
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

const startTime = Date.now();

/**
 * ✅ CORS (manual + debug)
 * Goal: browser MUST receive Access-Control-Allow-Origin on BOTH preflight + actual responses.
 */
const allowedRegex = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecodeapp\.com$/,
  /^https:\/\/[a-z0-9-]+\.up\.railway\.app$/,
];

const corsOriginEnv = (env.CORS_ORIGIN || process.env.CORS_ORIGIN || "").trim();

function getAllowedOriginsFromEnv(): string[] {
  if (!corsOriginEnv) return [];
  return corsOriginEnv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\/+$/, "")); // remove trailing slash
}

const envAllowedList = getAllowedOriginsFromEnv();

function normalizeOrigin(origin: string): string {
  return (origin || "").trim().replace(/\/+$/, "");
}

function isAllowedOrigin(originRaw: string): boolean {
  const origin = normalizeOrigin(originRaw);
  if (!origin) return false;

  // If CORS_ORIGIN is set, only allow exactly those.
  if (envAllowedList.length > 0) {
    return envAllowedList.includes(origin);
  }

  // Otherwise fallback to regex allowlist
  return allowedRegex.some((re) => re.test(origin));
}

function applyCorsHeaders(c: any, originRaw: string) {
  const origin = normalizeOrigin(originRaw);

  // Debug header to prove deployed code is active
  c.header("X-CORS-DEBUG", "ACTIVE-v6");

  // Always vary on origin when doing dynamic CORS
  c.header("Vary", "Origin");

  if (!origin) return;

  if (isAllowedOrigin(origin)) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header(
      "Access-Control-Allow-Headers",
      [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-Request-Id",
        "Sentry-Trace",
        "Baggage",
      ].join(", ")
    );
    c.header(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
    c.header("Access-Control-Max-Age", "600");
  }
}

// ✅ CORS middleware (FIRST — handles OPTIONS, sets headers before+after next)
app.use("*", async (c, next) => {
  const origin = (c.req.header("Origin") || c.req.header("origin") || "").trim();

  // OPTIONS: respond immediately, skip all other middleware
  if (c.req.method === "OPTIONS") {
    applyCorsHeaders(c, origin);
    return c.body(null, 204);
  }

  // Set before next (primary path — c.header() accumulation)
  applyCorsHeaders(c, origin);
  await next();

  // Re-apply after next on c.res directly (catches error responses, rate-limit responses, etc.)
  if (origin && isAllowedOrigin(origin)) {
    c.res.headers.set("Access-Control-Allow-Origin", normalizeOrigin(origin));
    c.res.headers.set("Access-Control-Allow-Credentials", "true");
    c.res.headers.append("Vary", "Origin");
  }
});

// ✅ SECURITY
app.use("*", securityHeaders());
app.use("*", requestSizeLimit(10 * 1024 * 1024));

// ✅ Structured logging with request ID
app.use("*", structuredLogger());

// ✅ Metrics collection
app.use("*", metricsMiddleware());

// ✅ Error tracking (Sentry)
app.use("*", errorTracking());

// ✅ Rate limiting
app.use("*", apiRateLimit);
app.use("/api/auth/*", authRateLimit);

// ✅ Auth middleware
app.use("*", authMiddleware());

// Health
app.get("/health", (c) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: `${uptime}s`,
    version: process.env.npm_package_version || "1.0.0",
    environment: env.NODE_ENV,
  });
});

app.get("/health/ready", async (c) => {
  const checks: Record<string, { status: string; latency?: number }> = {};

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

  const allOk = Object.values(checks).every((v) => v.status === "ok");

  return c.json(
    { status: allOk ? "ok" : "degraded", timestamp: new Date().toISOString(), checks },
    allOk ? 200 : 503
  );
});

// Metrics
app.get("/metrics", (c) => c.json(metrics.getMetrics()));
app.get("/metrics/prometheus", (c) => {
  c.header("Content-Type", "text/plain; version=0.0.4");
  return c.text(metrics.getPrometheusMetrics());
});

// Static uploads
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
  // Re-apply CORS headers so browsers don't block error responses
  const origin = (c.req.header("Origin") || c.req.header("origin") || "").trim();
  applyCorsHeaders(c, origin);

  const requestId = c.get("requestId") || "unknown";

  logger.error({
    requestId,
    method: c.req.method,
    path: c.req.path,
    error: { message: err.message, stack: err.stack },
  });

  const sentryId = c.res.headers.get("X-Sentry-ID");
  if ("status" in err && typeof (err as any).status === "number") {
    return c.json(
      {
        error: {
          message: err.message,
          code: "HTTP_ERROR",
          requestId,
          ...(sentryId && { sentryId }),
        },
      },
      (err as any).status as 401 | 403 | 404 | 500
    );
  }

  const message =
    env.NODE_ENV === "production" ? "An unexpected error occurred" : err.message;

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
