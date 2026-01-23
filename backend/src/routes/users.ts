import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole, requireSameCompanyUser } from "../auth/guards";
import { hashPin } from "./auth";

const usersRouter = new Hono();

const CreateUserSchema = z.object({
  companyId: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  pin: z.string().length(4).regex(/^\d+$/),
  role: z
    .enum(["INSPECTOR", "SUPERVISOR", "CUSTOMER", "SUPPLIER"])
    .default("INSPECTOR"),
  isActive: z.boolean().optional().default(true),
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  pin: z.string().length(4).regex(/^\d+$/).optional(),
  role: z.enum(["INSPECTOR", "SUPERVISOR", "CUSTOMER", "SUPPLIER"]).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/users?role=xxx
usersRouter.get("/", async (c) => {
  try {
    const auth = requireAuth(c);
    const role = c.req.query("role");

    const users = await prisma.user.findMany({
      where: {
        companyId: auth.companyId,
        ...(role && { role }),
        isActive: true,
      },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: "asc" },
    });

    return c.json({ data: users });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch users", code: "FETCH_ERROR" } },
      500
    );
  }
});

// GET /api/users/:id
usersRouter.get("/:id", async (c) => {
  try {
    const { id } = c.req.param();
    await requireSameCompanyUser(c, id);

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return c.json(
        { error: { message: "User not found", code: "NOT_FOUND" } },
        404
      );
    }

    return c.json({ data: user });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch user", code: "FETCH_ERROR" } },
      500
    );
  }
});

// POST /api/users
usersRouter.post("/", zValidator("json", CreateUserSchema), async (c) => {
  try {
    const auth = requireRole(c, ["SUPERVISOR"]);
    const { pin, companyId: _clientCompanyId, ...data } = c.req.valid("json");

    const pinHash = await hashPin(pin);
    const user = await prisma.user.create({
      data: { ...data, companyId: auth.companyId, pinHash },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return c.json({ data: user }, 201);
  } catch (error: any) {
    if (error instanceof Error && "status" in error) throw error;
    if (error.code === "P2002") {
      return c.json(
        { error: { message: "Email already exists", code: "DUPLICATE_EMAIL" } },
        409
      );
    }
    return c.json(
      { error: { message: "Failed to create user", code: "CREATE_ERROR" } },
      500
    );
  }
});

// PUT /api/users/:id
usersRouter.put("/:id", zValidator("json", UpdateUserSchema), async (c) => {
  try {
    const { id } = c.req.param();
    requireRole(c, ["SUPERVISOR"]);
    await requireSameCompanyUser(c, id);
    const { pin, ...data } = c.req.valid("json");

    const updateData: any = { ...data };
    if (pin) updateData.pinHash = await hashPin(pin);

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return c.json({ data: user });
  } catch (error: any) {
    if (error instanceof Error && "status" in error) throw error;
    if (error.code === "P2025") {
      return c.json(
        { error: { message: "User not found", code: "NOT_FOUND" } },
        404
      );
    }
    if (error.code === "P2002") {
      return c.json(
        { error: { message: "Email already exists", code: "DUPLICATE_EMAIL" } },
        409
      );
    }
    return c.json(
      { error: { message: "Failed to update user", code: "UPDATE_ERROR" } },
      500
    );
  }
});

// DELETE /api/users/:id (soft delete)
usersRouter.delete("/:id", async (c) => {
  try {
    const { id } = c.req.param();
    requireRole(c, ["SUPERVISOR"]);
    await requireSameCompanyUser(c, id);

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return c.body(null, 204);
  } catch (error: any) {
    if (error instanceof Error && "status" in error) throw error;
    if (error.code === "P2025") {
      return c.json(
        { error: { message: "User not found", code: "NOT_FOUND" } },
        404
      );
    }
    return c.json(
      { error: { message: "Failed to delete user", code: "DELETE_ERROR" } },
      500
    );
  }
});

export { usersRouter };
