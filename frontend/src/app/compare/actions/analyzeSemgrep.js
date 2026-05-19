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

export async function analyzeSemgrep(humanCode, llmCode, language = "javascript") {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    const sessionId = uuidv4();

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
    return {
      success: false,
      error: error.message,
      details: error.stack,
    };
  }
}

async function analyzeSingleCodeSemgrep(code, projectKey, language) {
  const projectDir = path.join(TEMP_DIR, projectKey);
  await fs.mkdir(projectDir, { recursive: true });

  const { extension } = resolveSemgrepLanguage(language);
  const filePath = path.join(projectDir, `code.${extension}`);
  await fs.writeFile(filePath, code, "utf-8");

  const dockerPath = toDockerPath(projectDir);
  const dockerCmd = getDockerCommand();

  const command = `${dockerCmd} run --rm -v "${dockerPath}:/src" semgrep/semgrep semgrep --config=auto --sarif --no-git-ignore /src/code.${extension}`;

  try {
    const { stdout } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10,
    });

    const result = JSON.parse(stdout);

    const findings = result.runs?.[0]?.results || [];
    const rulesMetadata = result.runs?.[0]?.tool?.driver?.rules || [];

    if (findings.length > 0) {
      findings.forEach((finding, idx) => {
        const ruleId = finding.ruleId;
        const ruleDef = rulesMetadata.find(r => r.id === ruleId);

        const location = finding.locations?.[0]?.physicalLocation;
        const region = location?.region;

        const tags = ruleDef?.properties?.tags || [];
        const cwe = tags.find(t => t.startsWith("CWE-"));
        const owasp = tags.find(t => t.toLowerCase().includes("owasp"));
      });
    }

    await fs.writeFile(
      path.join(projectDir, "semgrep-output.sarif"),
      JSON.stringify(result, null, 2),
      "utf-8"
    );

    return result;
  } catch (execError) {
    if (execError.stdout) {
      try {
        return JSON.parse(execError.stdout);
      } catch (parseError) {
      }
    }

    throw new Error(`Semgrep analysis failed: ${execError.stderr || execError.message}`);
  }
}