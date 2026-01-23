import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { signAuthToken } from "../auth/jwt";
import { setCookie } from "hono/cookie";

const authRouter = new Hono();

export const hashPin = async (pin: string): Promise<string> => {
  return bcrypt.hash(pin, 10);
};

const verifyPin = async (pin: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(pin, hash);
};

const LoginSchema = z.object({
  companyId: z.string(),
  userId: z.string(),
  pin: z.string().length(4),
});

authRouter.post("/login", zValidator("json", LoginSchema), async (c) => {
  try {
    const { companyId, userId, pin } = c.req.valid("json");

    const user = await prisma.user.findFirst({
      where: { id: userId, companyId, isActive: true },
      include: {
        company: true,
        poAssignments: { select: { poId: true } },
      },
    });

    if (!user) {
      return c.json(
        { error: { message: "Invalid credentials", code: "UNAUTHORIZED" } },
        401
      );
    }

    const isValid = await verifyPin(pin, user.pinHash);
    if (!isValid) {
      return c.json(
        { error: { message: "Invalid PIN", code: "UNAUTHORIZED" } },
        401
      );
    }

    // Generate JWT token
    const token = await signAuthToken({
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
    });

    // Set HttpOnly cookie
    // Vibecode uses https even in dev, so check for https in BACKEND_URL
    const isSecure = process.env.NODE_ENV === "production" ||
                     process.env.BACKEND_URL?.startsWith("https://") ||
                     false;
    setCookie(c, "qc_auth", token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      path: "/",
    });

    const assignedPoIds = user.poAssignments.map((a) => a.poId);

    return c.json({
      data: {
        user: {
          id: user.id,
          companyId: user.companyId,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          assignedPoIds,
        },
        company: user.company,
        token, // Also return token for clients that can't use cookies
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json(
      { error: { message: "Login failed", code: "LOGIN_ERROR" } },
      500
    );
  }
});

// Logout endpoint - clear the cookie
authRouter.post("/logout", async (c) => {
  const isSecure = process.env.NODE_ENV === "production" ||
                   process.env.BACKEND_URL?.startsWith("https://") ||
                   false;
  setCookie(c, "qc_auth", "", {
    httpOnly: true,
    secure: isSecure,
    sameSite: "Lax",
    maxAge: 0,
    path: "/",
  });

  return c.json({ data: { success: true } });
});

// Query schema for login-users endpoint
const LoginUsersQuerySchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
  role: z.enum(["INSPECTOR", "SUPERVISOR", "CUSTOMER", "SUPPLIER"]).optional(),
});

// PUBLIC endpoint - Get users for login dropdown (no auth required)
authRouter.get(
  "/login-users",
  zValidator("query", LoginUsersQuerySchema),
  async (c) => {
    try {
      const { companyId, role } = c.req.valid("query");

      // Validate company exists
      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        return c.json(
          { error: { message: "Company not found", code: "NOT_FOUND" } },
          404
        );
      }

      // Build where clause
      const whereClause: {
        companyId: string;
        isActive: boolean;
        role?: string;
      } = {
        companyId,
        isActive: true,
      };

      if (role) {
        whereClause.role = role;
      }

      // Query users with minimal safe fields only
      const users = await prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          role: true,
          email: true,
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      });

      return c.json({ data: users });
    } catch (error) {
      console.error("Login users fetch error:", error);
      return c.json(
        { error: { message: "Failed to fetch users", code: "FETCH_ERROR" } },
        500
      );
    }
  }
);

// Get current user from token
authRouter.get("/me", async (c) => {
  const auth = c.get("auth");

  if (!auth) {
    return c.json(
      { error: { message: "Not authenticated", code: "UNAUTHORIZED" } },
      401
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: {
      company: true,
      poAssignments: { select: { poId: true } },
    },
  });

  if (!user || !user.isActive) {
    return c.json(
      { error: { message: "User not found or inactive", code: "UNAUTHORIZED" } },
      401
    );
  }

  const assignedPoIds = user.poAssignments.map((a) => a.poId);

  return c.json({
    data: {
      user: {
        id: user.id,
        companyId: user.companyId,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        assignedPoIds,
      },
      company: user.company,
    },
  });
});

export { authRouter };
