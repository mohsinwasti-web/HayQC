import type { Context, Next } from "hono";
import { verifyAuthToken, type AuthPayload } from "./jwt";

// Extend Hono's context to include auth
declare module "hono" {
  interface ContextVariableMap {
    auth: AuthPayload | null;
  }
}

// Auth middleware - reads token from cookie or Authorization header
// Sets c.var.auth if valid, otherwise null
export function authMiddleware() {
  return async (c: Context, next: Next) => {
    let token: string | undefined;

    // 1. Try cookie first (qc_auth)
    const cookieHeader = c.req.header("cookie");
    if (cookieHeader) {
      const cookies = cookieHeader.split(";").reduce(
        (acc, cookie) => {
          const [key, value] = cookie.trim().split("=");
          if (key && value) acc[key] = value;
          return acc;
        },
        {} as Record<string, string>
      );
      token = cookies["qc_auth"];
    }

    // 2. Fallback to Authorization header (Bearer token)
    if (!token) {
      const authHeader = c.req.header("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      }
    }

    // 3. Verify token if present
    if (token) {
      const auth = await verifyAuthToken(token);
      c.set("auth", auth);
    } else {
      c.set("auth", null);
    }

    await next();
  };
}
