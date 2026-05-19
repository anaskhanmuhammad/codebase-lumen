"use server";

import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { exec } from "child_process";
import { promisify } from "util";
import { toDockerPath, getDockerCommand } from "../utils/platformPaths.js";

const execAsync = promisify(exec);

const TEMP_DIR = path.join(process.cwd(), "temp_bandit_analysis");

export async function analyzeBandit(humanCode, llmCode) {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });

    const sessionId = uuidv4();

    const humanResult = await analyzeSingleCodeWithBandit(
      humanCode,
      `human-${sessionId}`
    );
    const llmResult = await analyzeSingleCodeWithBandit(
      llmCode,
      `llm-${sessionId}`
    );

    return {
      success: true,
      sessionId,
      human: humanResult,
      llm: llmResult,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.stack || null,
    };
  }
}

async function analyzeSingleCodeWithBandit(code, identifier) {
  const projectDir = path.join(TEMP_DIR, identifier);
  await fs.mkdir(projectDir, { recursive: true });

  const filePath = path.join(projectDir, "code.py");
  await fs.writeFile(filePath, code, "utf-8");

  const outputPath = path.join(projectDir, "bandit-report.sarif");

  const dockerProjectPath = toDockerPath(projectDir);
  const dockerCmd = getDockerCommand();
  const command = `${dockerCmd} run --rm -v "${dockerProjectPath}:/code" python:3.11-slim sh -c "pip install --quiet bandit bandit-sarif-formatter && bandit -r /code -f sarif -o /code/bandit-report.sarif"`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10,
    });
  } catch (execError) {
    try {
      await fs.access(outputPath);
    } catch (accessError) {
      throw new Error(
        `Bandit analysis failed: ${execError.stderr || execError.message}`
      );
    }
  }

  try {
    const reportContent = await fs.readFile(outputPath, "utf-8");
    const banditResults = JSON.parse(reportContent);

    const issueCount = banditResults.runs?.[0]?.results?.length || 0;

    return banditResults;
  } catch (error) {
    throw new Error(`Failed to parse Bandit results: ${error.message}`);
  }
}

export async function analyzePythonWithBandit(code, language = "python") {
  if (language.toLowerCase() !== "python") {
    return {
      success: false,
      error: "Bandit only supports Python code",
      skipped: true,
    };
  }

  const sessionId = uuidv4();

  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });

    const result = await analyzeSingleCodeWithBandit(
      code,
      `python-${sessionId}`
    );

    return {
      success: true,
      sessionId,
      result,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}
