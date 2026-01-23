import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { prisma } from "../db";
import type { AuthPayload } from "./jwt";

// Valid roles
export type UserRole = "INSPECTOR" | "SUPERVISOR" | "CUSTOMER" | "SUPPLIER";

// Get auth from context - returns null if not authenticated
export function getAuth(c: Context): AuthPayload | null {
  return c.get("auth");
}

// Require authentication - throws 401 if not authenticated
export function requireAuth(c: Context): AuthPayload {
  const auth = getAuth(c);
  if (!auth) {
    throw new HTTPException(401, { message: "Authentication required" });
  }
  return auth;
}

// Require specific roles - throws 403 if not authorized
export function requireRole(c: Context, allowedRoles: UserRole[]): AuthPayload {
  const auth = requireAuth(c);
  if (!allowedRoles.includes(auth.role as UserRole)) {
    throw new HTTPException(403, {
      message: `Access denied. Required roles: ${allowedRoles.join(", ")}`,
    });
  }
  return auth;
}

// Check if user can access a PO (company scoping + assignment check for customer/supplier)
export async function requirePOAccess(
  c: Context,
  poId: string
): Promise<AuthPayload> {
  const auth = requireAuth(c);

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: { companyId: true },
  });

  if (!po) {
    throw new HTTPException(404, { message: "Purchase order not found" });
  }

  // Company scoping - must be same company
  if (po.companyId !== auth.companyId) {
    throw new HTTPException(404, { message: "Purchase order not found" });
  }

  // For CUSTOMER/SUPPLIER, check if assigned to this PO
  if (auth.role === "CUSTOMER" || auth.role === "SUPPLIER") {
    const assignment = await prisma.pOUserAssignment.findUnique({
      where: {
        poId_userId: {
          poId,
          userId: auth.userId,
        },
      },
    });

    if (!assignment) {
      throw new HTTPException(403, {
        message: "You do not have access to this purchase order",
      });
    }
  }

  return auth;
}

// Check if user can access a shipment (via PO access)
export async function requireShipmentAccess(
  c: Context,
  shipmentId: string
): Promise<{ auth: AuthPayload; shipment: { poId: string } }> {
  const auth = requireAuth(c);

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      purchaseOrder: {
        select: { companyId: true },
      },
    },
  });

  if (!shipment) {
    throw new HTTPException(404, { message: "Shipment not found" });
  }

  // Company scoping
  if (shipment.purchaseOrder.companyId !== auth.companyId) {
    throw new HTTPException(404, { message: "Shipment not found" });
  }

  // For CUSTOMER/SUPPLIER, check PO assignment
  if (auth.role === "CUSTOMER" || auth.role === "SUPPLIER") {
    const assignment = await prisma.pOUserAssignment.findUnique({
      where: {
        poId_userId: {
          poId: shipment.poId,
          userId: auth.userId,
        },
      },
    });

    if (!assignment) {
      throw new HTTPException(403, {
        message: "You do not have access to this shipment",
      });
    }
  }

  return { auth, shipment: { poId: shipment.poId } };
}

// Check if user can access a container (via shipment -> PO access)
export async function requireContainerAccess(
  c: Context,
  containerId: string
): Promise<{
  auth: AuthPayload;
  container: { shipmentId: string; poId: string };
}> {
  const auth = requireAuth(c);

  const container = await prisma.container.findUnique({
    where: { id: containerId },
    include: {
      shipment: {
        include: {
          purchaseOrder: {
            select: { companyId: true },
          },
        },
      },
    },
  });

  if (!container) {
    throw new HTTPException(404, { message: "Container not found" });
  }

  // Company scoping
  if (container.shipment.purchaseOrder.companyId !== auth.companyId) {
    throw new HTTPException(404, { message: "Container not found" });
  }

  // For CUSTOMER/SUPPLIER, check PO assignment
  if (auth.role === "CUSTOMER" || auth.role === "SUPPLIER") {
    const assignment = await prisma.pOUserAssignment.findUnique({
      where: {
        poId_userId: {
          poId: container.shipment.poId,
          userId: auth.userId,
        },
      },
    });

    if (!assignment) {
      throw new HTTPException(403, {
        message: "You do not have access to this container",
      });
    }
  }

  return {
    auth,
    container: {
      shipmentId: container.shipmentId,
      poId: container.shipment.poId,
    },
  };
}

// Check if user can access a bale (via container -> shipment -> PO access)
export async function requireBaleAccess(
  c: Context,
  baleId: string
): Promise<{
  auth: AuthPayload;
  bale: { containerId: string; shipmentId: string; poId: string };
}> {
  const auth = requireAuth(c);

  const bale = await prisma.bale.findUnique({
    where: { id: baleId },
    include: {
      container: {
        include: {
          shipment: {
            include: {
              purchaseOrder: {
                select: { companyId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!bale) {
    throw new HTTPException(404, { message: "Bale not found" });
  }

  // Company scoping
  if (bale.container.shipment.purchaseOrder.companyId !== auth.companyId) {
    throw new HTTPException(404, { message: "Bale not found" });
  }

  // For CUSTOMER/SUPPLIER, check PO assignment
  if (auth.role === "CUSTOMER" || auth.role === "SUPPLIER") {
    const assignment = await prisma.pOUserAssignment.findUnique({
      where: {
        poId_userId: {
          poId: bale.poId,
          userId: auth.userId,
        },
      },
    });

    if (!assignment) {
      throw new HTTPException(403, {
        message: "You do not have access to this bale",
      });
    }
  }

  return {
    auth,
    bale: {
      containerId: bale.containerId,
      shipmentId: bale.shipmentId,
      poId: bale.poId,
    },
  };
}

// Verify that a user belongs to the same company
export async function requireSameCompanyUser(
  c: Context,
  targetUserId: string
): Promise<AuthPayload> {
  const auth = requireAuth(c);

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { companyId: true },
  });

  if (!user || user.companyId !== auth.companyId) {
    throw new HTTPException(404, { message: "User not found" });
  }

  return auth;
}

// Helper to check if auth is supervisor
export function isSupervisor(auth: AuthPayload): boolean {
  return auth.role === "SUPERVISOR";
}

// Helper to check if auth can create bales (inspector or supervisor)
export function canCreateBales(auth: AuthPayload): boolean {
  return auth.role === "INSPECTOR" || auth.role === "SUPERVISOR";
}
