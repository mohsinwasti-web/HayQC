import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../db";
import { requireRole } from "../auth/guards";

const companiesRouter = new Hono();

const CreateCompanySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2).max(10),
  address: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
});

const UpdateCompanySchema = CreateCompanySchema.partial();

// GET /api/companies - List all companies (public for login flow)
companiesRouter.get("/", async (c) => {
  try {
    const companies = await prisma.company.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return c.json({
      data: companies.map((company) => ({
        ...company,
        usersCount: company._count.users,
        _count: undefined,
      })),
    });
  } catch (error) {
    console.error("Error fetching companies:", error);
    return c.json(
      { error: { message: "Failed to fetch companies", code: "FETCH_ERROR" } },
      500
    );
  }
});

// GET /api/companies/:id - Get one company with active users (public for login flow)
companiesRouter.get("/:id", async (c) => {
  try {
    const { id } = c.req.param();

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        users: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    if (!company) {
      return c.json(
        { error: { message: "Company not found", code: "NOT_FOUND" } },
        404
      );
    }

    return c.json({
      data: {
        ...company,
        usersCount: company._count.users,
        _count: undefined,
      },
    });
  } catch (error) {
    return c.json(
      { error: { message: "Failed to fetch company", code: "FETCH_ERROR" } },
      500
    );
  }
});

// POST /api/companies - Create company (SUPERVISOR only)
companiesRouter.post("/", zValidator("json", CreateCompanySchema), async (c) => {
  try {
    requireRole(c, ["SUPERVISOR"]);
    const data = c.req.valid("json");

    const company = await prisma.company.create({
      data,
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    return c.json(
      {
        data: {
          ...company,
          usersCount: company._count.users,
          _count: undefined,
        },
      },
      201
    );
  } catch (error: any) {
    if (error instanceof Error && "status" in error) throw error;
    if (error.code === "P2002") {
      return c.json(
        { error: { message: "Company code already exists", code: "DUPLICATE_CODE" } },
        409
      );
    }
    return c.json(
      { error: { message: "Failed to create company", code: "CREATE_ERROR" } },
      500
    );
  }
});

// PUT /api/companies/:id - Update company (SUPERVISOR only)
companiesRouter.put(
  "/:id",
  zValidator("json", UpdateCompanySchema),
  async (c) => {
    try {
      const { id } = c.req.param();
      const auth = requireRole(c, ["SUPERVISOR"]);

      // Supervisor can only update their own company
      if (auth.companyId !== id) {
        return c.json(
          { error: { message: "Access denied", code: "FORBIDDEN" } },
          403
        );
      }

      const data = c.req.valid("json");

      const company = await prisma.company.update({
        where: { id },
        data,
        include: {
          _count: {
            select: { users: true },
          },
        },
      });

      return c.json({
        data: {
          ...company,
          usersCount: company._count.users,
          _count: undefined,
        },
      });
    } catch (error: any) {
      if (error instanceof Error && "status" in error) throw error;
      if (error.code === "P2025") {
        return c.json(
          { error: { message: "Company not found", code: "NOT_FOUND" } },
          404
        );
      }
      if (error.code === "P2002") {
        return c.json(
          { error: { message: "Company code already exists", code: "DUPLICATE_CODE" } },
          409
        );
      }
      return c.json(
        { error: { message: "Failed to update company", code: "UPDATE_ERROR" } },
        500
      );
    }
  }
);

// DELETE /api/companies/:id - Delete company (disabled for safety)
companiesRouter.delete("/:id", async (c) => {
  // Deleting companies is disabled - too dangerous for demo
  return c.json(
    { error: { message: "Company deletion is not allowed", code: "FORBIDDEN" } },
    403
  );
});

export { companiesRouter };
