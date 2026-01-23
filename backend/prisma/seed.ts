import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const hashPin = async (pin: string): Promise<string> => {
  return bcrypt.hash(pin, 10);
};

async function main() {
  console.log("Seeding database...");

  // Clear existing data in correct order (respect foreign keys)
  await prisma.bale.deleteMany();
  await prisma.inspectorAssignment.deleteMany();
  await prisma.pONote.deleteMany();
  await prisma.pOUserAssignment.deleteMany();
  await prisma.container.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  // ==================== DEMO COMPANY (Main demo account) ====================
  const demoCompany = await prisma.company.create({
    data: {
      name: "Demo Hay Co.",
      code: "DEMO",
      address: "123 Demo Street, Demo City",
      contactEmail: "info@demohay.com",
      contactPhone: "+1-234-567-8900",
    },
  });

  // Create demo users for testing
  const supervisor = await prisma.user.create({
    data: {
      companyId: demoCompany.id,
      name: "Admin Supervisor",
      email: "supervisor@demo.com",
      pinHash: await hashPin("0000"),
      role: "SUPERVISOR",
    },
  });

  const inspector = await prisma.user.create({
    data: {
      companyId: demoCompany.id,
      name: "Demo Inspector",
      email: "inspector@demo.com",
      pinHash: await hashPin("1234"),
      role: "INSPECTOR",
    },
  });

  const customer = await prisma.user.create({
    data: {
      companyId: demoCompany.id,
      name: "Demo Customer",
      email: "customer@demo.com",
      pinHash: await hashPin("2222"),
      role: "CUSTOMER",
    },
  });

  const supplier = await prisma.user.create({
    data: {
      companyId: demoCompany.id,
      name: "Demo Supplier",
      email: "supplier@demo.com",
      pinHash: await hashPin("3333"),
      role: "SUPPLIER",
    },
  });

  // Create PO-001 (assigned to customer and supplier)
  const po1 = await prisma.purchaseOrder.create({
    data: {
      companyId: demoCompany.id,
      poNumber: "PO-2024-001",
      customerName: "Qatar Farms Ltd",
      product: "Rhodes Grass",
      contractQtyMt: 500.0,
      poDate: new Date("2024-01-15"),
      paymentTerms: "Net 30",
      pricePerMt: 250.0,
      status: "IN_PROGRESS",
    },
  });

  // Create PO-002 (NOT assigned - only visible to supervisor/inspector)
  const po2 = await prisma.purchaseOrder.create({
    data: {
      companyId: demoCompany.id,
      poNumber: "PO-2024-002",
      customerName: "UAE Livestock",
      product: "Alfalfa",
      contractQtyMt: 300.0,
      poDate: new Date("2024-02-01"),
      paymentTerms: "Net 45",
      pricePerMt: 280.0,
      status: "OPEN",
    },
  });

  // Assign customer and supplier to PO-001 only
  await prisma.pOUserAssignment.create({
    data: {
      poId: po1.id,
      userId: customer.id,
    },
  });

  await prisma.pOUserAssignment.create({
    data: {
      poId: po1.id,
      userId: supplier.id,
    },
  });

  // Create shipments for PO-001
  const shipment1 = await prisma.shipment.create({
    data: {
      poId: po1.id,
      shipmentCode: "SH-001-A",
      supplierName: "Pakistan Hay Exports",
      shipmentDate: new Date("2024-01-20"),
      status: "IN_TRANSIT",
    },
  });

  const shipment2 = await prisma.shipment.create({
    data: {
      poId: po1.id,
      shipmentCode: "SH-001-B",
      supplierName: "Pakistan Hay Exports",
      shipmentDate: new Date("2024-01-25"),
      status: "PENDING",
    },
  });

  // Create containers
  const container1 = await prisma.container.create({
    data: {
      shipmentId: shipment1.id,
      containerCode: "C1",
      containerNumber: "MSCU1234567",
      itemType: "Rhodes Grass",
      balePress: "Large",
      baleSize: "Standard",
      avgExpectedWeight: 450.0,
      status: "IN_PROGRESS",
    },
  });

  const container2 = await prisma.container.create({
    data: {
      shipmentId: shipment1.id,
      containerCode: "C2",
      containerNumber: "MSCU1234568",
      itemType: "Rhodes Grass",
      balePress: "Large",
      baleSize: "Standard",
      avgExpectedWeight: 450.0,
      status: "COMPLETED",
    },
  });

  const container3 = await prisma.container.create({
    data: {
      shipmentId: shipment2.id,
      containerCode: "C3",
      containerNumber: "MSCU1234569",
      itemType: "Rhodes Grass",
      balePress: "Large",
      baleSize: "Standard",
      avgExpectedWeight: 450.0,
      status: "PENDING",
    },
  });

  // Create inspector assignments
  await prisma.inspectorAssignment.create({
    data: {
      containerId: container1.id,
      inspectorId: inspector.id,
      rangeStart: 1,
      rangeEnd: 25,
    },
  });

  await prisma.inspectorAssignment.create({
    data: {
      containerId: container2.id,
      inspectorId: inspector.id,
      rangeStart: 1,
      rangeEnd: 25,
    },
  });

  // Create sample bales for container 1 (15 bales, ~15% rejection)
  for (let i = 1; i <= 15; i++) {
    const isReject = Math.random() < 0.15;
    const grades = ["A", "B", "C"] as const;
    const colors = ["DARK_GREEN", "GREEN", "LIGHT_GREEN", "BROWN"] as const;
    const stems = ["LOW", "MED", "HIGH"] as const;

    await prisma.bale.create({
      data: {
        poId: po1.id,
        shipmentId: shipment1.id,
        containerId: container1.id,
        inspectorId: inspector.id,
        baleNumber: i,
        baleIdDisplay: `C1-${String(i).padStart(3, "0")}`,
        weightKg: 400 + Math.random() * 100,
        moisturePct: 8 + Math.random() * 4,
        color: isReject ? "BROWN" : colors[Math.floor(Math.random() * 3)] as string,
        stems: stems[Math.floor(Math.random() * 3)] as string,
        wetness: "DRY",
        contamination: isReject && Math.random() > 0.5,
        mixedMaterial: false,
        mold: isReject && Math.random() > 0.7,
        grade: isReject ? "REJECT" : grades[Math.floor(Math.random() * 3)] as string,
        decision: isReject ? "REJECT" : "ACCEPT",
        rejectReason: isReject ? "Poor quality detected" : null,
        syncStatus: "SYNCED",
      },
    });
  }

  // Create sample bales for container 2 (8 bales, all accepted)
  for (let i = 1; i <= 8; i++) {
    await prisma.bale.create({
      data: {
        poId: po1.id,
        shipmentId: shipment1.id,
        containerId: container2.id,
        inspectorId: inspector.id,
        baleNumber: i,
        baleIdDisplay: `C2-${String(i).padStart(3, "0")}`,
        weightKg: 420 + Math.random() * 60,
        moisturePct: 8 + Math.random() * 3,
        color: "GREEN",
        stems: "LOW",
        wetness: "DRY",
        contamination: false,
        mixedMaterial: false,
        mold: false,
        grade: "A",
        decision: "ACCEPT",
        syncStatus: "SYNCED",
      },
    });
  }

  // Add sample notes
  await prisma.pONote.create({
    data: {
      poId: po1.id,
      userId: customer.id,
      content: "Please ensure all bales meet the quality standard for this shipment.",
    },
  });

  await prisma.pONote.create({
    data: {
      poId: po1.id,
      userId: supervisor.id,
      content: "Quality team has been notified. We'll prioritize inspection for this order.",
    },
  });

  // ==================== SECOND COMPANY (For isolation testing) ====================
  const otherCompany = await prisma.company.create({
    data: {
      name: "Gulf Agri Solutions",
      code: "GULFAGRI",
      address: "Dubai, UAE",
      contactEmail: "info@gulfagri.ae",
      contactPhone: "+971-4-123-4567",
    },
  });

  // Create users for Other Co
  const otherSupervisor = await prisma.user.create({
    data: {
      companyId: otherCompany.id,
      name: "Bilal Hassan",
      email: "bilal@gulfagri.ae",
      pinHash: await hashPin("5678"),
      role: "SUPERVISOR",
    },
  });

  const otherInspector = await prisma.user.create({
    data: {
      companyId: otherCompany.id,
      name: "Ahmed Malik",
      email: "ahmed@gulfagri.ae",
      pinHash: await hashPin("4321"),
      role: "INSPECTOR",
    },
  });

  // Create a PO for Other Co (should NOT be visible to Demo Co users)
  const otherPO = await prisma.purchaseOrder.create({
    data: {
      companyId: otherCompany.id,
      poNumber: "GA-2024-001",
      customerName: "Saudi Agricultural Corp",
      product: "Wheat Straw",
      contractQtyMt: 400.0,
      poDate: new Date("2024-02-15"),
      paymentTerms: "LC at Sight",
      pricePerMt: 180.0,
      status: "IN_PROGRESS",
    },
  });

  // Create a shipment and container for Other Co
  const otherShipment = await prisma.shipment.create({
    data: {
      poId: otherPO.id,
      shipmentCode: "GA-SH-001",
      supplierName: "UAE Straw Trading",
      shipmentDate: new Date("2024-02-20"),
      status: "IN_TRANSIT",
    },
  });

  const otherContainer = await prisma.container.create({
    data: {
      shipmentId: otherShipment.id,
      containerCode: "GC1",
      containerNumber: "MSKU9876543",
      itemType: "Wheat Straw",
      balePress: "Large",
      baleSize: "Standard",
      avgExpectedWeight: 380.0,
      status: "IN_PROGRESS",
    },
  });

  // Create bales for Other Co
  for (let i = 1; i <= 10; i++) {
    const isReject = Math.random() < 0.1;
    await prisma.bale.create({
      data: {
        poId: otherPO.id,
        shipmentId: otherShipment.id,
        containerId: otherContainer.id,
        inspectorId: otherInspector.id,
        baleNumber: i,
        baleIdDisplay: `GC1-${String(i).padStart(3, "0")}`,
        weightKg: 350 + Math.random() * 60,
        moisturePct: 9 + Math.random() * 3,
        color: "LIGHT_GREEN",
        stems: "MED",
        wetness: "DRY",
        contamination: false,
        mixedMaterial: false,
        mold: false,
        grade: isReject ? "C" : "B",
        decision: isReject ? "REJECT" : "ACCEPT",
        rejectReason: isReject ? "Below quality threshold" : null,
        syncStatus: "SYNCED",
      },
    });
  }

  // ==================== SUMMARY ====================
  console.log("\n========================================");
  console.log("Database seeded successfully!");
  console.log("========================================\n");

  console.log("DEMO HAY CO. (Main demo company)");
  console.log("--------------------------------");
  console.log("Users:");
  console.log("  - Supervisor: supervisor@demo.com - PIN: 0000");
  console.log("  - Inspector:  inspector@demo.com  - PIN: 1234");
  console.log("  - Customer:   customer@demo.com   - PIN: 2222");
  console.log("  - Supplier:   supplier@demo.com   - PIN: 3333");
  console.log("\nPurchase Orders:");
  console.log("  - PO-2024-001: Assigned to customer + supplier (visible to all demo users)");
  console.log("  - PO-2024-002: NOT assigned (visible only to supervisor/inspector)");
  console.log("\nData: 2 shipments, 3 containers, 23 bales\n");

  console.log("GULF AGRI SOLUTIONS (Cross-company isolation test)");
  console.log("--------------------------------------------------");
  console.log("Users:");
  console.log("  - Supervisor: bilal@gulfagri.ae - PIN: 5678");
  console.log("  - Inspector:  ahmed@gulfagri.ae - PIN: 4321");
  console.log("\nPurchase Orders:");
  console.log("  - GA-2024-001: Should NOT be visible to Demo Co users");
  console.log("\nData: 1 shipment, 1 container, 10 bales\n");

  console.log("========================================");
  console.log("RBAC Testing Notes:");
  console.log("- Customer/Supplier can ONLY see PO-2024-001");
  console.log("- Demo users should NOT see Gulf Agri data");
  console.log("- Gulf Agri users should NOT see Demo data");
  console.log("========================================\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
