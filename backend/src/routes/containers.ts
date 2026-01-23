import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../db";
import {
  requireRole,
  requireShipmentAccess,
  requireContainerAccess,
} from "../auth/guards";

const containersRouter = new Hono();

const ContainerStatusSchema = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "ON_HOLD",
]);

// Schemas
const createContainerSchema = z.object({
  shipmentId: z.string(),
  containerCode: z.string().min(1),
  containerNumber: z.string().min(1),
  itemType: z.string().min(1),
  balePress: z.string().min(1),
  baleSize: z.string().min(1),
  avgExpectedWeight: z.number().positive(),
});

const updateContainerSchema = z.object({
  containerCode: z.string().optional(),
  containerNumber: z.string().optional(),
  itemType: z.string().optional(),
  balePress: z.string().optional(),
  baleSize: z.string().optional(),
  avgExpectedWeight: z.number().positive().optional(),
  status: ContainerStatusSchema.optional(),
});

// GET /api/containers?shipmentId=xxx - List with bale/assignment counts
containersRouter.get("/", async (c) => {
  try {
    const shipmentId = c.req.query("shipmentId");

    if (!shipmentId) {
      return c.json(
        { error: { message: "shipmentId is required", code: "MISSING_PARAM" } },
        400
      );
    }

    // Require auth and shipment access
    await requireShipmentAccess(c, shipmentId);

    const containers = await prisma.container.findMany({
      where: { shipmentId },
      include: {
        _count: {
          select: { bales: true, assignments: true },
        },
      },
      orderBy: { containerCode: "asc" },
    });

    return c.json({
      data: containers.map((container) => ({
        ...container,
        balesCount: container._count.bales,
        assignmentsCount: container._count.assignments,
        _count: undefined,
      })),
    });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch containers", code: "FETCH_ERROR" } },
      500
    );
  }
});

// GET /api/containers/:id - Get with shipment, PO, assignments, and bales
containersRouter.get("/:id", async (c) => {
  try {
    const { id } = c.req.param();

    // Require container access
    await requireContainerAccess(c, id);

    const container = await prisma.container.findUnique({
      where: { id },
      include: {
        shipment: {
          include: {
            purchaseOrder: true,
          },
        },
        assignments: {
          include: {
            inspector: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
        bales: {
          include: {
            inspector: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { baleNumber: "asc" },
        },
        _count: {
          select: { bales: true, assignments: true },
        },
      },
    });

    if (!container) {
      return c.json(
        { error: { message: "Container not found", code: "NOT_FOUND" } },
        404
      );
    }

    return c.json({
      data: {
        ...container,
        balesCount: container._count.bales,
        assignmentsCount: container._count.assignments,
        _count: undefined,
      },
    });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch container", code: "FETCH_ERROR" } },
      500
    );
  }
});

// POST /api/containers - Create
containersRouter.post(
  "/",
  zValidator("json", createContainerSchema),
  async (c) => {
    try {
      const data = c.req.valid("json");

      // Require SUPERVISOR role and shipment access
      requireRole(c, ["SUPERVISOR"]);
      await requireShipmentAccess(c, data.shipmentId);

      const container = await prisma.container.create({
        data,
        include: {
          _count: {
            select: { bales: true, assignments: true },
          },
        },
      });

      return c.json(
        {
          data: {
            ...container,
            balesCount: container._count.bales,
            assignmentsCount: container._count.assignments,
            _count: undefined,
          },
        },
        201
      );
    } catch (error: any) {
      if (error instanceof Error && "status" in error) throw error;
      if (error.code === "P2002") {
        return c.json(
          {
            error: {
              message: "Container code already exists for this shipment",
              code: "DUPLICATE_CONTAINER",
            },
          },
          409
        );
      }
      return c.json(
        {
          error: { message: "Failed to create container", code: "CREATE_ERROR" },
        },
        500
      );
    }
  }
);

// PUT /api/containers/:id - Update
containersRouter.put(
  "/:id",
  zValidator("json", updateContainerSchema),
  async (c) => {
    try {
      const { id } = c.req.param();
      const data = c.req.valid("json");

      // Require SUPERVISOR role and container access
      requireRole(c, ["SUPERVISOR"]);
      await requireContainerAccess(c, id);

      const container = await prisma.container.update({
        where: { id },
        data,
        include: {
          _count: {
            select: { bales: true, assignments: true },
          },
        },
      });

      return c.json({
        data: {
          ...container,
          balesCount: container._count.bales,
          assignmentsCount: container._count.assignments,
          _count: undefined,
        },
      });
    } catch (error: any) {
      if (error instanceof Error && "status" in error) throw error;
      if (error.code === "P2025") {
        return c.json(
          { error: { message: "Container not found", code: "NOT_FOUND" } },
          404
        );
      }
      if (error.code === "P2002") {
        return c.json(
          {
            error: {
              message: "Container code already exists for this shipment",
              code: "DUPLICATE_CONTAINER",
            },
          },
          409
        );
      }
      return c.json(
        {
          error: { message: "Failed to update container", code: "UPDATE_ERROR" },
        },
        500
      );
    }
  }
);

// DELETE /api/containers/:id - Delete
containersRouter.delete("/:id", async (c) => {
  try {
    const { id } = c.req.param();

    // Require SUPERVISOR role and container access
    requireRole(c, ["SUPERVISOR"]);
    await requireContainerAccess(c, id);

    await prisma.container.delete({
      where: { id },
    });

    return c.body(null, 204);
  } catch (error: any) {
    if (error instanceof Error && "status" in error) throw error;
    if (error.code === "P2025") {
      return c.json(
        { error: { message: "Container not found", code: "NOT_FOUND" } },
        404
      );
    }
    return c.json(
      { error: { message: "Failed to delete container", code: "DELETE_ERROR" } },
      500
    );
  }
});

export { containersRouter };
