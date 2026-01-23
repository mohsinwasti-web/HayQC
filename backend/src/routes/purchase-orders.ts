import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../db";
import {
  requireAuth,
  requireRole,
  requirePOAccess,
} from "../auth/guards";

const purchaseOrdersRouter = new Hono();

const POStatusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

// Schemas
const createPOSchema = z.object({
  poNumber: z.string().min(1),
  customerName: z.string().min(1),
  product: z.string().min(1),
  contractQtyMt: z.number().positive(),
  poDate: z.string().datetime(),
  paymentTerms: z.string().optional(),
  pricePerMt: z.number().positive().optional(),
});

const updatePOSchema = z.object({
  poNumber: z.string().optional(),
  customerName: z.string().optional(),
  product: z.string().optional(),
  contractQtyMt: z.number().positive().optional(),
  poDate: z.string().datetime().optional(),
  paymentTerms: z.string().optional(),
  pricePerMt: z.number().positive().optional(),
  status: POStatusSchema.optional(),
});

// GET /api/purchase-orders - List POs for current user's company
// Supervisors/Inspectors see all, Customers/Suppliers see only assigned
purchaseOrdersRouter.get("/", async (c) => {
  try {
    const auth = requireAuth(c);
    const status = c.req.query("status");

    // Base filter: user's company only (ignore client-provided companyId)
    const where: any = { companyId: auth.companyId };
    if (status) where.status = status;

    // For CUSTOMER/SUPPLIER, filter to assigned POs only
    if (auth.role === "CUSTOMER" || auth.role === "SUPPLIER") {
      where.userAssignments = {
        some: { userId: auth.userId },
      };
    }

    const pos = await prisma.purchaseOrder.findMany({
      where,
      include: {
        userAssignments: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        _count: {
          select: { shipments: true, bales: true, notes: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return c.json({
      data: pos.map((po) => ({
        ...po,
        shipmentsCount: po._count.shipments,
        balesCount: po._count.bales,
        notesCount: po._count.notes,
        _count: undefined,
      })),
    });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      {
        error: { message: "Failed to fetch purchase orders", code: "FETCH_ERROR" },
      },
      500
    );
  }
});

// GET /api/purchase-orders/:id - Get with shipments and userAssignments
purchaseOrdersRouter.get("/:id", async (c) => {
  try {
    const { id } = c.req.param();

    // Verify access (company scoping + assignment check)
    await requirePOAccess(c, id);

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        shipments: {
          include: {
            _count: { select: { containers: true, bales: true } },
          },
        },
        userAssignments: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        notes: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: { shipments: true, bales: true, notes: true },
        },
      },
    });

    if (!po) {
      return c.json(
        { error: { message: "Purchase order not found", code: "NOT_FOUND" } },
        404
      );
    }

    return c.json({
      data: {
        ...po,
        shipments: po.shipments.map((s) => ({
          ...s,
          containersCount: s._count.containers,
          balesCount: s._count.bales,
          _count: undefined,
        })),
        shipmentsCount: po._count.shipments,
        balesCount: po._count.bales,
        notesCount: po._count.notes,
        _count: undefined,
      },
    });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch purchase order", code: "FETCH_ERROR" } },
      500
    );
  }
});

// POST /api/purchase-orders - Create (SUPERVISOR only)
purchaseOrdersRouter.post(
  "/",
  zValidator("json", createPOSchema),
  async (c) => {
    try {
      const auth = requireRole(c, ["SUPERVISOR"]);
      const data = c.req.valid("json");

      // Force companyId from auth (never trust client)
      const po = await prisma.purchaseOrder.create({
        data: {
          ...data,
          companyId: auth.companyId,
          poDate: new Date(data.poDate),
        },
        include: {
          userAssignments: {
            include: {
              user: { select: { id: true, name: true, email: true, role: true } },
            },
          },
          _count: {
            select: { shipments: true, bales: true, notes: true },
          },
        },
      });

      return c.json(
        {
          data: {
            ...po,
            shipmentsCount: po._count.shipments,
            balesCount: po._count.bales,
            notesCount: po._count.notes,
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
            error: { message: "PO number already exists for this company", code: "DUPLICATE_PO" },
          },
          409
        );
      }
      return c.json(
        {
          error: { message: "Failed to create purchase order", code: "CREATE_ERROR" },
        },
        500
      );
    }
  }
);

// PUT /api/purchase-orders/:id - Update (SUPERVISOR only)
purchaseOrdersRouter.put(
  "/:id",
  zValidator("json", updatePOSchema),
  async (c) => {
    try {
      const { id } = c.req.param();

      // Verify access and require SUPERVISOR role
      requireRole(c, ["SUPERVISOR"]);
      await requirePOAccess(c, id);

      const data = c.req.valid("json");

      const updateData: any = { ...data };
      if (data.poDate) {
        updateData.poDate = new Date(data.poDate);
      }

      const po = await prisma.purchaseOrder.update({
        where: { id },
        data: updateData,
        include: {
          userAssignments: {
            include: {
              user: { select: { id: true, name: true, email: true, role: true } },
            },
          },
          _count: {
            select: { shipments: true, bales: true, notes: true },
          },
        },
      });

      return c.json({
        data: {
          ...po,
          shipmentsCount: po._count.shipments,
          balesCount: po._count.bales,
          notesCount: po._count.notes,
          _count: undefined,
        },
      });
    } catch (error: any) {
      if (error instanceof Error && "status" in error) throw error;
      if (error.code === "P2025") {
        return c.json(
          { error: { message: "Purchase order not found", code: "NOT_FOUND" } },
          404
        );
      }
      if (error.code === "P2002") {
        return c.json(
          {
            error: { message: "PO number already exists for this company", code: "DUPLICATE_PO" },
          },
          409
        );
      }
      return c.json(
        {
          error: { message: "Failed to update purchase order", code: "UPDATE_ERROR" },
        },
        500
      );
    }
  }
);

// DELETE /api/purchase-orders/:id - Delete (SUPERVISOR only)
purchaseOrdersRouter.delete("/:id", async (c) => {
  try {
    const { id } = c.req.param();

    // Verify access and require SUPERVISOR role
    requireRole(c, ["SUPERVISOR"]);
    await requirePOAccess(c, id);

    await prisma.purchaseOrder.delete({
      where: { id },
    });

    return c.body(null, 204);
  } catch (error: any) {
    if (error instanceof Error && "status" in error) throw error;
    if (error.code === "P2025") {
      return c.json(
        { error: { message: "Purchase order not found", code: "NOT_FOUND" } },
        404
      );
    }
    return c.json(
      {
        error: { message: "Failed to delete purchase order", code: "DELETE_ERROR" },
      },
      500
    );
  }
});

export { purchaseOrdersRouter };
