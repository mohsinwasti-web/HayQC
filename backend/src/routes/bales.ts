import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../db";
import {
  requireAuth,
  requireRole,
  requireContainerAccess,
  requireBaleAccess,
  canCreateBales,
} from "../auth/guards";

const balesRouter = new Hono();

const DecisionSchema = z.enum(["ACCEPT", "REJECT"]);

// Schemas
const createBaleSchema = z.object({
  poId: z.string(),
  shipmentId: z.string(),
  containerId: z.string(),
  inspectorId: z.string(),
  baleNumber: z.number().int().positive(),
  baleIdDisplay: z.string().min(1),
  weightKg: z.number().positive(),
  moisturePct: z.number().min(0).max(100).optional(),
  color: z.string().min(1),
  stems: z.string().min(1),
  wetness: z.string().min(1),
  contamination: z.boolean().optional().default(false),
  mixedMaterial: z.boolean().optional().default(false),
  mold: z.boolean().optional().default(false),
  grade: z.string().min(1),
  decision: DecisionSchema,
  rejectReason: z.string().optional(),
  photo1Url: z.string().optional(),
  photo2Url: z.string().optional(),
  notes: z.string().optional(),
});

const updateBaleSchema = z.object({
  weightKg: z.number().positive().optional(),
  moisturePct: z.number().min(0).max(100).optional(),
  color: z.string().optional(),
  stems: z.string().optional(),
  wetness: z.string().optional(),
  contamination: z.boolean().optional(),
  mixedMaterial: z.boolean().optional(),
  mold: z.boolean().optional(),
  grade: z.string().optional(),
  decision: DecisionSchema.optional(),
  rejectReason: z.string().optional(),
  photo1Url: z.string().optional(),
  photo2Url: z.string().optional(),
  notes: z.string().optional(),
  syncStatus: z.enum(["PENDING", "SYNCED", "FAILED"]).optional(),
});

const createBulkBalesSchema = z.object({
  bales: z.array(createBaleSchema),
});

// GET /api/bales?containerId=xxx&shipmentId=xxx&poId=xxx&inspectorId=xxx&limit=100
balesRouter.get("/", async (c) => {
  try {
    const auth = requireAuth(c);

    const containerId = c.req.query("containerId");
    const shipmentId = c.req.query("shipmentId");
    const poId = c.req.query("poId");
    const inspectorId = c.req.query("inspectorId");
    const limit = parseInt(c.req.query("limit") || "100", 10);

    // If containerId provided, validate access
    if (containerId) {
      await requireContainerAccess(c, containerId);
    }

    const where: any = {};
    if (containerId) where.containerId = containerId;
    if (shipmentId) where.shipmentId = shipmentId;
    if (poId) where.poId = poId;
    if (inspectorId) where.inspectorId = inspectorId;

    // If no filter provided, scope to user's company via container->shipment->PO chain
    if (!containerId && !shipmentId && !poId) {
      where.container = {
        shipment: {
          purchaseOrder: {
            companyId: auth.companyId,
          },
        },
      };
    }

    const bales = await prisma.bale.findMany({
      where,
      include: {
        inspector: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        container: {
          select: {
            id: true,
            containerCode: true,
            containerNumber: true,
          },
        },
      },
      take: limit,
      orderBy: { baleNumber: "asc" },
    });

    return c.json({ data: bales });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch bales", code: "FETCH_ERROR" } },
      500
    );
  }
});

// GET /api/bales/:id - Get with all relations
balesRouter.get("/:id", async (c) => {
  try {
    const { id } = c.req.param();

    await requireBaleAccess(c, id);

    const bale = await prisma.bale.findUnique({
      where: { id },
      include: {
        container: {
          include: {
            shipment: {
              include: {
                purchaseOrder: true,
              },
            },
          },
        },
        inspector: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!bale) {
      return c.json(
        { error: { message: "Bale not found", code: "NOT_FOUND" } },
        404
      );
    }

    return c.json({ data: bale });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch bale", code: "FETCH_ERROR" } },
      500
    );
  }
});

// POST /api/bales - Create
balesRouter.post("/", zValidator("json", createBaleSchema), async (c) => {
  try {
    const auth = requireAuth(c);

    // Only INSPECTOR and SUPERVISOR can create bales
    if (!canCreateBales(auth)) {
      return c.json(
        {
          error: {
            message: "Access denied. Only inspectors and supervisors can create bales.",
            code: "FORBIDDEN",
          },
        },
        403
      );
    }

    const data = c.req.valid("json");

    // Validate container access
    await requireContainerAccess(c, data.containerId);

    const bale = await prisma.bale.create({
      data,
      include: {
        inspector: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        container: {
          select: {
            id: true,
            containerCode: true,
            containerNumber: true,
          },
        },
      },
    });

    return c.json({ data: bale }, 201);
  } catch (error: any) {
    if (error instanceof Error && "status" in error) throw error;
    if (error.code === "P2002") {
      return c.json(
        {
          error: {
            message: "Bale number already exists for this container",
            code: "DUPLICATE_BALE",
          },
        },
        409
      );
    }
    return c.json(
      { error: { message: "Failed to create bale", code: "CREATE_ERROR" } },
      500
    );
  }
});

// PUT /api/bales/:id - Update
balesRouter.put("/:id", zValidator("json", updateBaleSchema), async (c) => {
  try {
    const { id } = c.req.param();

    // Only SUPERVISOR can update bales
    requireRole(c, ["SUPERVISOR"]);

    // Validate bale access
    await requireBaleAccess(c, id);

    const data = c.req.valid("json");

    const bale = await prisma.bale.update({
      where: { id },
      data,
      include: {
        inspector: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        container: {
          select: {
            id: true,
            containerCode: true,
            containerNumber: true,
          },
        },
      },
    });

    return c.json({ data: bale });
  } catch (error: any) {
    if (error instanceof Error && "status" in error) throw error;
    if (error.code === "P2025") {
      return c.json(
        { error: { message: "Bale not found", code: "NOT_FOUND" } },
        404
      );
    }
    return c.json(
      { error: { message: "Failed to update bale", code: "UPDATE_ERROR" } },
      500
    );
  }
});

// DELETE /api/bales/:id - Delete
balesRouter.delete("/:id", async (c) => {
  try {
    const { id } = c.req.param();

    // Only SUPERVISOR can delete bales
    requireRole(c, ["SUPERVISOR"]);

    // Validate bale access
    await requireBaleAccess(c, id);

    await prisma.bale.delete({
      where: { id },
    });

    return c.body(null, 204);
  } catch (error: any) {
    if (error instanceof Error && "status" in error) throw error;
    if (error.code === "P2025") {
      return c.json(
        { error: { message: "Bale not found", code: "NOT_FOUND" } },
        404
      );
    }
    return c.json(
      { error: { message: "Failed to delete bale", code: "DELETE_ERROR" } },
      500
    );
  }
});

// POST /api/bales/bulk - Create multiple bales
balesRouter.post(
  "/bulk",
  zValidator("json", createBulkBalesSchema),
  async (c) => {
    try {
      const auth = requireAuth(c);

      // Only INSPECTOR and SUPERVISOR can create bales
      if (!canCreateBales(auth)) {
        return c.json(
          {
            error: {
              message: "Access denied. Only inspectors and supervisors can create bales.",
              code: "FORBIDDEN",
            },
          },
          403
        );
      }

      const { bales } = c.req.valid("json");

      // Validate container access for each unique containerId
      const uniqueContainerIds = [...new Set(bales.map((b) => b.containerId))];
      for (const containerId of uniqueContainerIds) {
        await requireContainerAccess(c, containerId);
      }

      const created = await Promise.all(
        bales.map((bale) =>
          prisma.bale.create({
            data: bale,
            include: {
              inspector: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
              container: {
                select: {
                  id: true,
                  containerCode: true,
                  containerNumber: true,
                },
              },
            },
          })
        )
      );

      return c.json({ data: { count: created.length, bales: created } }, 201);
    } catch (error: any) {
      if (error instanceof Error && "status" in error) throw error;
      if (error.code === "P2002") {
        return c.json(
          {
            error: {
              message: "One or more bale numbers already exist",
              code: "DUPLICATE_BALE",
            },
          },
          409
        );
      }
      return c.json(
        { error: { message: "Failed to create bales", code: "CREATE_ERROR" } },
        500
      );
    }
  }
);

export { balesRouter };
