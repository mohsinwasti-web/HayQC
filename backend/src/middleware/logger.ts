import type { MiddlewareHandler } from "hono";
import { env } from "../env";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  requestId?: string;
  method?: string;
  path?: string;
  status?: number;
  duration?: number;
  ip?: string;
  userAgent?: string;
  userId?: string;
  message?: string;
  error?: {
    message: string;
    stack?: string;
  };
}

type LogInput = Omit<LogEntry, "timestamp" | "level">;

/**
 * Structured JSON logger for production
 */
class Logger {
  private isProduction = env.NODE_ENV === "production";

  private formatLog(entry: LogEntry): string {
    if (this.isProduction) {
      // JSON format for production (easy to parse by log aggregators)
      return JSON.stringify(entry);
    }
    // Pretty format for development
    const { timestamp, level, method, path, status, duration, requestId, message } = entry;
    const reqIdStr = requestId ? requestId.slice(0, 8) : "system";
    const methodStr = method || "-";
    const pathStr = path || "-";
    const statusStr = status ? ` ${status}` : "";
    const durationStr = duration ? ` ${duration}ms` : "";
    const msgStr = message ? ` ${message}` : "";
    return `[${timestamp}] ${level.toUpperCase()} ${reqIdStr} ${methodStr} ${pathStr}${statusStr}${durationStr}${msgStr}`;
  }

  log(level: LogLevel, entry: LogInput) {
    const fullEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      ...entry,
    };
    const output = this.formatLog(fullEntry);

    switch (level) {
      case "error":
        console.error(output);
        break;
      case "warn":
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  info(entry: LogInput) {
    this.log("info", entry);
  }

  warn(entry: LogInput) {
    this.log("warn", entry);
  }

  error(entry: LogInput) {
    this.log("error", entry);
  }

  debug(entry: LogInput) {
    if (!this.isProduction) {
      this.log("debug", entry);
    }
  }
}

export const logger = new Logger();

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Structured logging middleware with request ID correlation
 */
export function structuredLogger(): MiddlewareHandler {
  return async (c, next) => {
    const requestId = c.req.header("x-request-id") || generateRequestId();
    const start = Date.now();

    // Set request ID for downstream use
    c.set("requestId", requestId);
    c.header("X-Request-ID", requestId);

    const method = c.req.method;
    const path = c.req.path;
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
      || c.req.header("x-real-ip")
      || "unknown";
    const userAgent = c.req.header("user-agent");

    // Log request start (debug level)
    logger.debug({
      requestId,
      method,
      path,
      ip,
      userAgent,
      message: "Request started",
    });

    try {
      await next();
    } catch (err) {
      // Error will be handled by error handler, but log it here
      const error = err as Error;
      logger.error({
        requestId,
        method,
        path,
        ip,
        duration: Date.now() - start,
        error: {
          message: error.message,
          stack: error.stack,
        },
      });
      throw err;
    }

    const duration = Date.now() - start;
    const status = c.res.status;

    // Get user ID if authenticated
    const auth = c.get("auth") as { userId?: string } | undefined;
    const userId = auth?.userId;

    // Log based on status
    if (status >= 500) {
      logger.error({ requestId, method, path, status, duration, ip, userId });
    } else if (status >= 400) {
      logger.warn({ requestId, method, path, status, duration, ip, userId });
    } else {
      logger.info({ requestId, method, path, status, duration, ip, userId });
    }
  };
}
