import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../db";
import {
  requireAuth,
  requireRole,
  requireContainerAccess,
} from "../auth/guards";

const assignmentsRouter = new Hono();

// Schemas
const createAssignmentSchema = z.object({
  containerId: z.string(),
  inspectorId: z.string(),
  rangeStart: z.number().int().positive(),
  rangeEnd: z.number().int().positive(),
});

const updateAssignmentSchema = z.object({
  rangeStart: z.number().int().positive().optional(),
  rangeEnd: z.number().int().positive().optional(),
});

// GET /api/assignments?containerId=xxx&inspectorId=xxx - List assignments
assignmentsRouter.get("/", async (c) => {
  try {
    requireAuth(c);

    const containerId = c.req.query("containerId");
    const inspectorId = c.req.query("inspectorId");

    if (!containerId && !inspectorId) {
      return c.json(
        {
          error: {
            message: "containerId or inspectorId is required",
            code: "MISSING_PARAM",
          },
        },
        400
      );
    }

    // If containerId provided, verify access
    if (containerId) {
      await requireContainerAccess(c, containerId);
    }

    const assignments = await prisma.inspectorAssignment.findMany({
      where: {
        ...(containerId && { containerId }),
        ...(inspectorId && { inspectorId }),
      },
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
            shipmentId: true,
          },
        },
      },
    });

    return c.json({ data: assignments });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      {
        error: {
          message: "Failed to fetch assignments",
          code: "FETCH_ERROR",
        },
      },
      500
    );
  }
});

// GET /api/assignments/:id - Get single assignment
assignmentsRouter.get("/:id", async (c) => {
  try {
    requireAuth(c);

    const { id } = c.req.param();

    const assignment = await prisma.inspectorAssignment.findUnique({
      where: { id },
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
          include: {
            shipment: {
              include: {
                purchaseOrder: true,
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      return c.json(
        { error: { message: "Assignment not found", code: "NOT_FOUND" } },
        404
      );
    }

    // Verify container access for this assignment
    await requireContainerAccess(c, assignment.containerId);

    return c.json({ data: assignment });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch assignment", code: "FETCH_ERROR" } },
      500
    );
  }
});

// POST /api/assignments - Create
assignmentsRouter.post(
  "/",
  zValidator("json", createAssignmentSchema),
  async (c) => {
    try {
      requireRole(c, ["SUPERVISOR"]);

      const data = c.req.valid("json");

      // Verify container access
      await requireContainerAccess(c, data.containerId);

      // Validate that rangeEnd >= rangeStart
      if (data.rangeEnd < data.rangeStart) {
        return c.json(
          {
            error: {
              message: "rangeEnd must be greater than or equal to rangeStart",
              code: "INVALID_RANGE",
            },
          },
          400
        );
      }

      const assignment = await prisma.inspectorAssignment.create({
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
              shipmentId: true,
            },
          },
        },
      });

      return c.json({ data: assignment }, 201);
    } catch (error) {
      if (error instanceof Error && "status" in error) throw error;
      return c.json(
        {
          error: {
            message: "Failed to create assignment",
            code: "CREATE_ERROR",
          },
        },
        500
      );
    }
  }
);

// PUT /api/assignments/:id - Update
assignmentsRouter.put(
  "/:id",
  zValidator("json", updateAssignmentSchema),
  async (c) => {
    try {
      requireRole(c, ["SUPERVISOR"]);

      const { id } = c.req.param();
      const data = c.req.valid("json");

      // Look up assignment first to get containerId
      const existingAssignment = await prisma.inspectorAssignment.findUnique({
        where: { id },
        select: { containerId: true },
      });

      if (!existingAssignment) {
        return c.json(
          { error: { message: "Assignment not found", code: "NOT_FOUND" } },
          404
        );
      }

      // Verify container access
      await requireContainerAccess(c, existingAssignment.containerId);

      // If both provided, validate range
      if (data.rangeStart !== undefined && data.rangeEnd !== undefined) {
        if (data.rangeEnd < data.rangeStart) {
          return c.json(
            {
              error: {
                message: "rangeEnd must be greater than or equal to rangeStart",
                code: "INVALID_RANGE",
              },
            },
            400
          );
        }
      }

      const assignment = await prisma.inspectorAssignment.update({
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
              shipmentId: true,
            },
          },
        },
      });

      return c.json({ data: assignment });
    } catch (error) {
      if (error instanceof Error && "status" in error) throw error;
      if ((error as any).code === "P2025") {
        return c.json(
          { error: { message: "Assignment not found", code: "NOT_FOUND" } },
          404
        );
      }
      return c.json(
        {
          error: { message: "Failed to update assignment", code: "UPDATE_ERROR" },
        },
        500
      );
    }
  }
);

// DELETE /api/assignments/:id - Delete
assignmentsRouter.delete("/:id", async (c) => {
  try {
    requireRole(c, ["SUPERVISOR"]);

    const { id } = c.req.param();

    // Look up assignment first to get containerId
    const existingAssignment = await prisma.inspectorAssignment.findUnique({
      where: { id },
      select: { containerId: true },
    });

    if (!existingAssignment) {
      return c.json(
        { error: { message: "Assignment not found", code: "NOT_FOUND" } },
        404
      );
    }

    // Verify container access
    await requireContainerAccess(c, existingAssignment.containerId);

    await prisma.inspectorAssignment.delete({
      where: { id },
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    if ((error as any).code === "P2025") {
      return c.json(
        { error: { message: "Assignment not found", code: "NOT_FOUND" } },
        404
      );
    }
    return c.json(
      {
        error: { message: "Failed to delete assignment", code: "DELETE_ERROR" },
      },
      500
    );
  }
});

export { assignmentsRouter };
