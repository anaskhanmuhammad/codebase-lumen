"use server";

import fs from "fs/promises";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import scanner from "sonarqube-scanner";
import { execFile } from "child_process";
import { promisify } from "util";

const SONARQUBE_URL = process.env.SONARQUBE_URL || "http://localhost:9000";
const SONARQUBE_TOKEN = process.env.SONARQUBE_TOKEN;

if (!SONARQUBE_TOKEN) {
}

const TEMP_DIR = path.join(process.cwd(), "temp_analysis");
const REPO_SCAN_MAX_MB = Number(process.env.REPO_SCAN_MAX_MB || "200");
const execFileAsync = promisify(execFile);

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

function parseGitHubRepoUrl(repoUrl) {
  const normalized = String(repoUrl || "").trim();
  const match = normalized.match(/^https:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?\/?$/i);
  if (!match) return null;

  const owner = match[1];
  const repo = match[2];
  return {
    owner,
    repo,
    normalizedUrl: `https://github.com/${owner}/${repo}.git`,
  };
}

async function fetchGitHubRepoInfo(owner, repo) {
  const { data } = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { "User-Agent": "lumen-repo-scanner" },
  });
  return {
    defaultBranch: data?.default_branch || "main",
    sizeKb: typeof data?.size === "number" ? data.size : null,
    isPrivate: Boolean(data?.private),
  };
}

async function fetchGitHubBranches(owner, repo) {
  const { data } = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/branches`,
    {
      headers: { "User-Agent": "lumen-repo-scanner" },
      params: { per_page: 100 },
    }
  );

  if (!Array.isArray(data)) return [];
  return data.map((branch) => branch?.name).filter(Boolean);
}

async function getDirectorySizeBytes(dirPath) {
  let total = 0;
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += await getDirectorySizeBytes(fullPath);
    } else if (entry.isFile()) {
      const stats = await fs.stat(fullPath);
      total += stats.size;
    }
  }

  return total;
}

function summarizeSarif(sarif) {
  const results = sarif?.runs?.[0]?.results || [];
  let critical = 0;
  let major = 0;
  let minor = 0;
  let info = 0;

  for (const result of results) {
    const sev = String(result?.properties?.severity || "").toUpperCase();
    if (sev === "BLOCKER" || sev === "CRITICAL") critical += 1;
    else if (sev === "MAJOR") major += 1;
    else if (sev === "MINOR") minor += 1;
    else info += 1;
  }

  return {
    total: results.length,
    critical,
    major,
    minor,
    info,
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
    const sonarInclusions = [`human.${fileExtension}`, `llm.${fileExtension}`].join(",");
    await runSonarAnalysis(projectDir, projectKey, sonarInclusions);

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
      }
    }
  }
}

async function runSonarAnalysis(projectDir, projectKey, sonarInclusions) {
  console.log(`Running SonarQube scanner for ${projectKey}...`);

  const cachePath = path.resolve(process.cwd(), "../.cache/sonarqube");
  await fs.mkdir(cachePath, { recursive: true });
  process.env.SONAR_USER_HOME = cachePath;
  process.env.SONAR_SCANNER_OPTS = "-Xmx2048m";

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
          ...(sonarInclusions ? { "sonar.inclusions": sonarInclusions } : {}),
          "sonar.filesize.limit": "100",
          "sonar.javascript.maxFileSize": "100000",
          "sonar.typescript.maxFileSize": "100000",
          "sonar.scm.disabled": "true",
        },
      },
      async (err) => {
        if (err) return reject(err);

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

export async function fetchRepositoryBranches(repoUrl) {
  const parsed = parseGitHubRepoUrl(repoUrl);
  if (!parsed) {
    return { success: false, error: "Invalid GitHub repository URL" };
  }

  try {
    const repoInfo = await fetchGitHubRepoInfo(parsed.owner, parsed.repo);
    if (repoInfo.isPrivate) {
      return { success: false, error: "Private repositories are not supported" };
    }

    const branches = await fetchGitHubBranches(parsed.owner, parsed.repo);
    const defaultBranch = repoInfo.defaultBranch || branches[0] || "main";

    return {
      success: true,
      owner: parsed.owner,
      repo: parsed.repo,
      defaultBranch,
      branches,
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || "Failed to fetch repository branches",
    };
  }
}

export async function scanRepository(repoUrl, branch) {
  const parsed = parseGitHubRepoUrl(repoUrl);
  if (!parsed) {
    return { success: false, error: "Invalid GitHub repository URL" };
  }

  const branchName = String(branch || "").trim();
  if (!branchName) {
    return { success: false, error: "Branch is required" };
  }

  let workspace = null;

  try {
    const repoInfo = await fetchGitHubRepoInfo(parsed.owner, parsed.repo);
    if (repoInfo.isPrivate) {
      return { success: false, error: "Private repositories are not supported" };
    }

    if (repoInfo.sizeKb && repoInfo.sizeKb > REPO_SCAN_MAX_MB * 1024) {
      return { success: false, error: `Repository exceeds ${REPO_SCAN_MAX_MB} MB limit.` };
    }

    workspace = await fs.mkdtemp(path.join(os.tmpdir(), "lumen-repo-scan-"));
    const repoDir = path.join(workspace, "repo");

    await execFileAsync("git", [
      "clone",
      "--depth",
      "1",
      "--branch",
      branchName,
      "--single-branch",
      parsed.normalizedUrl,
      repoDir,
    ]);

    const sizeBytes = await getDirectorySizeBytes(repoDir);
    if (sizeBytes > REPO_SCAN_MAX_MB * 1024 * 1024) {
      return { success: false, error: `Repository exceeds ${REPO_SCAN_MAX_MB} MB limit after clone.` };
    }

    const projectKey = `repo-${uuidv4()}`;
    await runSonarAnalysis(repoDir, projectKey, null);
    const sarif = await fetchFileMetrics(projectKey);

    return {
      success: true,
      sarif,
      summary: summarizeSarif(sarif),
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || "Repository scan failed",
    };
  } finally {
    if (workspace) {
      try {
        await fs.rm(workspace, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error("Failed to cleanup repo scan workspace:", cleanupError);
      }
    }
  }
}

async function readSonarTaskId(projectDir) {
  const reportTaskPath = path.join(projectDir, ".scannerwork", "report-task.txt");

  try {
    const content = await fs.readFile(reportTaskPath, "utf-8");
    const match = content.match(/^ceTaskId=(.+)$/m);
    if (match?.[1]) {
      return match[1].trim();
    }

    return null;
  } catch (error) {
    return null;
  }
}

async function waitForTask(taskId) {
  const auth = Buffer.from(`${SONARQUBE_TOKEN}:`).toString("base64");
  const headers = { Authorization: `Basic ${auth}` };

  let pollInterval = 500;
  const maxRetries = 60;

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

    for (let i = 0; i < 15; i++) {
        try {
            await axios.get(`${SONARQUBE_URL}/api/components/show`, {
                params: { component: componentKey },
                headers
            });

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
                if (resp?.data?.rule) {
                  ruleMetaMap[rId] = resp.data.rule;
                }
              } catch (e) {
              }
            }

            const sarifResponse = createSonarSarifResponse(issuesResp.data, componentKey, ruleMetaMap);

            return {
              ...sarifResponse,
            };

        } catch (error) {
            if (error.response?.status === 404) {
                await new Promise(r => setTimeout(r, 2000));
            } else {
                throw error;
            }
        }
    }
    throw new Error(`Component ${componentKey} failed to appear in SonarQube after 30s`);
}
