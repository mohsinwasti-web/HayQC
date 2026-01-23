import { Hono } from "hono";
import { requireAuth } from "../auth/guards";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const uploadsRouter = new Hono();

// Maximum file size: 6MB
const MAX_FILE_SIZE = 6 * 1024 * 1024;

// Generate random ID for file names
function generateId(length = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Get file extension from mime type
function getExtensionFromMime(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  return mimeToExt[mimeType] || "jpg";
}

// POST /api/uploads - Upload a file
uploadsRouter.post("/", async (c) => {
  try {
    const auth = requireAuth(c);

    // Parse multipart form data
    const formData = await c.req.formData();
    const file = formData.get("file");

    // Validate file exists
    if (!file || !(file instanceof File)) {
      return c.json(
        { error: { message: "No file provided", code: "NO_FILE" } },
        400
      );
    }

    // Validate file is an image
    if (!file.type.startsWith("image/")) {
      return c.json(
        { error: { message: "File must be an image", code: "INVALID_TYPE" } },
        400
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return c.json(
        {
          error: {
            message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
            code: "FILE_TOO_LARGE",
          },
        },
        400
      );
    }

    // Generate path components
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const randomId = generateId();
    const ext = getExtensionFromMime(file.type);
    const fileName = `${randomId}.${ext}`;

    // Build the storage path: backend/uploads/{companyId}/{yyyy-mm}/{randomId}.{ext}
    const relativePath = `uploads/${auth.companyId}/${yearMonth}`;
    const absoluteDir = join(process.cwd(), relativePath);
    const absolutePath = join(absoluteDir, fileName);

    // Create directories recursively if they don't exist
    await mkdir(absoluteDir, { recursive: true });

    // Write file using Bun's file API
    const arrayBuffer = await file.arrayBuffer();
    await Bun.write(absolutePath, arrayBuffer);

    // Return the URL path (relative to backend root)
    const url = `/${relativePath}/${fileName}`;

    return c.json({ data: { url } }, 201);
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    console.error("Upload error:", error);
    return c.json(
      { error: { message: "Failed to upload file", code: "UPLOAD_ERROR" } },
      500
    );
  }
});

export { uploadsRouter };
