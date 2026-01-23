import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../db";
import {
  requireRole,
  requirePOAccess,
  requireShipmentAccess,
} from "../auth/guards";

const shipmentsRouter = new Hono();

const ShipmentStatusSchema = z.enum([
  "PENDING",
  "IN_TRANSIT",
  "DELIVERED",
  "INSPECTED",
  "COMPLETED",
]);

// Schemas
const createShipmentSchema = z.object({
  poId: z.string(),
  shipmentCode: z.string().min(1),
  supplierName: z.string().min(1),
  shipmentDate: z.string().datetime(),
});

const updateShipmentSchema = z.object({
  shipmentCode: z.string().optional(),
  supplierName: z.string().optional(),
  shipmentDate: z.string().datetime().optional(),
  status: ShipmentStatusSchema.optional(),
});

// GET /api/shipments?poId=xxx - List with container/bale counts
shipmentsRouter.get("/", async (c) => {
  try {
    const poId = c.req.query("poId");

    if (!poId) {
      return c.json(
        { error: { message: "poId is required", code: "MISSING_PARAM" } },
        400
      );
    }

    // Verify user has access to this PO
    await requirePOAccess(c, poId);

    const shipments = await prisma.shipment.findMany({
      where: { poId },
      include: {
        _count: {
          select: { containers: true, bales: true },
        },
      },
      orderBy: { shipmentDate: "desc" },
    });

    return c.json({
      data: shipments.map((shipment) => ({
        ...shipment,
        containersCount: shipment._count.containers,
        balesCount: shipment._count.bales,
        _count: undefined,
      })),
    });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch shipments", code: "FETCH_ERROR" } },
      500
    );
  }
});

// GET /api/shipments/:id - Get with containers
shipmentsRouter.get("/:id", async (c) => {
  try {
    const { id } = c.req.param();

    // Verify access
    await requireShipmentAccess(c, id);

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        purchaseOrder: true,
        containers: {
          include: {
            _count: {
              select: { bales: true, assignments: true },
            },
          },
        },
        _count: {
          select: { containers: true, bales: true },
        },
      },
    });

    if (!shipment) {
      return c.json(
        { error: { message: "Shipment not found", code: "NOT_FOUND" } },
        404
      );
    }

    return c.json({
      data: {
        ...shipment,
        containersCount: shipment._count.containers,
        balesCount: shipment._count.bales,
        containers: shipment.containers.map((container) => ({
          ...container,
          balesCount: container._count.bales,
          assignmentsCount: container._count.assignments,
          _count: undefined,
        })),
        _count: undefined,
      },
    });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch shipment", code: "FETCH_ERROR" } },
      500
    );
  }
});

// POST /api/shipments - Create (SUPERVISOR only)
shipmentsRouter.post(
  "/",
  zValidator("json", createShipmentSchema),
  async (c) => {
    try {
      const data = c.req.valid("json");

      // Verify SUPERVISOR role and access to PO
      requireRole(c, ["SUPERVISOR"]);
      await requirePOAccess(c, data.poId);

      const shipment = await prisma.shipment.create({
        data: {
          ...data,
          shipmentDate: new Date(data.shipmentDate),
        },
        include: {
          _count: {
            select: { containers: true, bales: true },
          },
        },
      });

      // Update PO status if it's OPEN
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: data.poId },
      });

      if (po && po.status === "OPEN") {
        await prisma.purchaseOrder.update({
          where: { id: data.poId },
          data: { status: "IN_PROGRESS" },
        });
      }

      return c.json(
        {
          data: {
            ...shipment,
            containersCount: shipment._count.containers,
            balesCount: shipment._count.bales,
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
              message: "Shipment code already exists for this PO",
              code: "DUPLICATE_SHIPMENT",
            },
          },
          409
        );
      }
      return c.json(
        {
          error: { message: "Failed to create shipment", code: "CREATE_ERROR" },
        },
        500
      );
    }
  }
);

// PUT /api/shipments/:id - Update (SUPERVISOR only)
shipmentsRouter.put(
  "/:id",
  zValidator("json", updateShipmentSchema),
  async (c) => {
    try {
      const { id } = c.req.param();
      const data = c.req.valid("json");

      // Verify SUPERVISOR role and access to shipment
      requireRole(c, ["SUPERVISOR"]);
      await requireShipmentAccess(c, id);

      const updateData: any = { ...data };
      if (data.shipmentDate) {
        updateData.shipmentDate = new Date(data.shipmentDate);
      }

      const shipment = await prisma.shipment.update({
        where: { id },
        data: updateData,
        include: {
          _count: {
            select: { containers: true, bales: true },
          },
        },
      });

      return c.json({
        data: {
          ...shipment,
          containersCount: shipment._count.containers,
          balesCount: shipment._count.bales,
          _count: undefined,
        },
      });
    } catch (error: any) {
      if (error instanceof Error && "status" in error) throw error;
      if (error.code === "P2025") {
        return c.json(
          { error: { message: "Shipment not found", code: "NOT_FOUND" } },
          404
        );
      }
      if (error.code === "P2002") {
        return c.json(
          {
            error: {
              message: "Shipment code already exists for this PO",
              code: "DUPLICATE_SHIPMENT",
            },
          },
          409
        );
      }
      return c.json(
        {
          error: { message: "Failed to update shipment", code: "UPDATE_ERROR" },
        },
        500
      );
    }
  }
);

// DELETE /api/shipments/:id - Delete (SUPERVISOR only)
shipmentsRouter.delete("/:id", async (c) => {
  try {
    const { id } = c.req.param();

    // Verify SUPERVISOR role and access to shipment
    requireRole(c, ["SUPERVISOR"]);
    await requireShipmentAccess(c, id);

    await prisma.shipment.delete({
      where: { id },
    });

    return c.body(null, 204);
  } catch (error: any) {
    if (error instanceof Error && "status" in error) throw error;
    if (error.code === "P2025") {
      return c.json(
        { error: { message: "Shipment not found", code: "NOT_FOUND" } },
        404
      );
    }
    return c.json(
      { error: { message: "Failed to delete shipment", code: "DELETE_ERROR" } },
      500
    );
  }
});

export { shipmentsRouter };
