import type { Context, MiddlewareHandler } from "hono";

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitStore>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (now > value.resetTime) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  windowMs: number;    // Time window in milliseconds
  max: number;         // Max requests per window
  keyGenerator?: (c: Context) => string;
  skip?: (c: Context) => boolean;
}

/**
 * Rate limiting middleware
 * Limits requests per IP address within a time window
 */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const {
    windowMs = 60 * 1000,  // 1 minute default
    max = 100,              // 100 requests default
    keyGenerator = (c) => {
      // Get client IP from various headers
      const forwarded = c.req.header("x-forwarded-for");
      const realIp = c.req.header("x-real-ip");
      return forwarded?.split(",")[0]?.trim() || realIp || "unknown";
    },
    skip = () => false,
  } = options;

  return async (c, next) => {
    // Skip rate limiting for certain routes
    if (skip(c)) {
      return next();
    }

    const key = keyGenerator(c);
    const now = Date.now();
    const record = store.get(key);

    if (!record || now > record.resetTime) {
      // New window
      store.set(key, { count: 1, resetTime: now + windowMs });
      c.header("X-RateLimit-Limit", String(max));
      c.header("X-RateLimit-Remaining", String(max - 1));
      c.header("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1000)));
      return next();
    }

    record.count++;

    const remaining = Math.max(0, max - record.count);
    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil(record.resetTime / 1000)));

    if (record.count > max) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json(
        {
          error: {
            message: "Too many requests, please try again later",
            code: "RATE_LIMIT_EXCEEDED",
            retryAfter,
          },
        },
        429
      );
    }

    return next();
  };
}

/**
 * Stricter rate limit for auth endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 attempts per 15 min
});

/**
 * Standard API rate limit
 */
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,              // 100 requests per minute
  skip: (c) => c.req.path === "/health",
});
