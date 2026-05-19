import express from "express";
import {
  getOrCreateChatSession,
  handleNewChatMessage,
  getChatHistory,
} from "../controllers/chat.controller.js";
import { clerkMiddleware } from "@clerk/express";

const router = express.Router({ mergeParams: true });

router.use(clerkMiddleware());
router.post("/", getOrCreateChatSession);
router.post("/message", handleNewChatMessage);
router.get("/", getChatHistory);
router.use(clerkMiddleware());

router.post("/", getOrCreateChatSession);

router.post("/message", handleNewChatMessage);

router.get("/", getChatHistory);

export default router;