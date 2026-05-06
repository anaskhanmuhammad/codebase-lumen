import express from "express";
import {
  getOrCreateChatSession,
  handleNewChatMessage,
  getChatHistory,
} from "../controllers/chat.controller.js";
import { clerkMiddleware } from "@clerk/express";

const router = express.Router({ mergeParams: true });

// All routes in this file are protected and require a signed-in user
router.use(clerkMiddleware());

// Get or create a chat session for a comparison
router.post("/", getOrCreateChatSession);

// Handle a new message in the chat
router.post("/message", handleNewChatMessage);

// Get the entire chat history for a session
router.get("/", getChatHistory);

export default router;