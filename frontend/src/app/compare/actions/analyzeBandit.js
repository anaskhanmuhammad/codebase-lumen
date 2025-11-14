// app/actions/analyzeBandit.js
"use server";

import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { exec } from "child_process";
import { promisify } from "util";

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

  const outputPath = path.join(projectDir, "bandit-report.json");

  console.log(`Running Bandit analysis for ${identifier}...`);
  console.log(`Project directory: ${projectDir}`);

  // Convert Windows path to WSL path if needed
  let wslFilePath = filePath.replace(/\\/g, "/");
  let wslOutputPath = outputPath.replace(/\\/g, "/");

  if (wslFilePath.match(/^[A-Za-z]:/)) {
    const driveLetter = wslFilePath[0].toLowerCase();
    wslFilePath = `/mnt/${driveLetter}${wslFilePath.substring(2)}`;
    wslOutputPath = `/mnt/${driveLetter}${wslOutputPath.substring(2)}`;
  }

  console.log(`WSL file path: ${wslFilePath}`);
  console.log(`WSL output path: ${wslOutputPath}`);

  // Run Bandit via Docker
  // -f json: Output format as JSON
  // -o: Output file path
  // -r: Recursive (for directories)
  // -ll: Only show issues of level LOW or higher
  const command = `wsl -e docker run --rm -v "${path.dirname(
    wslFilePath
  )}:/code" cytopia/bandit -f json -o /code/bandit-report.json /code/${path.basename(
    filePath
  )}`;

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
    console.log(`Found ${banditResults.results?.length || 0} issues`);

    // Transform Bandit results to a standardized format
    const transformedResults = transformBanditResults(
      banditResults,
      identifier
    );

    return transformedResults;
  } catch (error) {
    console.error(
      `Error reading/parsing Bandit results for ${identifier}:`,
      error
    );
    throw new Error(`Failed to parse Bandit results: ${error.message}`);
  }
}

/**
 * Transforms Bandit results into a standardized format
 * @param {Object} banditResults - Raw Bandit JSON output
 * @param {string} identifier - Analysis identifier
 * @returns {Object} Transformed results
 */
function transformBanditResults(banditResults, identifier) {
  const issues = banditResults.results || [];
  const metrics = banditResults.metrics || {};

  // Calculate severity counts
  const severityCounts = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };

  // Calculate confidence counts
  const confidenceCounts = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  issues.forEach((issue) => {
    const severity = issue.issue_severity?.toUpperCase() || "LOW";
    const confidence = issue.issue_confidence?.toUpperCase() || "LOW";

    severityCounts[severity] = (severityCounts[severity] || 0) + 1;
    confidenceCounts[confidence] = (confidenceCounts[confidence] || 0) + 1;
  });

  // Transform individual issues
  const transformedIssues = issues.map((issue) => ({
    test_id: issue.test_id, // e.g., "B101"
    test_name: issue.test_name,
    issue_severity: issue.issue_severity,
    issue_confidence: issue.issue_confidence,
    issue_text: issue.issue_text,
    line_number: issue.line_number,
    line_range: issue.line_range,
    code: issue.code,
    filename: issue.filename,
    cwe: issue.issue_cwe
      ? {
          id: issue.issue_cwe.id,
          link: issue.issue_cwe.link,
        }
      : null,
    more_info: issue.more_info,
  }));

  return {
    identifier,
    summary: {
      total_issues: issues.length,
      severity_counts: severityCounts,
      confidence_counts: confidenceCounts,
      loc: metrics._totals?.loc || 0,
      nosec: metrics._totals?.nosec || 0,
      skipped_tests: metrics._totals?.skipped_tests || 0,
    },
    issues: transformedIssues,
    metrics: metrics,
    generated_at: new Date().toISOString(),
  };
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
