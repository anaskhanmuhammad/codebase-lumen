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
 * GET /projects/llms
 * Returns active LLM models for dropdowns.
 */
export const getAvailableLlms = async (req, res) => {
  try {
    const llmsRaw = await prisma.llm.findMany({
      where: { isActive: true },
      select: {
        llmId: true,
        llmName: true,
        provider: {
          select: {
            providerName: true,
          },
        },
        modelIdentifier: true,
        description: true,
      },
      orderBy: [{ provider: { providerName: "asc" } }, { llmName: "asc" }],
    });

    const llms = llmsRaw.map((llm) => ({
      llmId: llm.llmId,
      llmName: llm.llmName,
      provider: llm.provider?.providerName || null,
      modelIdentifier: llm.modelIdentifier,
      description: llm.description,
    }));

    return res.json({ llms });
  } catch (error) {
    console.error("Error fetching available LLMs:", error);
    return res.status(500).json({ error: "Failed to fetch LLMs" });
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

/**
 * GET /projects/benchmarks/llm-leaderboard-dataset
 * Returns the raw dataset needed for real-time benchmarking.
 * Includes completed comparison LLM code samples with analyzer raw outputs.
 * NOTE: This does not store or persist any benchmark scores.
 */
export const getLlmLeaderboardDataset = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
    const { mode = "global", projectIds } = req.query; // 'global' or 'local'

    if (!clerkUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { userId: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found in database" });
    }

    // Always fetch all projects owned by the user to populate the frontend dropdown
    const allUserProjects = await prisma.project.findMany({
      where: { userId: user.userId },
      select: { projectId: true, projectName: true },
      orderBy: { createdAt: "desc" }
    });

    if (mode === "global") {
      const samplesRaw = await prisma.codeSample.findMany({
        where: {
          codeType: "llm",
          llmId: { not: null },
          isOriginal: true,
          comparison: {
            status: "Completed",
          },
        },
        select: {
          codeSampleId: true,
          comparisonId: true,
          createdAt: true,
          llm: {
            select: {
              llmId: true,
              llmName: true,
              provider: { select: { providerName: true } },
              modelIdentifier: true,
            },
          },
          comparison: {
            select: {
              languageId: true,
              language: { select: { languageName: true } },
            },
          },
          analyzerResults: {
            select: {
              analyzerType: true,
              rawOutput: true,
              executedAt: true,
            },
            orderBy: { analyzerType: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      const samples = samplesRaw.map((sample) => ({
        codeSampleId: sample.codeSampleId,
        comparisonId: sample.comparisonId,
        createdAt: sample.createdAt,
        language: {
          languageId: sample.comparison?.languageId || null,
          languageName: sample.comparison?.language?.languageName || null,
        },
        llm: sample.llm
          ? {
              llmId: sample.llm.llmId,
              llmName: sample.llm.llmName,
              provider: sample.llm.provider?.providerName || null,
              modelIdentifier: sample.llm.modelIdentifier,
            }
          : null,
        analyzerResults: (sample.analyzerResults ||[]).map((r) => ({
          analyzerType: r.analyzerType,
          rawOutput: r.rawOutput,
          executedAt: r.executedAt,
        })),
      }));

      return res.status(200).json({ samples, projects: allUserProjects });
    }

    // Handle specific project filtering for Local Leaderboard
    let projectIdFilter = undefined;
    if (mode === "local" && projectIds !== undefined) {
      const selectedIds = projectIds.split(",").filter(Boolean);
      
      // If no projects are selected in local mode, return empty results early
      if (selectedIds.length === 0) {
        return res.status(200).json({ samples:[], projects: allUserProjects });
      }
      projectIdFilter = { in: selectedIds };
    }

    const comparisons = await prisma.comparison.findMany({
      where: {
        status: "Completed",
        project: {
          userId: user.userId,
          ...(projectIdFilter && { projectId: projectIdFilter }),
        },
      },
      select: {
        comparisonId: true,
        languageId: true,
        language: {
          select: { languageName: true },
        },
      },
    });

    const comparisonIds = comparisons.map((c) => c.comparisonId);
    if (comparisonIds.length === 0) {
      return res.status(200).json({ samples:[], projects: allUserProjects });
    }

    // For Global: isOriginal MUST be true. For Local: ignore isOriginal (gets true & false)
    const isOriginalFilter = mode === "global" ? true : undefined;

    const samplesRaw = await prisma.codeSample.findMany({
      where: {
        comparisonId: { in: comparisonIds },
        codeType: "llm",
        llmId: { not: null },
        ...(isOriginalFilter !== undefined && { isOriginal: isOriginalFilter }),
      },
      select: {
        codeSampleId: true,
        comparisonId: true,
        createdAt: true,
        llm: {
          select: {
            llmId: true,
            llmName: true,
            provider: { select: { providerName: true } },
            modelIdentifier: true,
          },
        },
        comparison: {
          select: {
            languageId: true,
            language: { select: { languageName: true } },
          },
        },
        analyzerResults: {
          select: {
            analyzerType: true,
            rawOutput: true,
            executedAt: true,
          },
          orderBy: { analyzerType: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const samples = samplesRaw.map((sample) => ({
      codeSampleId: sample.codeSampleId,
      comparisonId: sample.comparisonId,
      createdAt: sample.createdAt,
      language: {
        languageId: sample.comparison?.languageId || null,
        languageName: sample.comparison?.language?.languageName || null,
      },
      llm: sample.llm
        ? {
            llmId: sample.llm.llmId,
            llmName: sample.llm.llmName,
            provider: sample.llm.provider?.providerName || null,
            modelIdentifier: sample.llm.modelIdentifier,
          }
        : null,
      analyzerResults: (sample.analyzerResults ||[]).map((r) => ({
        analyzerType: r.analyzerType,
        rawOutput: r.rawOutput,
        executedAt: r.executedAt,
      })),
    }));

    return res.status(200).json({ samples, projects: allUserProjects });
  } catch (error) {
    console.error("Error fetching LLM leaderboard dataset:", error);
    return res.status(500).json({ error: "Failed to fetch benchmark dataset" });
  }
};