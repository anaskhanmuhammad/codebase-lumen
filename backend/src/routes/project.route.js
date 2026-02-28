import express from "express";
import { requireAuth } from "@clerk/express";
import {
  getProjects,
  getProjectLanguages,
  createProject,
  getProjectById,
} from "../controllers/project.controller.js";
import {
  createComparison,
  getComparisonById,
} from "../controllers/comparison.controller.js";

const router = express.Router();

router.get("/", requireAuth(), getProjects);
router.get("/languages", requireAuth(), getProjectLanguages);
router.post("/", requireAuth(), createProject);
router.get("/:projectId", requireAuth(), getProjectById);
router.post("/:projectId/comparisons", requireAuth(), createComparison);
router.get("/:projectId/comparisons/:comparisonId", requireAuth(), getComparisonById);

export default router;
