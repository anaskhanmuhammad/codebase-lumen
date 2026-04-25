import express from "express";
import { requireAuth } from "@clerk/express";
import {
  getProjects,
  getProjectLanguages,
  getAvailableLlms,
  createProject,
  getProjectById,
} from "../controllers/project.controller.js";
import {
  createComparison,
  getComparisonById,
  completeComparison,
  getCompletedComparisonData,
  getAnalyzerResults,
  generateComparisonCode,
} from "../controllers/comparison.controller.js";

const router = express.Router();

router.get("/", requireAuth(), getProjects);
router.get("/llms", getAvailableLlms);
router.get("/languages", requireAuth(), getProjectLanguages);
router.post("/", requireAuth(), createProject);
router.get("/:projectId", requireAuth(), getProjectById);
router.post("/:projectId/comparisons", requireAuth(), createComparison);
router.get("/:projectId/comparisons/:comparisonId", requireAuth(), getComparisonById);
router.post("/:projectId/comparisons/:comparisonId/complete", requireAuth(), completeComparison);
router.post("/:projectId/comparisons/:comparisonId/generate", requireAuth(), generateComparisonCode);
router.get("/:projectId/comparisons/:comparisonId/completed-data", requireAuth(), getCompletedComparisonData);
router.get("/:projectId/comparisons/:comparisonId/code-samples/:codeSampleId/analyzer-results", requireAuth(), getAnalyzerResults);

export default router;
