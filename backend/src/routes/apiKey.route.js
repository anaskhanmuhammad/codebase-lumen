import express from "express";
import { requireAuth } from "@clerk/express";
import {
  listAvailableApiProviders,
  createUserApiKey,
  deleteUserApiKey,
  listUserApiKeys,
  retestUserApiKey,
  updateUserApiKey,
} from "../controllers/apiKey.controller.js";

const router = express.Router();

router.get("/", requireAuth(), listUserApiKeys);
router.get("/available-providers", requireAuth(), listAvailableApiProviders);
router.post("/", requireAuth(), createUserApiKey);
router.post("/:keyId/retest", requireAuth(), retestUserApiKey);
router.patch("/:keyId", requireAuth(), updateUserApiKey);
router.delete("/:keyId", requireAuth(), deleteUserApiKey);

export default router;
