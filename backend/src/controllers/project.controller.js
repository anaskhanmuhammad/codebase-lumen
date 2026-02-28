import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


/**
 * GET /projects
 * Returns paginated list of projects for the authenticated user.
 * Query params: search, language, page, limit
 */
export const getProjects = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
    if (!clerkUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Resolve internal DB userId from Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { userId: true },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found in database" });
    }
    const userId = user.userId;

    const {
      search = "",
      language = "",
      page = "1",
      limit = "10",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Build dynamic where clause
    const where = { userId };

    if (search) {
      where.projectName = { contains: search, mode: "insensitive" };
    }

    if (language) {
      where.topLanguage = { equals: language, mode: "insensitive" };
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
        include: {
          _count: {
            select: { comparisons: true },
          },
        },
      }),
      prisma.project.count({ where }),
    ]);

    return res.json({
      projects,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return res.status(500).json({ error: "Failed to fetch projects" });
  }
};

/**
 * GET /projects/languages
 * Returns distinct topLanguage values for the user (for filter dropdown)
 */
export const getProjectLanguages = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
    if (!clerkUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Resolve internal DB userId from Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { userId: true },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found in database" });
    }
    const userId = user.userId;

    const languages = await prisma.project.findMany({
      where: { userId, topLanguage: { not: null } },
      select: { topLanguage: true },
      distinct: ["topLanguage"],
      orderBy: { topLanguage: "asc" },
    });

    return res.json({
      languages: languages.map((l) => l.topLanguage),
    });
  } catch (error) {
    console.error("Error fetching project languages:", error);
    return res.status(500).json({ error: "Failed to fetch languages" });
  }
};

/**
 * POST /projects
 * Creates a new project for the authenticated user.
 * Body: { projectName, description? }
 * topLanguage is intentionally excluded — the system sets it automatically later.
 */
export const createProject = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
    if (!clerkUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { projectName, description } = req.body;

    if (!projectName || !projectName.trim()) {
      return res.status(400).json({ error: "Project name is required" });
    }

    // Resolve internal userId from Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { userId: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found in database" });
    }

    const project = await prisma.project.create({
      data: {
        userId: user.userId,
        projectName: projectName.trim(),
        description: description?.trim() || null,
        // topLanguage is left null — system will populate it later
      },
    });

    return res.status(201).json({ project });
  } catch (error) {
    console.error("Error creating project:", error);
    return res.status(500).json({ error: "Failed to create project" });
  }
};

/**
 * GET /projects/:projectId
 * Returns a single project (with its comparisons) for the authenticated user.
 */
export const getProjectById = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
    if (!clerkUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Resolve internal DB userId
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { userId: true },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found in database" });
    }

    const { projectId } = req.params;

    const project = await prisma.project.findFirst({
      where: { projectId, userId: user.userId },
      include: {
        comparisons: {
          orderBy: { createdAt: "desc" },
          include: {
            language: { select: { languageName: true } },
          },
        },
        _count: { select: { comparisons: true } },
      },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    return res.json({ project });
  } catch (error) {
    console.error("Error fetching project:", error);
    return res.status(500).json({ error: "Failed to fetch project" });
  }
};
