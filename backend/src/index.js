import "dotenv/config";
import express from "express";
import { clerkMiddleware } from "@clerk/express";
import webhookRouter from "./routes/webhook.route.js";

const app = express();
const PORT = process.env.PORT;

// IMPORTANT: Webhook route MUST come BEFORE other middleware
app.use("/webhooks", webhookRouter);

// Now add other middleware
app.use(express.json());
app.use(clerkMiddleware());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
