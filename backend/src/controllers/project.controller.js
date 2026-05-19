import { PrismaClient } from "@prisma/client";
import { refreshProjectLanguages } from "../services/projectLanguage.service.js";

const prisma = new PrismaClient();


export const getProjects = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
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
    return res.status(500).json({ error: "Failed to fetch projects" });
  }
};

export const getProjectLanguages = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
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
    return res.status(500).json({ error: "Failed to fetch languages" });
  }
};

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
    return res.status(500).json({ error: "Failed to fetch LLMs" });
  }
};

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
      },
    });

    return res.status(201).json({ project });
  } catch (error) {
    return res.status(500).json({ error: "Failed to create project" });
  }
};

export const getProjectById = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
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
    return res.status(500).json({ error: "Failed to fetch project" });
  }
};

export const getLlmLeaderboardDataset = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
    const { mode = "global", projectIds } = req.query;

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
          vulnerabilities: {
            select: {
              vulnerabilityId: true,
              allStandardsViolated: true,
              level: true,
              severity: true,
            },
            orderBy: { createdAt: "asc" },
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
        vulnerabilities: (sample.vulnerabilities || []).map((v) => ({
          vulnerabilityId: v.vulnerabilityId,
          allStandardsViolated: v.allStandardsViolated,
          level: v.level,
          severity: v.severity,
        })),
        analyzerResults: (sample.analyzerResults ||[]).map((r) => ({
          analyzerType: r.analyzerType,
          rawOutput: r.rawOutput,
          executedAt: r.executedAt,
        })),
      }));

      return res.status(200).json({ samples, projects: allUserProjects });
    }

    let projectIdFilter = undefined;
    if (mode === "local" && projectIds !== undefined) {
      const selectedIds = projectIds.split(",").filter(Boolean);
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
        vulnerabilities: {
          select: {
            vulnerabilityId: true,
            allStandardsViolated: true,
            level: true,
            severity: true,
          },
          orderBy: { createdAt: "asc" },
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
      vulnerabilities: (sample.vulnerabilities || []).map((v) => ({
        vulnerabilityId: v.vulnerabilityId,
        allStandardsViolated: v.allStandardsViolated,
        level: v.level,
        severity: v.severity,
      })),
      analyzerResults: (sample.analyzerResults ||[]).map((r) => ({
        analyzerType: r.analyzerType,
        rawOutput: r.rawOutput,
        executedAt: r.executedAt,
      })),
    }));

    return res.status(200).json({ samples, projects: allUserProjects });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch benchmark dataset" });
  }
};

export const getProjectLanguageBreakdown = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
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

    const { projectId } = req.params;
    const project = await prisma.project.findFirst({
      where: { projectId, userId: user.userId },
      select: { projectId: true },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const breakdown = await refreshProjectLanguages({ prisma, projectId });

    return res.status(200).json({
      projectId,
      totalComparisons: breakdown.totalComparisons,
      topLanguage: breakdown.topLanguage,
      languages: breakdown.languages,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch project language breakdown" });
  }
};