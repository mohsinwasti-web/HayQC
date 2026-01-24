import type { MiddlewareHandler } from "hono";

/**
 * Security headers middleware
 * Adds standard security headers to all responses
 */
export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    await next();

    // Prevent clickjacking
    c.header("X-Frame-Options", "DENY");

    // Prevent MIME type sniffing
    c.header("X-Content-Type-Options", "nosniff");

    // XSS protection (legacy browsers)
    c.header("X-XSS-Protection", "1; mode=block");

    // Referrer policy
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");

    // Permissions policy (restrict browser features)
    c.header(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=(), payment=()"
    );

    // HSTS (only in production with HTTPS)
    if (process.env.NODE_ENV === "production") {
      c.header(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains"
      );
    }
  };
}

/**
 * Request size limit middleware
 * Prevents oversized payloads
 */
export function requestSizeLimit(maxBytes: number = 10 * 1024 * 1024): MiddlewareHandler {
  return async (c, next) => {
    const contentLength = c.req.header("content-length");

    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      return c.json(
        {
          error: {
            message: `Request body too large. Maximum size is ${Math.round(maxBytes / 1024 / 1024)}MB`,
            code: "PAYLOAD_TOO_LARGE",
          },
        },
        413
      );
    }

    return next();
  };
}

/**
 * Secure cookie options for production
 */
export const secureCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60, // 7 days
};
