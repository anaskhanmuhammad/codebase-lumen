// app/actions/analyzeBandit.js
"use server";

import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { exec } from "child_process";
import { promisify } from "util";
import { toDockerPath, getDockerCommand } from "../utils/platformPaths.js";

const execAsync = promisify(exec);

const TEMP_DIR = path.join(process.cwd(), "temp_bandit_analysis");

/**
 * Analyzes code using Bandit security tool
 * @param {string} humanCode - Human-written code
 * @param {string} llmCode - LLM-generated code
 * @returns {Promise<Object>} Analysis results for both code samples
 */
export async function analyzeBandit(humanCode, llmCode) {
  try {
    // Create temp directory
    await fs.mkdir(TEMP_DIR, { recursive: true });

    const sessionId = uuidv4();

    console.log("Starting Bandit analysis for session:", sessionId);

    // Analyze both code samples
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
    console.error("Error in analyzeBandit:", error);
    return {
      success: false,
      error: error.message,
      details: error.stack || null,
    };
  }
}

/**
 * Analyzes a single code sample with Bandit
 * @param {string} code - Code to analyze
 * @param {string} identifier - Unique identifier for this analysis
 * @returns {Promise<Object>} Bandit analysis results
 */
async function analyzeSingleCodeWithBandit(code, identifier) {
  const projectDir = path.join(TEMP_DIR, identifier);
  await fs.mkdir(projectDir, { recursive: true });

  // Bandit only works with Python files
  const filePath = path.join(projectDir, "code.py");
  await fs.writeFile(filePath, code, "utf-8");

  const outputPath = path.join(projectDir, "bandit-report.sarif");

  console.log(`Running Bandit analysis for ${identifier}...`);
  console.log(`Project directory: ${projectDir}`);

  // Convert to Docker-compatible path (works on Ubuntu, WSL, and Docker Desktop)
  const dockerProjectPath = toDockerPath(projectDir);
  const dockerCmd = getDockerCommand();

  console.log(`Docker path: ${dockerProjectPath}`);
  console.log(`Docker command: ${dockerCmd}`);

  // Run Bandit via Docker
  // -f sarif: Output format as SARIF
  // -o: Output file path
  // -r: Recursive (for directories)
  // -ll: Only show issues of level LOW or higher
// Change the image from cytopia/bandit to pysec/bandit
// Change the image to the official ghcr.io repository
  const command = `${dockerCmd} run --rm -v "${dockerProjectPath}:/code" python:3.11-slim sh -c "pip install --quiet bandit bandit-sarif-formatter && bandit -r /code -f sarif -o /code/bandit-report.sarif"`;

  console.log(`Executing: ${command}`);

  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });

    console.log(`Bandit stdout for ${identifier}:`, stdout);
    if (stderr) {
      console.log(`Bandit stderr for ${identifier}:`, stderr);
    }
  } catch (execError) {
    // Bandit returns non-zero exit code when it finds issues
    // So we need to check if the output file was created
    console.log(
      `Bandit command completed for ${identifier} (may have found issues)`
    );

    // Check if output file exists
    try {
      await fs.access(outputPath);
      console.log(`Output file created successfully for ${identifier}`);
    } catch (accessError) {
      console.error(
        `Failed to create output file for ${identifier}:`,
        execError
      );
      throw new Error(
        `Bandit analysis failed: ${execError.stderr || execError.message}`
      );
    }
  }

  // Read and parse the results
  console.log(`Reading Bandit results for ${identifier}...`);

  try {
    const reportContent = await fs.readFile(outputPath, "utf-8");
    const banditResults = JSON.parse(reportContent);

    console.log(`Successfully parsed Bandit results for ${identifier}`);
    const issueCount = banditResults.runs?.[0]?.results?.length || 0;
    console.log(`Successfully parsed Bandit SARIF results for ${identifier}`);
    console.log(`Found ${issueCount} issues`);

    return banditResults;
  } catch (error) {
    console.error(
      `Error reading/parsing Bandit results for ${identifier}:`,
      error
    );
    throw new Error(`Failed to parse Bandit results: ${error.message}`);
  }
}

/**
 * Cleans up temporary analysis files
 * @param {string} projectDir - Directory to clean up
 */

/**
 * Alternative function to analyze only Python code with Bandit
 * Validates that the code is Python before analysis
 * @param {string} code - Code to analyze
 * @param {string} language - Programming language
 * @returns {Promise<Object>} Analysis results or null if not Python
 */
export async function analyzePythonWithBandit(code, language = "python") {
  if (language.toLowerCase() !== "python") {
    console.log(`Bandit skipped: Language is ${language}, not Python`);
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
    console.error("Error in analyzePythonWithBandit:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
