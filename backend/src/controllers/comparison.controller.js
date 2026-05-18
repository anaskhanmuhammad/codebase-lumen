import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import {
  ingestAiServerVulnerabilities,
  ingestBanditVulnerabilities,
  ingestSemgrepVulnerabilities,
  ingestSonarQubeVulnerabilities,
} from "../services/vulnerabilityIngestion.service.js";

const prisma = new PrismaClient();

const ENCRYPTION_SECRET =
  process.env.API_KEY_ENCRYPTION_SECRET ||
  process.env.ENCRYPTION_SECRET ||
  process.env.DATABASE_URL ||
  "lumen-development-secret";

const MODEL_RESPONSE_INSTRUCTION =
  "turn only complete source code in a single response. Do not split the code into parts or steps. Do not include explanations before, between, or after the code. Do not include any simulated execution, output, or results of the code. Do not wrap the code in markdown or backticks. Return only raw code.";

function getEncryptionKey() {
  return crypto.createHash("sha256").update(ENCRYPTION_SECRET).digest();
}

function decryptApiKey(encryptedValue) {
  const [ivHex, authTagHex, encryptedHex] = String(encryptedValue || "").split(":");
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted API key format");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

function normalizeProvider(providerName) {
  return String(providerName || "").trim().toLowerCase();
}

function buildPromptWithInstruction(promptText) {
  const userPrompt = String(promptText || "").trim();
  if (!userPrompt) return MODEL_RESPONSE_INSTRUCTION;
  return `${MODEL_RESPONSE_INSTRUCTION}\n\nUser prompt:\n${userPrompt}`;
}

async function generateWithOpenAI({ apiKey, modelIdentifier, promptText }) {
  const promptWithInstruction = buildPromptWithInstruction(promptText);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelIdentifier,
      messages: [
        {
          role: "system",
          content: "You are a senior software engineer.",
        },
        { role: "user", content: promptWithInstruction },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

async function generateWithAnthropic({ apiKey, modelIdentifier, promptText }) {
  const promptWithInstruction = buildPromptWithInstruction(promptText);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelIdentifier,
      max_tokens: 2000,
      temperature: 0.2,
      messages: [{ role: "user", content: promptWithInstruction }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  return data?.content?.map((block) => block?.text || "").join("\n").trim() || "";
}

async function generateWithGemini({ apiKey, modelIdentifier, promptText }) {
  const encodedModel = encodeURIComponent(modelIdentifier);
  const promptWithInstruction = buildPromptWithInstruction(promptText);
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptWithInstruction }] }],
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("\n")
      .trim() || ""
  );
}

async function generateByProvider({ providerName, apiKey, modelIdentifier, promptText }) {
  const provider = normalizeProvider(providerName);

  if (provider === "openai") {
    return generateWithOpenAI({ apiKey, modelIdentifier, promptText });
  }

  if (provider === "anthropic") {
    return generateWithAnthropic({ apiKey, modelIdentifier, promptText });
  }

  if (provider === "google" || provider === "gemini" || provider === "google/gemini" || provider === "google / gemini") {
    return generateWithGemini({ apiKey, modelIdentifier, promptText });
  }

  throw new Error(`Provider '${providerName}' is not supported for generation yet`);
}

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

/**
 * POST /projects/:projectId/comparisons/:comparisonId/complete
 * Persists comparison code samples, analyzer results, and marks comparison as completed.
 * Body: {
 *   humanCode?: string,
 *   llmSamples: [{ llmName: string, codeContent: string, generatedBaselineCode?: string | null, generatedPromptText?: string | null }],
 *   rawAnalyzerResponses?: { [codeKey]: { codeKey, label, analyzers: { semgrep, bandit, sonar, aiServer } } },
 *   detectedLanguageName: string
 * }
 */
export const completeComparison = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
    if (!clerkUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { projectId, comparisonId } = req.params;
    const { humanCode, llmSamples, rawAnalyzerResponses, detectedLanguageName } = req.body;

    if (!Array.isArray(llmSamples) || llmSamples.length === 0) {
      return res.status(400).json({ error: "At least one LLM code sample is required" });
    }

    if (typeof detectedLanguageName !== "string" || !detectedLanguageName.trim()) {
      return res.status(400).json({ error: "Detected language name is required" });
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

    const comparison = await prisma.comparison.findUnique({
      where: { comparisonId },
      select: { comparisonId: true, projectId: true },
    });

    if (!comparison) {
      return res.status(404).json({ error: "Comparison not found" });
    }

    if (comparison.projectId !== projectId) {
      return res.status(400).json({ error: "Comparison does not belong to this project" });
    }

    const invalidLlmSample = llmSamples.find(
      (sample) =>
        !sample ||
        typeof sample.llmName !== "string" ||
        !sample.llmName.trim() ||
        typeof sample.codeContent !== "string" ||
        !sample.codeContent.trim()
    );

    if (invalidLlmSample) {
      return res.status(400).json({ error: "Each LLM sample must include llmName and codeContent" });
    }

    const llmNames = [...new Set(llmSamples.map((sample) => sample.llmName.trim()))];

    const llms = await prisma.llm.findMany({
      where: { llmName: { in: llmNames } },
      select: { llmId: true, llmName: true },
    });

    const llmNameToId = new Map(llms.map((llm) => [llm.llmName, llm.llmId]));
    const missingLlms = llmNames.filter((name) => !llmNameToId.has(name));

    if (missingLlms.length > 0) {
      return res.status(400).json({
        error: `These LLM names do not exist in DB: ${missingLlms.join(", ")}`,
      });
    }

    const language = await prisma.language.findFirst({
      where: {
        languageName: {
          equals: detectedLanguageName.trim(),
          mode: "insensitive",
        },
      },
      select: {
        languageId: true,
        languageName: true,
      },
    });

    if (!language) {
      return res.status(400).json({
        error: `Language '${detectedLanguageName}' is not configured in Language table`,
      });
    }

    const codeSampleRows = [];

    if (typeof humanCode === "string" && humanCode.trim()) {
      codeSampleRows.push({
        comparisonId,
        codeType: "human",
        llmId: null,
        codeContent: humanCode,
        source: null,
        repositoryUrl: null,
        isOriginal: false,
        promptUsed: null,
        generatedAt: null,
        modificationNote: null,
      });
    }

    llmSamples.forEach((sample) => {
      const llmName = sample.llmName.trim();
      const generatedBaselineCode =
        typeof sample.generatedBaselineCode === "string" ? sample.generatedBaselineCode : null;
      const generatedPromptText =
        typeof sample.generatedPromptText === "string" ? sample.generatedPromptText.trim() : "";
      const hasGeneratedBaseline = generatedBaselineCode !== null;
      const isOriginal = hasGeneratedBaseline && sample.codeContent === generatedBaselineCode;

      codeSampleRows.push({
        comparisonId,
        codeType: "llm",
        llmId: llmNameToId.get(llmName),
        codeContent: sample.codeContent,
        source: null,
        repositoryUrl: null,
        isOriginal,
        promptUsed: isOriginal && generatedPromptText ? generatedPromptText : null,
        generatedAt: hasGeneratedBaseline ? new Date() : null,
        modificationNote:
          hasGeneratedBaseline && !isOriginal
            ? "User modified generated code before analysis"
            : null,
      });
    });

    // Map codeKeys to codeSampleIds for analyzer results
    const codeKeyToCodeSampleIdMap = {};
    const analyzerResultsToCreate = [];

    await prisma.$transaction(async (tx) => {
      // Create code samples and track the mapping
      let codeKeyIndex = 0;
      const hasHumanSample = typeof humanCode === "string" && humanCode.trim().length > 0;
      const codeKeys = [
        ...(hasHumanSample ? ["human"] : []),
        ...llmSamples.map((_, idx) => `llm-${idx}`),
      ];

      for (const row of codeSampleRows) {
        const createdSample = await tx.codeSample.create({ data: row });
        const codeKey = codeKeys[codeKeyIndex];
        codeKeyToCodeSampleIdMap[codeKey] = createdSample.codeSampleId;
        codeKeyIndex++;
      }

      // Create analyzer results if provided
      if (rawAnalyzerResponses && typeof rawAnalyzerResponses === "object") {
        for (const [codeKey, codeEntry] of Object.entries(rawAnalyzerResponses)) {
          const codeSampleId = codeKeyToCodeSampleIdMap[codeKey];
          if (!codeSampleId) continue;

          const analyzers = codeEntry.analyzers || {};
          for (const [analyzerType, rawOutput] of Object.entries(analyzers)) {
            if (rawOutput && typeof rawOutput === "object") {
              analyzerResultsToCreate.push({
                codeSampleId,
                analyzerType,
                rawOutput,
              });
            }
          }
        }

        if (analyzerResultsToCreate.length > 0) {
          console.log(`[COMPARISON] Creating ${analyzerResultsToCreate.length} analyzer results`);
          await tx.analyzerResult.createMany({
            data: analyzerResultsToCreate,
          });

          console.log(`[COMPARISON] Processing analyzer results for vulnerability ingestion`);
          for (const analyzerResult of analyzerResultsToCreate) {
            const analyzerType = String(analyzerResult.analyzerType).toLowerCase();
            console.log(`[COMPARISON] Analyzer type: "${analyzerType}" (raw: "${analyzerResult.analyzerType}")`);
            
            if (analyzerType === "bandit") {
              console.log(`[COMPARISON] Triggering Bandit ingestion for codeSampleId: ${analyzerResult.codeSampleId}`);
              await ingestBanditVulnerabilities({
                tx,
                codeSampleId: analyzerResult.codeSampleId,
                rawOutput: analyzerResult.rawOutput,
              });
            }
          }

          for (const analyzerResult of analyzerResultsToCreate) {
            const analyzerType = String(analyzerResult.analyzerType).toLowerCase();
            if (analyzerType === "semgrep") {
              console.log(`[COMPARISON] Triggering Semgrep ingestion for codeSampleId: ${analyzerResult.codeSampleId}`);
              await ingestSemgrepVulnerabilities({
                tx,
                codeSampleId: analyzerResult.codeSampleId,
                rawOutput: analyzerResult.rawOutput,
              });
            }
            if (analyzerType === "sonar" || analyzerType === "sonarqube") {
              console.log(`[COMPARISON] Triggering SonarQube ingestion for codeSampleId: ${analyzerResult.codeSampleId}`);
              await ingestSonarQubeVulnerabilities({
                tx,
                codeSampleId: analyzerResult.codeSampleId,
                rawOutput: analyzerResult.rawOutput,
              });
            }
            if (
              analyzerType === "aiserver" ||
              analyzerType === "ai_server" ||
              analyzerType === "ai-server"
            ) {
              console.log(`[COMPARISON] Triggering AI Server ingestion for codeSampleId: ${analyzerResult.codeSampleId}`);
              await ingestAiServerVulnerabilities({
                tx,
                codeSampleId: analyzerResult.codeSampleId,
                rawOutput: analyzerResult.rawOutput,
              });
            }
          }
        }
      }

      await tx.comparison.update({
        where: { comparisonId },
        data: {
          languageId: language.languageId,
          status: "Completed",
          completedAt: new Date(),
        },
      });
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    const codeSampleIds = Object.values(codeKeyToCodeSampleIdMap);
    const vulnerabilities = codeSampleIds.length
      ? await prisma.vulnerability.findMany({
          where: { codeSampleId: { in: codeSampleIds } },
          orderBy: [{ codeSampleId: "asc" }, { createdAt: "asc" }],
          select: {
            vulnerabilityId: true,
            codeSampleId: true,
            name: true,
            description: true,
            filePath: true,
            lineNumber: true,
            severity: true,
            detectedBy: true,
            allStandardsViolated: true,
            level: true,
            confidence: true,
          },
        })
      : [];

    const vulnerabilitiesByCodeSampleId = new Map();
    for (const vulnerability of vulnerabilities) {
      const list = vulnerabilitiesByCodeSampleId.get(vulnerability.codeSampleId) || [];
      list.push(vulnerability);
      vulnerabilitiesByCodeSampleId.set(vulnerability.codeSampleId, list);
    }

    const codeSamples = Object.entries(codeKeyToCodeSampleIdMap).map(([codeKey, codeSampleId]) => ({
      codeKey,
      codeSampleId,
    }));

    const vulnerabilitiesByCode = {};
    for (const { codeKey, codeSampleId } of codeSamples) {
      vulnerabilitiesByCode[codeKey] = vulnerabilitiesByCodeSampleId.get(codeSampleId) || [];
    }

    return res.status(201).json({
      message: "Comparison completed and code samples saved",
      codeSamplesSaved: codeSampleRows.length,
      analyzerResultsSaved: analyzerResultsToCreate.length,
      language: language.languageName,
      codeSamples,
      vulnerabilitiesByCode,
    });
  } catch (error) {
    console.error("Error completing comparison:", error);
    return res.status(500).json({ error: "Failed to complete comparison" });
  }
};

/**
 * GET /projects/:projectId/comparisons/:comparisonId/completed-data
 * Returns persisted code samples and selected LLMs for a completed comparison.
 */
export const getCompletedComparisonData = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
    if (!clerkUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { projectId, comparisonId } = req.params;

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { userId: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found in database" });
    }

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

    const comparison = await prisma.comparison.findUnique({
      where: { comparisonId },
      select: {
        comparisonId: true,
        projectId: true,
        status: true,
        completedAt: true,
      },
    });

    if (!comparison) {
      return res.status(404).json({ error: "Comparison not found" });
    }

    if (comparison.projectId !== projectId) {
      return res.status(400).json({ error: "Comparison does not belong to this project" });
    }

    if ((comparison.status || "").toLowerCase() !== "completed") {
      return res.status(400).json({ error: "Comparison is not completed yet" });
    }

    const codeSamples = await prisma.codeSample.findMany({
      where: { comparisonId },
      include: {
        llm: {
          select: {
            llmId: true,
            llmName: true,
            provider: {
              select: {
                providerName: true,
              },
            },
            modelIdentifier: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const normalizedCodeSamples = codeSamples.map((sample) => {
      if (!sample.llm) return sample;
      return {
        ...sample,
        llm: {
          llmId: sample.llm.llmId,
          llmName: sample.llm.llmName,
          provider: sample.llm.provider?.providerName || null,
          modelIdentifier: sample.llm.modelIdentifier,
        },
      };
    });

    const humanSample = normalizedCodeSamples.find((sample) => sample.codeType === "human") || null;
    const llmSamples = normalizedCodeSamples.filter((sample) => sample.codeType === "llm");

    return res.status(200).json({
      comparison: {
        comparisonId: comparison.comparisonId,
        status: comparison.status,
        completedAt: comparison.completedAt,
      },
      humanSample,
      llmSamples,
      selectedLlms: llmSamples
        .map((sample) => sample.llm)
        .filter(Boolean),
    });
  } catch (error) {
    console.error("Error fetching completed comparison data:", error);
    return res.status(500).json({ error: "Failed to fetch completed comparison data" });
  }
};

/**
 * GET /projects/:projectId/comparisons/:comparisonId/code-samples/:codeSampleId/analyzer-results
 * Retrieves all raw analyzer results for a specific code sample.
 */
export const getAnalyzerResults = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
    if (!clerkUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { projectId, comparisonId, codeSampleId } = req.params;

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { userId: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found in database" });
    }

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

    const comparison = await prisma.comparison.findUnique({
      where: { comparisonId },
      select: { comparisonId: true, projectId: true },
    });

    if (!comparison) {
      return res.status(404).json({ error: "Comparison not found" });
    }

    if (comparison.projectId !== projectId) {
      return res.status(400).json({ error: "Comparison does not belong to this project" });
    }

    const codeSample = await prisma.codeSample.findUnique({
      where: { codeSampleId },
      select: { codeSampleId: true, comparisonId: true },
    });

    if (!codeSample) {
      return res.status(404).json({ error: "Code sample not found" });
    }

    if (codeSample.comparisonId !== comparisonId) {
      return res.status(400).json({ error: "Code sample does not belong to this comparison" });
    }

    const analyzerResults = await prisma.analyzerResult.findMany({
      where: { codeSampleId },
      orderBy: { analyzerType: "asc" },
    });

    const vulnerabilities = await prisma.vulnerability.findMany({
      where: { codeSampleId },
      orderBy: { createdAt: "asc" },
      select: {
        vulnerabilityId: true,
        codeSampleId: true,
        name: true,
        description: true,
        filePath: true,
        lineNumber: true,
        severity: true,
        detectedBy: true,
        allStandardsViolated: true,
        level: true,
        confidence: true,
      },
    });

    return res.status(200).json({
      codeSampleId,
      results: analyzerResults.map((result) => ({
        resultId: result.resultId,
        analyzerType: result.analyzerType,
        rawOutput: result.rawOutput,
        executedAt: result.executedAt,
      })),
      vulnerabilities,
    });
  } catch (error) {
    console.error("Error fetching analyzer results:", error);
    return res.status(500).json({ error: "Failed to fetch analyzer results" });
  }
};

/**
 * POST /projects/:projectId/comparisons/:comparisonId/generate
 * Generates code for selected LLM targets using user provider API keys.
 * Body: {
 *   promptText: string,
 *   targets: [{ targetIndex: number, llmName: string }]
 * }
 */
export const generateComparisonCode = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
    if (!clerkUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { projectId, comparisonId } = req.params;
    const { promptText, targets } = req.body;

    if (typeof promptText !== "string" || !promptText.trim()) {
      return res.status(400).json({ error: "Prompt text is required" });
    }

    if (!Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ error: "At least one generation target is required" });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { userId: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found in database" });
    }

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

    const comparison = await prisma.comparison.findUnique({
      where: { comparisonId },
      select: { comparisonId: true, projectId: true, status: true },
    });

    if (!comparison) {
      return res.status(404).json({ error: "Comparison not found" });
    }

    if (comparison.projectId !== projectId) {
      return res.status(400).json({ error: "Comparison does not belong to this project" });
    }

    const targetNames = [...new Set(targets.map((target) => String(target.llmName || "").trim()).filter(Boolean))];
    const llms = await prisma.llm.findMany({
      where: { llmName: { in: targetNames } },
      select: {
        llmName: true,
        modelIdentifier: true,
        provider: {
          select: {
            providerName: true,
          },
        },
      },
    });

    const llmByName = new Map(llms.map((llm) => [llm.llmName, llm]));

    const providerRows = await prisma.userApiKey.findMany({
      where: {
        userId: user.userId,
        isActive: true,
        isValidated: true,
      },
      select: {
        provider: true,
        encryptedKey: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const providerKeyByName = new Map();
    for (const row of providerRows) {
      const normalized = normalizeProvider(row.provider);
      if (!providerKeyByName.has(normalized)) {
        providerKeyByName.set(normalized, row.encryptedKey);
      }
    }

    const results = [];
    for (const target of targets) {
      const targetIndex = Number(target.targetIndex);
      const llmName = String(target.llmName || "").trim();

      if (!Number.isInteger(targetIndex) || targetIndex < 0 || !llmName) {
        results.push({
          targetIndex,
          llmName,
          status: "error",
          error: "Invalid target payload",
        });
        continue;
      }

      const llm = llmByName.get(llmName);
      if (!llm) {
        results.push({
          targetIndex,
          llmName,
          status: "error",
          error: `LLM '${llmName}' is not found in DB`,
        });
        continue;
      }

      const providerName = llm.provider?.providerName || "";
      const modelIdentifier = llm.modelIdentifier || "";
      if (!providerName || !modelIdentifier) {
        results.push({
          targetIndex,
          llmName,
          status: "error",
          error: "LLM provider or modelIdentifier is missing",
        });
        continue;
      }

      const encryptedKey = providerKeyByName.get(normalizeProvider(providerName));
      if (!encryptedKey) {
        results.push({
          targetIndex,
          llmName,
          provider: providerName,
          modelIdentifier,
          status: "error",
          error: `No active validated API key for provider '${providerName}'`,
        });
        continue;
      }

      try {
        const apiKey = decryptApiKey(encryptedKey);
        const generatedCode = await generateByProvider({
          providerName,
          apiKey,
          modelIdentifier,
          promptText: promptText.trim(),
        });

        if (!generatedCode) {
          results.push({
            targetIndex,
            llmName,
            provider: providerName,
            modelIdentifier,
            status: "error",
            error: "Provider returned an empty response",
          });
          continue;
        }

        results.push({
          targetIndex,
          llmName,
          provider: providerName,
          modelIdentifier,
          status: "success",
          generatedCode,
        });
      } catch (generationError) {
        results.push({
          targetIndex,
          llmName,
          provider: providerName,
          modelIdentifier,
          status: "error",
          error: generationError.message || "Generation failed",
        });
      }
    }

    return res.status(200).json({
      promptText: promptText.trim(),
      results,
    });
  } catch (error) {
    console.error("Error generating comparison code:", error);
    return res.status(500).json({ error: "Failed to generate code for selected LLMs" });
  }
};
