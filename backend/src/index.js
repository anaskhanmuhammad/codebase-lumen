import "dotenv/config";
import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import webhookRouter from "./routes/webhook.route.js";
import projectRouter from "./routes/project.route.js";
import apiKeyRouter from "./routes/apiKey.route.js";
import chatRouter from "./routes/chat.route.js";

const app = express();
const PORT = process.env.PORT;
const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || "25mb";

// IMPORTANT: Webhook route MUST come BEFORE other middleware
app.use("/webhooks", webhookRouter);

// Now add other middleware
app.use(cors());
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));
app.use(clerkMiddleware());

// Routes
app.use("/projects", projectRouter);
app.use("/user-api-keys", apiKeyRouter);
app.use("/api/comparisons/:comparisonId/chat", chatRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack);

  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      status: "error",
      message: "Request payload is too large",
      limit: REQUEST_BODY_LIMIT,
    });
  }

  res.status(500).json({
    status: "error",
    message: "Internal Server Error",
  });
});
