import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../db";
import { requireRole, requirePOAccess } from "../auth/guards";

const poAssignmentsRouter = new Hono();

const CreateAssignmentSchema = z.object({
  poId: z.string(),
  userId: z.string(),
});

// GET /api/po-assignments?poId=xxx&userId=xxx
poAssignmentsRouter.get("/", async (c) => {
  try {
    const auth = requireRole(c, ["SUPERVISOR"]);
    const poId = c.req.query("poId");
    const userId = c.req.query("userId");

    // If poId is provided, verify access to that PO
    if (poId) {
      await requirePOAccess(c, poId);
    }

    // Build where clause - if no poId, only return assignments for POs in auth.companyId
    const whereClause: {
      poId?: string;
      userId?: string;
      purchaseOrder?: { companyId: string };
    } = {};

    if (poId) {
      whereClause.poId = poId;
    } else {
      // No poId provided - filter by company
      whereClause.purchaseOrder = { companyId: auth.companyId };
    }

    if (userId) {
      whereClause.userId = userId;
    }

    const assignments = await prisma.pOUserAssignment.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        purchaseOrder: { select: { id: true, poNumber: true, customerName: true } },
      },
    });

    return c.json({ data: assignments });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch PO assignments", code: "FETCH_ERROR" } },
      500
    );
  }
});

// GET /api/po-assignments/:id
poAssignmentsRouter.get("/:id", async (c) => {
  try {
    requireRole(c, ["SUPERVISOR"]);
    const { id } = c.req.param();

    const assignment = await prisma.pOUserAssignment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        purchaseOrder: { select: { id: true, poNumber: true, customerName: true } },
      },
    });

    if (!assignment) {
      return c.json(
        { error: { message: "PO assignment not found", code: "NOT_FOUND" } },
        404
      );
    }

    // Verify access to the PO
    await requirePOAccess(c, assignment.poId);

    return c.json({ data: assignment });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch PO assignment", code: "FETCH_ERROR" } },
      500
    );
  }
});

// POST /api/po-assignments
poAssignmentsRouter.post("/", zValidator("json", CreateAssignmentSchema), async (c) => {
  try {
    requireRole(c, ["SUPERVISOR"]);
    const data = c.req.valid("json");

    // Verify access to the PO
    await requirePOAccess(c, data.poId);

    const assignment = await prisma.pOUserAssignment.create({
      data,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        purchaseOrder: { select: { id: true, poNumber: true, customerName: true } },
      },
    });

    return c.json({ data: assignment }, 201);
  } catch (error: any) {
    if (error instanceof Error && "status" in error) throw error;
    if (error.code === "P2002") {
      return c.json(
        { error: { message: "User already assigned to this PO", code: "DUPLICATE_ASSIGNMENT" } },
        409
      );
    }
    return c.json(
      { error: { message: "Failed to create PO assignment", code: "CREATE_ERROR" } },
      500
    );
  }
});

// DELETE /api/po-assignments/:id
poAssignmentsRouter.delete("/:id", async (c) => {
  try {
    requireRole(c, ["SUPERVISOR"]);
    const { id } = c.req.param();

    // Look up assignment first to get poId for access check
    const assignment = await prisma.pOUserAssignment.findUnique({
      where: { id },
      select: { poId: true },
    });

    if (!assignment) {
      return c.json(
        { error: { message: "PO assignment not found", code: "NOT_FOUND" } },
        404
      );
    }

    // Verify access to the PO
    await requirePOAccess(c, assignment.poId);

    await prisma.pOUserAssignment.delete({ where: { id } });

    return c.body(null, 204);
  } catch (error: any) {
    if (error instanceof Error && "status" in error) throw error;
    if (error.code === "P2025") {
      return c.json(
        { error: { message: "PO assignment not found", code: "NOT_FOUND" } },
        404
      );
    }
    return c.json(
      { error: { message: "Failed to delete PO assignment", code: "DELETE_ERROR" } },
      500
    );
  }
});

export { poAssignmentsRouter };
