"use server";

import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { exec } from "child_process";
import { promisify } from "util";
import { toDockerPath, getDockerCommand } from "../utils/platformPaths.js";

const execAsync = promisify(exec);
const TEMP_DIR = path.join(process.cwd(), "temp_semgrep");

/**
 * Analyze two code samples using Semgrep.
 */
export async function analyzeSemgrep(humanCode, llmCode, language = "js") {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    const sessionId = uuidv4();

    console.log("🚀 Starting Semgrep analysis for session:", sessionId);

    // Run both analyses in parallel
    const [humanResult, llmResult] = await Promise.all([
      analyzeSingleCodeSemgrep(humanCode, `human-${sessionId}`, language),
      analyzeSingleCodeSemgrep(llmCode, `llm-${sessionId}`, language),
    ]);

    // Aggregate metrics
    const humanMetrics = calculateMetrics(humanResult);
    const llmMetrics = calculateMetrics(llmResult);

    return {
      success: true,
      sessionId,
      timestamp: new Date().toISOString(),
      human: {
        raw: humanResult,
        metrics: humanMetrics,
        findings: humanResult.results || [],
      },
      llm: {
        raw: llmResult,
        metrics: llmMetrics,
        findings: llmResult.results || [],
      },
      comparison: {
        totalIssues: {
          human: humanMetrics.totalIssues,
          llm: llmMetrics.totalIssues,
          difference: llmMetrics.totalIssues - humanMetrics.totalIssues,
        },
        bySeverity: {
          human: humanMetrics.bySeverity,
          llm: llmMetrics.bySeverity,
        },
        byCategory: {
          human: humanMetrics.byCategory,
          llm: llmMetrics.byCategory,
        },
      },
    };
  } catch (error) {
    console.error("❌ Error in analyzeSemgrep:", error);
    return {
      success: false,
      error: error.message,
      details: error.stack,
    };
  }
}

/**
 * Analyze a single code sample with Semgrep via Docker (in WSL if needed).
 */
async function analyzeSingleCodeSemgrep(code, projectKey, language) {
  const projectDir = path.join(TEMP_DIR, projectKey);
  await fs.mkdir(projectDir, { recursive: true });

  const filePath = path.join(projectDir, `code.${language}`);
  await fs.writeFile(filePath, code, "utf-8");

  console.log(`\n🔎 Running Semgrep analysis for ${projectKey}...`);
  console.log(`Project directory: ${projectDir}`);

  // Convert to Docker-compatible path (works on Ubuntu, WSL, and Docker Desktop)
  const dockerPath = toDockerPath(projectDir);
  const dockerCmd = getDockerCommand();

  console.log(`Docker path: ${dockerPath}`);
  console.log(`Docker command: ${dockerCmd}`);

  // Semgrep Docker command
  const command = `${dockerCmd} run --rm -v "${dockerPath}:/src" semgrep/semgrep semgrep --config=auto --json --no-git-ignore /src/code.${language}`;
  console.log(`Executing: ${command}\n`);

  try {
    const { stdout } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10, // 10 MB buffer
    });

    const result = JSON.parse(stdout);
    const issueCount = result.results?.length || 0;

    console.log(`✅ Semgrep found ${issueCount} issue(s) for ${projectKey}`);

    if (issueCount > 0) {
      console.log("=== Findings Summary ===");
      result.results.forEach((finding, idx) => {
        console.log(`\n#${idx + 1}`);
        console.log(`Rule: ${finding.check_id}`);
        console.log(`Severity: ${finding.extra?.severity || "N/A"}`);
        console.log(`Message: ${finding.extra?.message}`);
        console.log(`File: ${finding.path}`);
        console.log(
          `Location: Line ${finding.start?.line}, Col ${finding.start?.col}`
        );

        if (finding.extra?.metadata?.cwe) {
          console.log(`CWE: ${finding.extra.metadata.cwe}`);
        }
        if (finding.extra?.metadata?.owasp) {
          console.log(`OWASP: ${finding.extra.metadata.owasp}`);
        }

        console.log(
          `\nCode Snippet:\n${finding.extra?.lines || "(no snippet available)"}`
        );
      });
      console.log("\n=========================\n");
    }

    // Save full JSON output to file for reference
    await fs.writeFile(
      path.join(projectDir, "semgrep-output.json"),
      JSON.stringify(result, null, 2),
      "utf-8"
    );

    return result;
  } catch (execError) {
    console.error(`❌ Semgrep failed for ${projectKey}:`, execError);

    if (execError.stdout) {
      try {
        const result = JSON.parse(execError.stdout);
        return result;
      } catch (parseError) {
        console.error("Failed to parse Semgrep JSON output:", parseError);
      }
    }

    throw new Error(
      `Semgrep analysis failed: ${execError.stderr || execError.message}`
    );
  }
}

/**
 * Compute aggregated metrics from Semgrep results.
 */
function calculateMetrics(semgrepResult) {
  const findings = semgrepResult.results || [];

  const metrics = {
    totalIssues: findings.length,
    bySeverity: { ERROR: 0, WARNING: 0, INFO: 0 },
    byCategory: {
      security: 0,
      "best-practice": 0,
      correctness: 0,
      performance: 0,
      maintainability: 0,
      other: 0,
    },
    uniqueRules: new Set(),
    filesScanned: new Set(),
  };

  for (const finding of findings) {
    const severity = finding.extra?.severity?.toUpperCase() || "INFO";
    if (metrics.bySeverity[severity] !== undefined)
      metrics.bySeverity[severity]++;

    const categories = finding.extra?.metadata?.category || [];
    const categoryArray = Array.isArray(categories) ? categories : [categories];
    let categorized = false;

    for (const cat of categoryArray) {
      const catLower = String(cat).toLowerCase();
      if (catLower.includes("security")) {
        metrics.byCategory.security++;
        categorized = true;
      } else if (
        catLower.includes("best-practice") ||
        catLower.includes("best_practice")
      ) {
        metrics.byCategory["best-practice"]++;
        categorized = true;
      } else if (catLower.includes("correctness")) {
        metrics.byCategory.correctness++;
        categorized = true;
      } else if (catLower.includes("performance")) {
        metrics.byCategory.performance++;
        categorized = true;
      } else if (catLower.includes("maintainability")) {
        metrics.byCategory.maintainability++;
        categorized = true;
      }
    }

    if (!categorized) metrics.byCategory.other++;

    if (finding.check_id) metrics.uniqueRules.add(finding.check_id);
    if (finding.path) metrics.filesScanned.add(finding.path);
  }

  metrics.uniqueRulesCount = metrics.uniqueRules.size;
  metrics.filesScannedCount = metrics.filesScanned.size;
  delete metrics.uniqueRules;
  delete metrics.filesScanned;

  return metrics;
}

/**
 * Format a finding for front-end display.
 */
export async function formatFindingForDisplay(finding) {
  return {
    ruleId: finding.check_id,
    severity: finding.extra?.severity || "INFO",
    message: finding.extra?.message || finding.check_id,
    line: finding.start?.line,
    column: finding.start?.col,
    endLine: finding.end?.line,
    endColumn: finding.end?.col,
    code: finding.extra?.lines,
    fix: finding.extra?.fix,
    metadata: {
      category: finding.extra?.metadata?.category,
      confidence: finding.extra?.metadata?.confidence,
      cwe: finding.extra?.metadata?.cwe,
      owasp: finding.extra?.metadata?.owasp,
      references: finding.extra?.metadata?.references,
    },
  };
}
