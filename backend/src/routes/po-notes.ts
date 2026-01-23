import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requirePOAccess } from "../auth/guards";

const poNotesRouter = new Hono();

const CreateNoteSchema = z.object({
  poId: z.string(),
  content: z.string().min(1),
});

const UpdateNoteSchema = z.object({
  content: z.string().min(1),
});

// GET /api/po-notes?poId=xxx
poNotesRouter.get("/", async (c) => {
  try {
    const auth = requireAuth(c);
    const poId = c.req.query("poId");

    if (!poId) {
      return c.json(
        { error: { message: "poId is required", code: "BAD_REQUEST" } },
        400
      );
    }

    // Check PO access
    await requirePOAccess(c, poId);

    const notes = await prisma.pONote.findMany({
      where: { poId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return c.json({ data: notes });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch PO notes", code: "FETCH_ERROR" } },
      500
    );
  }
});

// GET /api/po-notes/:id
poNotesRouter.get("/:id", async (c) => {
  try {
    const auth = requireAuth(c);
    const { id } = c.req.param();

    const note = await prisma.pONote.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!note) {
      return c.json(
        { error: { message: "PO note not found", code: "NOT_FOUND" } },
        404
      );
    }

    // Check PO access
    await requirePOAccess(c, note.poId);

    return c.json({ data: note });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to fetch PO note", code: "FETCH_ERROR" } },
      500
    );
  }
});

// POST /api/po-notes
poNotesRouter.post("/", zValidator("json", CreateNoteSchema), async (c) => {
  try {
    const auth = requireAuth(c);
    const data = c.req.valid("json");

    // Check PO access
    await requirePOAccess(c, data.poId);

    // Force userId from auth - never trust client
    const note = await prisma.pONote.create({
      data: {
        poId: data.poId,
        userId: auth.userId,
        content: data.content,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return c.json({ data: note }, 201);
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to create PO note", code: "CREATE_ERROR" } },
      500
    );
  }
});

// PUT /api/po-notes/:id
poNotesRouter.put("/:id", zValidator("json", UpdateNoteSchema), async (c) => {
  try {
    const auth = requireAuth(c);
    const { id } = c.req.param();
    const data = c.req.valid("json");

    // Look up the note first
    const existingNote = await prisma.pONote.findUnique({
      where: { id },
    });

    if (!existingNote) {
      return c.json(
        { error: { message: "PO note not found", code: "NOT_FOUND" } },
        404
      );
    }

    // Check PO access
    await requirePOAccess(c, existingNote.poId);

    // SUPERVISOR can edit any note, others can only edit their own
    if (auth.role !== "SUPERVISOR" && existingNote.userId !== auth.userId) {
      return c.json(
        { error: { message: "You can only edit your own notes", code: "FORBIDDEN" } },
        403
      );
    }

    const note = await prisma.pONote.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return c.json({ data: note });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to update PO note", code: "UPDATE_ERROR" } },
      500
    );
  }
});

// DELETE /api/po-notes/:id
poNotesRouter.delete("/:id", async (c) => {
  try {
    const auth = requireAuth(c);
    const { id } = c.req.param();

    // Look up the note first
    const existingNote = await prisma.pONote.findUnique({
      where: { id },
    });

    if (!existingNote) {
      return c.json(
        { error: { message: "PO note not found", code: "NOT_FOUND" } },
        404
      );
    }

    // Check PO access
    await requirePOAccess(c, existingNote.poId);

    // SUPERVISOR can delete any note, others can only delete their own
    if (auth.role !== "SUPERVISOR" && existingNote.userId !== auth.userId) {
      return c.json(
        { error: { message: "You can only delete your own notes", code: "FORBIDDEN" } },
        403
      );
    }

    await prisma.pONote.delete({ where: { id } });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    return c.json(
      { error: { message: "Failed to delete PO note", code: "DELETE_ERROR" } },
      500
    );
  }
});

export { poNotesRouter };
