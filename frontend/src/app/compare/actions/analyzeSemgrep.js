"use server";

import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { exec } from "child_process";
import { promisify } from "util";
import { toDockerPath, getDockerCommand } from "../utils/platformPaths.js";

const execAsync = promisify(exec);
const TEMP_DIR = path.join(process.cwd(), "temp_semgrep");

const SEMGREP_LANGUAGE_MAP = {
  python: { extension: "py" },
  javascript: { extension: "js" },
  typescript: { extension: "ts" },
  java: { extension: "java" },
  cpp: { extension: "cpp" },
  csharp: { extension: "cs" },
  go: { extension: "go" },
  rust: { extension: "rs" },
  ruby: { extension: "rb" },
  php: { extension: "php" },
  kotlin: { extension: "kt" },
  swift: { extension: "swift" },
  sql: { extension: "sql" },
  bash: { extension: "sh" },
};

function resolveSemgrepLanguage(language) {
  const normalized = String(language || "").trim().toLowerCase();
  return (
    SEMGREP_LANGUAGE_MAP[normalized] ||
    SEMGREP_LANGUAGE_MAP.javascript
  );
}

/**
 * Analyze two code samples using Semgrep.
 */
export async function analyzeSemgrep(humanCode, llmCode, language = "javascript") {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    const sessionId = uuidv4();

    console.log("🚀 Starting Semgrep SARIF analysis for session:", sessionId);

    const [humanResult, llmResult] = await Promise.all([
      analyzeSingleCodeSemgrep(humanCode, `human-${sessionId}`, language),
      analyzeSingleCodeSemgrep(llmCode, `llm-${sessionId}`, language),
    ]);

    return {
      success: true,
      sessionId,
      timestamp: new Date().toISOString(),
      human: humanResult,
      llm: llmResult,
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
 * Analyze a single code sample with Semgrep via Docker returning SARIF.
 */
async function analyzeSingleCodeSemgrep(code, projectKey, language) {
  const projectDir = path.join(TEMP_DIR, projectKey);
  await fs.mkdir(projectDir, { recursive: true });

  const { extension } = resolveSemgrepLanguage(language);
  const filePath = path.join(projectDir, `code.${extension}`);
  await fs.writeFile(filePath, code, "utf-8");

  const dockerPath = toDockerPath(projectDir);
  const dockerCmd = getDockerCommand();

  // --- CHANGE: Changed --json to --sarif ---
  const command = `${dockerCmd} run --rm -v "${dockerPath}:/src" semgrep/semgrep semgrep --config=auto --sarif --no-git-ignore /src/code.${extension}`;
  
  console.log(`🔎 Executing Semgrep SARIF: ${command}\n`);

  try {
    const { stdout } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10,
    });

    const result = JSON.parse(stdout);

    // --- CHANGE: SARIF structure access ---
    // SARIF results are inside runs[0].results
    const findings = result.runs?.[0]?.results || [];
    // SARIF rule metadata is inside runs[0].tool.driver.rules
    const rulesMetadata = result.runs?.[0]?.tool?.driver?.rules || [];

    console.log(`✅ Semgrep found ${findings.length} issue(s) for ${projectKey}`);

    if (findings.length > 0) {
      console.log("=== SARIF Findings Summary ===");
      findings.forEach((finding, idx) => {
        // Find the rule definition to get CWE/Category metadata
        const ruleId = finding.ruleId;
        const ruleDef = rulesMetadata.find(r => r.id === ruleId);
        
        // SARIF uses locations[0].physicalLocation.region
        const location = finding.locations?.[0]?.physicalLocation;
        const region = location?.region;

        console.log(`\n#${idx + 1}`);
        console.log(`Rule ID: ${ruleId}`);
        console.log(`Level: ${finding.level || "warning"}`); // error, warning, or note
        console.log(`Message: ${finding.message?.text}`);
        console.log(`File: ${location?.artifactLocation?.uri}`);
        console.log(`Location: Line ${region?.startLine}, Col ${region?.startColumn}`);

        // Extract metadata from Rule Definition tags/properties
        const tags = ruleDef?.properties?.tags || [];
        const cwe = tags.find(t => t.startsWith("CWE-"));
        const owasp = tags.find(t => t.toLowerCase().includes("owasp"));

        if (cwe) console.log(`CWE: ${cwe}`);
        if (owasp) console.log(`OWASP: ${owasp}`);

        console.log(`Code Snippet:\n${region?.snippet?.text || "(no snippet available)"}`);
      });
      console.log("\n=========================\n");
    }

    // Save as .sarif file
    await fs.writeFile(
      path.join(projectDir, "semgrep-output.sarif"),
      JSON.stringify(result, null, 2),
      "utf-8"
    );

    return result;
  } catch (execError) {
    console.error(`❌ Semgrep failed for ${projectKey}:`, execError);

    if (execError.stdout) {
      try {
        return JSON.parse(execError.stdout);
      } catch (parseError) {
        console.error("Failed to parse Semgrep SARIF output:", parseError);
      }
    }

    throw new Error(`Semgrep analysis failed: ${execError.stderr || execError.message}`);
  }
}