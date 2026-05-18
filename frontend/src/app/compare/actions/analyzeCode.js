"use server";

import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import scanner from "sonarqube-scanner";

const SONARQUBE_URL = process.env.SONARQUBE_URL || "http://localhost:9000";
const SONARQUBE_TOKEN = process.env.SONARQUBE_TOKEN;

if (!SONARQUBE_TOKEN) {
  console.warn("WARNING: SONARQUBE_TOKEN is not set. Analysis may fail.");
}

const TEMP_DIR = path.join(process.cwd(), "temp_analysis");

const SONAR_LANGUAGE_MAP = {
  python: "py",
  javascript: "js",
  typescript: "ts",
  java: "java",
  cpp: "cpp",
  csharp: "cs",
  go: "go",
  rust: "rs",
  ruby: "rb",
  php: "php",
  kotlin: "kt",
  swift: "swift",
  sql: "sql",
  bash: "sh",
};

function resolveSonarExtension(language) {
  const normalized = String(language || "")
    .trim()
    .toLowerCase();
  return SONAR_LANGUAGE_MAP[normalized] || SONAR_LANGUAGE_MAP.javascript;
}

function mapSonarSeverityToSarifLevel(severity) {
  const normalized = String(severity || "").trim().toUpperCase();
  if (normalized === "BLOCKER" || normalized === "CRITICAL") return "error";
  if (normalized === "MAJOR") return "warning";
  return "note";
}

function getSonarArtifactUri(issue, fallbackComponentKey) {
  const component = String(issue?.component || fallbackComponentKey || "");
  const separatorIndex = component.indexOf(":");
  let uri = separatorIndex >= 0 ? component.slice(separatorIndex + 1) : component;
  // Ensure we don't have a leading slash which can break some SARIF viewers
  return uri.startsWith("/") ? uri.slice(1) : uri;
}

function collectStringValues(input, output) {
  if (input === null || input === undefined) return;
  if (typeof input === "string") {
    const value = input.trim();
    if (value) output.add(value);
    return;
  }
  if (Array.isArray(input)) {
    for (const item of input) collectStringValues(item, output);
    return;
  }
  if (typeof input === "object") {
    for (const value of Object.values(input)) {
      collectStringValues(value, output);
    }
  }
}

function extractSonarStandards(ruleMeta = {}) {
  const standards = new Set();

  collectStringValues(ruleMeta?.securityStandards, standards);
  collectStringValues(ruleMeta?.tags, standards);
  collectStringValues(ruleMeta?.sysTags, standards);

  return standards.size > 0 ? Array.from(standards) : null;
}

function createSonarSarifResponse(issuesResponse, componentKey, ruleMetaMap = {}) {
  const issues = Array.isArray(issuesResponse?.issues) ? issuesResponse.issues : [];
  const ruleMap = new Map();

  const sarifResults = issues.map((issue) => {
    const ruleId = issue.rule || issue.ruleKey || issue.key || "sonar-issue";
    const region = issue.textRange || {};

    if (!ruleMap.has(ruleId)) {
      const meta = ruleMetaMap?.[ruleId] || {};
      ruleMap.set(ruleId, {
        id: ruleId,
        name: meta.name || ruleId,
        shortDescription: {
          text: meta?.name || issue.message || ruleId,
        },
        fullDescription: {
          text: meta?.htmlDesc || meta?.name || issue.message || ruleId,
        },
        properties: {
          tags: Array.isArray(meta?.tags) ? meta.tags : null,
          sysTags: Array.isArray(meta?.sysTags) ? meta.sysTags : null,
          securityStandards: meta?.securityStandards || null,
          allStandardsViolated: extractSonarStandards(meta),
        },
      });
    }

    return {
      ruleId,
      level: mapSonarSeverityToSarifLevel(issue.severity),
      message: {
        text: issue.message || ruleId,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: getSonarArtifactUri(issue, componentKey),
            },
            region: {
              startLine: region.startLine || 1,
              startColumn: region.startOffset || 1,
              endLine: region.endLine || region.startLine || 1,
              endColumn: region.endOffset || region.startOffset || 1,
            },
          },
        },
      ],
      properties: {
        severity: issue.severity || null,
        type: issue.type || null,
        category: issue.type === "VULNERABILITY" ? "Security" : "Quality",
        effort: issue.effort || null,
        status: issue.status || null,
        rule: issue.rule || null,
        tags: ruleMetaMap?.[ruleId]?.tags || null,
        sysTags: ruleMetaMap?.[ruleId]?.sysTags || null,
        securityStandards: ruleMetaMap?.[ruleId]?.securityStandards || null,
        allStandardsViolated: extractSonarStandards(ruleMetaMap?.[ruleId]),
      },
    };
  });

  return {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "SonarQube",
            informationUri: "https://www.sonarsource.com/products/sonarqube/",
            rules: Array.from(ruleMap.values()),
          },
        },
        results: sarifResults,
        properties: {
          componentKey,
          totalIssues: sarifResults.length,
          paging: issuesResponse?.paging || null,
        },
      },
    ],
  };
}

export async function analyzeCode(humanCode, llmCode, language = "javascript") {
  let sessionId;
  let projectKey;

  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    sessionId = uuidv4();
    projectKey = `session-${sessionId}`;
    const projectDir = path.join(TEMP_DIR, projectKey);
    const fileExtension = resolveSonarExtension(language);

    console.log("Starting batched analysis for session:", sessionId);

    // Setup project directory
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, `human.${fileExtension}`),
      humanCode,
      "utf-8",
    );
    await fs.writeFile(
      path.join(projectDir, `llm.${fileExtension}`),
      llmCode,
      "utf-8",
    );

    // Run combined analysis
    await runSonarAnalysis(projectDir, projectKey, fileExtension);

    // Fetch results for each file
    // Component key format in SonarQube is "projectKey:fileName"
    const humanMetrics = await fetchFileMetrics(
      `${projectKey}:human.${fileExtension}`,
    );
    const llmMetrics = await fetchFileMetrics(
      `${projectKey}:llm.${fileExtension}`,
    );

    return {
      success: true,
      sessionId,
      human: humanMetrics,
      llm: llmMetrics,
    };
  } catch (error) {
    console.error("Error in analyzeCode:", error);
    return {
      success: false,
      error: error.message,
      details: error.response?.data || null,
      human: null,
      llm: null,
    };
  } finally {
    // Cleanup
    if (sessionId) {
      try {
        await fs.rm(path.join(TEMP_DIR, projectKey), {
          recursive: true,
          force: true,
        });
      } catch (e) {
        console.error(`Failed to cleanup ${projectKey}:`, e);
      }
    }
  }
}

async function runSonarAnalysis(projectDir, projectKey, fileExtension) {
  console.log(`Running SonarQube scanner for ${projectKey}...`);

  const cachePath = path.resolve(process.cwd(), "../.cache/sonarqube");
  await fs.mkdir(cachePath, { recursive: true });
  process.env.SONAR_USER_HOME = cachePath;
  process.env.SONAR_SCANNER_OPTS = "-Xmx2048m"; // Optimized to 2GB

  // Enforce 2GB memory limit
  process.env.SONAR_SCANNER_OPTS = "-Xmx2048m";

  const scannedFiles = ["human", "llm"];
  const sonarInclusions = scannedFiles.map((name) => `${name}.${fileExtension}`).join(",");

  // Use NPM sonarqube-scanner
  await new Promise((resolve, reject) => {
    scanner(
      {
        serverUrl: SONARQUBE_URL,
        token: SONARQUBE_TOKEN,
        options: {
          "sonar.projectKey": projectKey,
          "sonar.projectName": projectKey,
          "sonar.projectBaseDir": projectDir,
          "sonar.sources": ".",
          "sonar.inclusions": sonarInclusions,
          "sonar.filesize.limit": "100",
          "sonar.javascript.maxFileSize": "100000",
          "sonar.typescript.maxFileSize": "100000",
          "sonar.scm.disabled": "true",
        },
      },
      async (err) => {
        if (err) return reject(err);

        console.log("Scanner finished. Reading SonarQube task metadata...");

        const taskId = await readSonarTaskId(projectDir);
        if (!taskId) {
          throw new Error("SonarQube did not produce a ceTaskId in report-task.txt");
        }

        await waitForTask(taskId);
        resolve();
      },
    );
  });
}

async function readSonarTaskId(projectDir) {
  const reportTaskPath = path.join(projectDir, ".scannerwork", "report-task.txt");

  try {
    const content = await fs.readFile(reportTaskPath, "utf-8");
    const match = content.match(/^ceTaskId=(.+)$/m);
    if (match?.[1]) {
      console.log(`SonarQube task id: ${match[1].trim()}`);
      return match[1].trim();
    }

    console.warn(`report-task.txt found but ceTaskId missing at ${reportTaskPath}`);
    return null;
  } catch (error) {
    console.error(`Failed to read SonarQube report-task.txt at ${reportTaskPath}:`, error.message);
    return null;
  }
}

async function waitForTask(taskId) {
  console.log(`Waiting for task ${taskId} to complete...`);
  const auth = Buffer.from(`${SONARQUBE_TOKEN}:`).toString("base64");
  const headers = { Authorization: `Basic ${auth}` };

  // Adaptive polling
  let pollInterval = 500;
  const maxRetries = 60; // 30-60 seconds max

  for (let i = 0; i < maxRetries; i++) {
    const { data } = await axios.get(`${SONARQUBE_URL}/api/ce/task`, {
      params: { id: taskId },
      headers,
    });

    const status = data.task?.status;
    if (status === "SUCCESS") return;
    if (status === "FAILED" || status === "CANCELED")
      throw new Error(`Analysis ${status}`);

    await new Promise((r) => setTimeout(r, pollInterval));
    pollInterval = Math.min(pollInterval + 200, 2000);
  }
  throw new Error("Analysis task timed out");
}

async function fetchFileMetrics(componentKey) {
    const auth = Buffer.from(`${SONARQUBE_TOKEN}:`).toString("base64");
    const headers = { Authorization: `Basic ${auth}` };

    console.log(`Fetching metrics for: ${componentKey}`);

    // Loop for up to 30 seconds
    for (let i = 0; i < 15; i++) {
        try {
            // First: Check if the component even exists in the DB
            await axios.get(`${SONARQUBE_URL}/api/components/show`, {
                params: { component: componentKey },
                headers
            });

            // Second: If it exists, get all issues for the component across pages
            const pageSize = 100;
            let pageIndex = 1;
            let allIssues = [];
            let paging = null;

            while (true) {
              const issuesResp = await axios.get(`${SONARQUBE_URL}/api/issues/search`, {
                params: { componentKeys: componentKey, ps: pageSize, p: pageIndex },
                headers,
              });

              const pageIssues = Array.isArray(issuesResp.data?.issues) ? issuesResp.data.issues : [];
              allIssues = allIssues.concat(pageIssues);
              paging = issuesResp.data?.paging || paging;

              const total = paging?.total ?? issuesResp.data?.total ?? 0;
              if (pageIssues.length < pageSize) break;
              if (total && allIssues.length >= total) break;
              pageIndex += 1;
            }

            const issuesResp = {
                data: {
                    issues: allIssues,
                    paging,
                },
            };

            // Fetch rule metadata (tags, etc.) for each unique ruleId so we can
            // surface standards (CWE/OWASP) in SARIF output.
            const uniqueRuleIds = Array.from(new Set(allIssues.map(i => i.rule).filter(Boolean)));
            const ruleMetaMap = {};

            for (const rId of uniqueRuleIds) {
              try {
                const resp = await axios.get(`${SONARQUBE_URL}/api/rules/show`, {
                  params: {
                    key: rId,
                    f: "name,htmlDesc,mdDesc,tags,sysTags,securityStandards,cleanCodeAttribute,cleanCodeAttributeCategory,impacts",
                  },
                  headers,
                });
                // Sonar returns rule in resp.data.rule
                if (resp?.data?.rule) {
                  ruleMetaMap[rId] = resp.data.rule;
                }
              } catch (e) {
                // Non-fatal: continue without tags for this rule
                console.warn(`Failed to fetch rule metadata for ${rId}: ${e?.message || e}`);
              }
            }

            console.log(`SonarQube default response for ${componentKey}:`);
            console.log(JSON.stringify(issuesResp.data, null, 2));

            const sarifResponse = createSonarSarifResponse(issuesResp.data, componentKey, ruleMetaMap);

            console.log(`SonarQube SARIF response for ${componentKey}:`);
            console.log(JSON.stringify(sarifResponse, null, 2));

            return {
              ...sarifResponse,
            };

        } catch (error) {
            if (error.response?.status === 404) {
                console.log(`[Attempt ${i+1}] Component not ready yet, retrying...`);
                // Wait 2 seconds before retrying
                await new Promise(r => setTimeout(r, 2000));
            } else {
                throw error; // If it's a 500 or 401, stop immediately
            }
        }
    }
    throw new Error(`Component ${componentKey} failed to appear in SonarQube after 30s`);
}
