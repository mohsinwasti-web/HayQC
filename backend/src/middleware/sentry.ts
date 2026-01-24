import type { MiddlewareHandler } from "hono";
import { env } from "../env";
import { logger } from "./logger";

// Sentry DSN should be set in environment for production
const SENTRY_DSN = process.env.SENTRY_DSN;

interface SentryEvent {
  event_id: string;
  timestamp: string;
  level: "error" | "warning" | "info";
  message: string;
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: {
        frames: Array<{
          filename: string;
          function: string;
          lineno?: number;
        }>;
      };
    }>;
  };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  request?: {
    method: string;
    url: string;
    headers?: Record<string, string>;
  };
  user?: {
    id?: string;
    ip_address?: string;
  };
}

/**
 * Lightweight Sentry-compatible error reporter
 * For full Sentry SDK, install @sentry/node
 */
class ErrorReporter {
  private dsn: string | undefined;
  private projectId: string = "";
  private publicKey: string = "";
  private host: string = "";

  constructor() {
    this.dsn = SENTRY_DSN;
    if (this.dsn) {
      try {
        const url = new URL(this.dsn);
        this.publicKey = url.username;
        this.host = url.host;
        this.projectId = url.pathname.slice(1);
        logger.info({
          requestId: "system",
          method: "INIT",
          path: "/sentry",
          message: "Sentry error reporting initialized",
        });
      } catch {
        logger.warn({
          requestId: "system",
          method: "INIT",
          path: "/sentry",
          message: "Invalid SENTRY_DSN format",
        });
      }
    }
  }

  async captureException(
    error: Error,
    context?: {
      requestId?: string;
      method?: string;
      path?: string;
      userId?: string;
      ip?: string;
      extra?: Record<string, unknown>;
    }
  ): Promise<string | null> {
    if (!this.dsn || env.NODE_ENV !== "production") {
      // In development, just log the error
      return null;
    }

    const eventId = crypto.randomUUID().replace(/-/g, "");

    const event: SentryEvent = {
      event_id: eventId,
      timestamp: new Date().toISOString(),
      level: "error",
      message: error.message,
      exception: {
        values: [
          {
            type: error.name || "Error",
            value: error.message,
            stacktrace: error.stack
              ? {
                  frames: this.parseStackTrace(error.stack),
                }
              : undefined,
          },
        ],
      },
      tags: {
        environment: env.NODE_ENV,
        runtime: "bun",
      },
      extra: context?.extra,
      request: context?.method
        ? {
            method: context.method,
            url: context.path || "",
          }
        : undefined,
      user: {
        id: context?.userId,
        ip_address: context?.ip,
      },
    };

    try {
      const response = await fetch(
        `https://${this.host}/api/${this.projectId}/store/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${this.publicKey}`,
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        logger.warn({
          requestId: context?.requestId || "system",
          method: "POST",
          path: "/sentry",
          message: `Failed to send to Sentry: ${response.status}`,
        });
      }

      return eventId;
    } catch (err) {
      logger.warn({
        requestId: context?.requestId || "system",
        method: "POST",
        path: "/sentry",
        message: `Sentry send failed: ${(err as Error).message}`,
      });
      return null;
    }
  }

  private parseStackTrace(stack: string) {
    const lines = stack.split("\n").slice(1);
    return lines
      .map((line) => {
        const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):\d+\)/);
        if (match && match[1] && match[2] && match[3]) {
          return {
            function: match[1],
            filename: match[2],
            lineno: parseInt(match[3], 10),
          };
        }
        return null;
      })
      .filter((frame): frame is { filename: string; function: string; lineno: number } => frame !== null)
      .reverse();
  }
}

export const errorReporter = new ErrorReporter();

/**
 * Error tracking middleware
 * Captures unhandled errors and sends to Sentry
 */
export function errorTracking(): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next();
    } catch (error) {
      const requestId = c.get("requestId") as string | undefined;
      const auth = c.get("auth") as { userId?: string } | undefined;
      const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
        || c.req.header("x-real-ip");

      // Report to Sentry
      const eventId = await errorReporter.captureException(error as Error, {
        requestId,
        method: c.req.method,
        path: c.req.path,
        userId: auth?.userId,
        ip,
      });

      // Add Sentry event ID to response header
      if (eventId) {
        c.header("X-Sentry-ID", eventId);
      }

      throw error;
    }
  };
}
