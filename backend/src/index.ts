import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import "./env";

import { authMiddleware } from "./auth/middleware";
import { companiesRouter } from "./routes/companies";
import { usersRouter } from "./routes/users";
import { authRouter } from "./routes/auth";
import { purchaseOrdersRouter } from "./routes/purchase-orders";
import { shipmentsRouter } from "./routes/shipments";
import { containersRouter } from "./routes/containers";
import { assignmentsRouter } from "./routes/assignments";
import { poAssignmentsRouter } from "./routes/po-assignments";
import { poNotesRouter } from "./routes/po-notes";
import { balesRouter } from "./routes/bales";
import { statsRouter } from "./routes/stats";
import { uploadsRouter } from "./routes/uploads";

const app = new Hono();

// CORS middleware - validates origin against allowlist
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecodeapp\.com$/,
];

app.use(
  "*",
  cors({
    origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
    credentials: true,
  })
);

// Logging
app.use("*", logger());

// Auth middleware - reads token and sets c.var.auth
app.use("*", authMiddleware());

// Health check endpoint - Updated for RBAC routes
app.get("/health", (c) => c.json({ status: "ok" }));

// Static file serving for uploads
app.use("/uploads/*", serveStatic({ root: "./" }));

// Routes
app.route("/api/companies", companiesRouter);
app.route("/api/users", usersRouter);
app.route("/api/auth", authRouter);
app.route("/api/purchase-orders", purchaseOrdersRouter);
app.route("/api/shipments", shipmentsRouter);
app.route("/api/containers", containersRouter);
app.route("/api/assignments", assignmentsRouter);
app.route("/api/po-assignments", poAssignmentsRouter);
app.route("/api/po-notes", poNotesRouter);
app.route("/api/bales", balesRouter);
app.route("/api/stats", statsRouter);
app.route("/api/uploads", uploadsRouter);

// Global error handler
app.onError((err, c) => {
  console.error("API Error:", err);
  // Handle HTTPException from guards
  if ("status" in err && typeof err.status === "number") {
    return c.json(
      { error: { message: err.message, code: "HTTP_ERROR" } },
      err.status as 401 | 403 | 404 | 500
    );
  }
  return c.json({ error: { message: err.message, code: "INTERNAL_ERROR" } }, 500);
});

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
