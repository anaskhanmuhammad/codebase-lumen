import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * POST /projects/:projectId/comparisons
 * Creates a new comparison under a project.
 * Body: { name, type }
 */
export const createComparison = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
    if (!clerkUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { projectId } = req.params;
    const { name, type } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Comparison name is required" });
    }

    if (!type || !["Human vs LLM", "LLM vs LLM"].includes(type)) {
      return res.status(400).json({ error: "Valid comparison type is required" });
    }

    // Resolve internal userId
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { userId: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found in database" });
    }

    // Verify project belongs to user
    const project = await prisma.project.findUnique({
      where: { projectId },
      select: { userId: true },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.userId !== user.userId) {
      return res.status(403).json({ error: "Forbidden: You do not own this project" });
    }

    // Create comparison
    const comparison = await prisma.comparison.create({
      data: {
        projectId,
        name: name.trim(),
        type,
        status: "Pending",
      },
      include: {
        language: { select: { languageName: true } },
      },
    });

    return res.status(201).json({ comparison });
  } catch (error) {
    console.error("Error creating comparison:", error);
    return res.status(500).json({ error: "Failed to create comparison" });
  }
};

/**
 * GET /projects/:projectId/comparisons/:comparisonId
 * Fetches a single comparison by ID.
 */
export const getComparisonById = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
    if (!clerkUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { projectId, comparisonId } = req.params;

    // Resolve internal userId
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { userId: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found in database" });
    }

    // Verify project belongs to user
    const project = await prisma.project.findUnique({
      where: { projectId },
      select: { userId: true },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.userId !== user.userId) {
      return res.status(403).json({ error: "Forbidden: You do not own this project" });
    }

    // Get comparison
    const comparison = await prisma.comparison.findUnique({
      where: { comparisonId },
      include: {
        language: { select: { languageName: true } },
      },
    });

    if (!comparison) {
      return res.status(404).json({ error: "Comparison not found" });
    }

    if (comparison.projectId !== projectId) {
      return res.status(400).json({ error: "Comparison does not belong to this project" });
    }

    return res.status(200).json({ comparison });
  } catch (error) {
    console.error("Error fetching comparison:", error);
    return res.status(500).json({ error: "Failed to fetch comparison" });
  }
};
