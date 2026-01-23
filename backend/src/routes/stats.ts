import { Hono } from "hono";
import { prisma } from "../db";
import {
  requireAuth,
  requireContainerAccess,
  requireShipmentAccess,
  requirePOAccess,
  requireSameCompanyUser,
} from "../auth/guards";

const statsRouter = new Hono();

// GET /api/stats/container/:id - Stats for a container
statsRouter.get("/container/:id", async (c) => {
  try {
    const { id } = c.req.param();

    // Auth guard - check container access
    await requireContainerAccess(c, id);

    const container = await prisma.container.findUnique({
      where: { id },
      include: {
        bales: true,
        _count: {
          select: { bales: true },
        },
      },
    });

    if (!container) {
      return c.json(
        { error: { message: "Container not found", code: "NOT_FOUND" } },
        404
      );
    }

    const stats = {
      totalBales: container._count.bales,
      acceptedBales: container.bales.filter((b) => b.decision === "ACCEPT").length,
      rejectedBales: container.bales.filter((b) => b.decision === "REJECT").length,
      acceptRate:
        container._count.bales > 0
          ? (
              (container.bales.filter((b) => b.decision === "ACCEPT").length /
                container._count.bales) *
              100
            ).toFixed(2)
          : 0,
    };

    return c.json({
      data: {
        containerId: id,
        ...stats,
      },
    });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch container stats", code: "FETCH_ERROR" } },
      500
    );
  }
});

// GET /api/stats/shipment/:id - Stats for a shipment
statsRouter.get("/shipment/:id", async (c) => {
  try {
    const { id } = c.req.param();

    // Auth guard - check shipment access
    await requireShipmentAccess(c, id);

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        containers: {
          include: {
            bales: true,
            _count: {
              select: { bales: true },
            },
          },
        },
        bales: true,
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

    const allBales = shipment.bales;
    const stats = {
      totalContainers: shipment._count.containers,
      totalBales: allBales.length,
      acceptedBales: allBales.filter((b) => b.decision === "ACCEPT").length,
      rejectedBales: allBales.filter((b) => b.decision === "REJECT").length,
      acceptRate:
        allBales.length > 0
          ? (
              (allBales.filter((b) => b.decision === "ACCEPT").length / allBales.length) *
              100
            ).toFixed(2)
          : 0,
    };

    return c.json({
      data: {
        shipmentId: id,
        ...stats,
      },
    });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch shipment stats", code: "FETCH_ERROR" } },
      500
    );
  }
});

// GET /api/stats/po/:id - Stats for a PO
statsRouter.get("/po/:id", async (c) => {
  try {
    const { id } = c.req.param();

    // Auth guard - check PO access
    await requirePOAccess(c, id);

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        shipments: {
          include: {
            _count: {
              select: { containers: true },
            },
          },
        },
        bales: true,
        _count: {
          select: { shipments: true, bales: true },
        },
      },
    });

    if (!po) {
      return c.json(
        { error: { message: "Purchase order not found", code: "NOT_FOUND" } },
        404
      );
    }

    const allBales = po.bales;
    const stats = {
      totalShipments: po._count.shipments,
      totalContainers: po.shipments.reduce(
        (sum, s) => sum + s._count.containers,
        0
      ),
      totalBales: allBales.length,
      acceptedBales: allBales.filter((b) => b.decision === "ACCEPT").length,
      rejectedBales: allBales.filter((b) => b.decision === "REJECT").length,
      acceptRate:
        allBales.length > 0
          ? (
              (allBales.filter((b) => b.decision === "ACCEPT").length / allBales.length) *
              100
            ).toFixed(2)
          : 0,
    };

    return c.json({
      data: {
        poId: id,
        ...stats,
      },
    });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch PO stats", code: "FETCH_ERROR" } },
      500
    );
  }
});

// GET /api/stats/user/:id - Today's stats for user (inspector)
statsRouter.get("/user/:id", async (c) => {
  try {
    const { id } = c.req.param();

    // Auth guard - require auth and same company
    requireAuth(c);
    await requireSameCompanyUser(c, id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return c.json(
        { error: { message: "User not found", code: "NOT_FOUND" } },
        404
      );
    }

    const todayBales = await prisma.bale.findMany({
      where: {
        inspectorId: id,
        createdAt: {
          gte: today,
        },
      },
    });

    const stats = {
      totalInspected: todayBales.length,
      acceptedBales: todayBales.filter((b) => b.decision === "ACCEPT").length,
      rejectedBales: todayBales.filter((b) => b.decision === "REJECT").length,
      acceptRate:
        todayBales.length > 0
          ? (
              (todayBales.filter((b) => b.decision === "ACCEPT").length /
                todayBales.length) *
              100
            ).toFixed(2)
          : 0,
    };

    return c.json({
      data: {
        userId: id,
        userName: user.name,
        date: today.toISOString().split("T")[0],
        ...stats,
      },
    });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch user stats", code: "FETCH_ERROR" } },
      500
    );
  }
});

// Keep the old endpoint for backwards compatibility
statsRouter.get("/inspector/:id", async (c) => {
  try {
    const { id } = c.req.param();

    // Auth guard - require auth and same company (same as user stats)
    requireAuth(c);
    await requireSameCompanyUser(c, id);

    // Redirect to the new endpoint
    return c.redirect(`/api/stats/user/${id}`);
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch inspector stats", code: "FETCH_ERROR" } },
      500
    );
  }
});

export { statsRouter };
