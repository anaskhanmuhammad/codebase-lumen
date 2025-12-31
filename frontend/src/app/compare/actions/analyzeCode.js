// app/actions/analyzeCode.js
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

export async function analyzeCode(humanCode, llmCode) {
  let sessionId;
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    sessionId = uuidv4();
    console.log("Starting analysis for session:", sessionId);

    const humanResult = await analyzeSingleCode(
      humanCode,
      `human-${sessionId}`
    );
    const llmResult = await analyzeSingleCode(llmCode, `llm-${sessionId}`);

    // Normalize for UI
    const normalize = (res) => ({
      measures: res.component?.measures || [],
      issues: res.issues || [], // You can extend to fetch security hotspots if needed
    });

    return {
      success: true,
      sessionId,
      human: normalize(humanResult),
      llm: normalize(llmResult),
    };
  } catch (error) {
    console.error("Error in analyzeCode:", error);
    return {
      success: false,
      error: error.message,
      details: error.response?.data || null,
      human: { measures: [], issues: [] },
      llm: { measures: [], issues: [] },
    };
  } finally {
    // Cleanup temporary files
    if (sessionId) {
      const clean = async (dir) => {
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch (e) {
          console.error(`Failed to cleanup ${dir}:`, e);
        }
      };
      await clean(path.join(TEMP_DIR, `human-${sessionId}`));
      await clean(path.join(TEMP_DIR, `llm-${sessionId}`));
    }
  }
}

async function analyzeSingleCode(code, projectKey) {
  const projectDir = path.join(TEMP_DIR, projectKey);
  await fs.mkdir(projectDir, { recursive: true });

  const filePath = path.join(projectDir, "code.js");
  await fs.writeFile(filePath, code, "utf-8");

  console.log(`Running SonarQube analysis for ${projectKey}...`);
  console.log(`Project directory: ${projectDir}`);

  // Configure cache to be in project root .cache/sonarqube folder
  const cachePath = path.resolve(process.cwd(), "../.cache/sonarqube");
  await fs.mkdir(cachePath, { recursive: true });
  process.env.SONAR_USER_HOME = cachePath;

  // Enforce 2GB memory limit
  process.env.SONAR_SCANNER_OPTS = "-Xmx8192m";

  // Capture the task ID from scanner output for status checking
  let taskId = null;

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
          "sonar.sources": "code.js",
          "sonar.scm.disabled": "true",
          "sonar.sourceEncoding": "UTF-8",
        },
      },
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          // Try to extract task ID from result if available
          taskId = result?.ceTaskId;
          resolve();
        }
      }
    );
  });

  const auth = Buffer.from(`${SONARQUBE_TOKEN}:`).toString("base64");
  const headers = { Authorization: `Basic ${auth}` };

  // If we have a task ID, poll the task status API (faster)
  if (taskId) {
    console.log(`Waiting for task ${taskId} to complete...`);
    const maxTaskRetries = 60;
    let pollInterval = 500; // Start with 500ms, increase over time

    for (let i = 0; i < maxTaskRetries; i++) {
      try {
        const taskResponse = await axios.get(
          `${SONARQUBE_URL}/api/ce/task`,
          { params: { id: taskId }, headers }
        );

        const status = taskResponse.data.task?.status;
        console.log(`Task status: ${status}`);

        if (status === "SUCCESS") {
          break;
        } else if (status === "FAILED" || status === "CANCELED") {
          throw new Error(`SonarQube analysis ${status.toLowerCase()}`);
        }
      } catch (error) {
        if (error.message.includes("analysis")) throw error;
        // API not ready yet, continue polling
      }

      await new Promise((r) => setTimeout(r, pollInterval));
      // Adaptive polling: increase interval gradually (max 2s)
      pollInterval = Math.min(pollInterval + 200, 2000);
    }
  }

  // Fetch measures with immediate first check and adaptive polling
  const maxRetries = 20;
  let retryDelay = 500; // Start fast

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(
        `${SONARQUBE_URL}/api/measures/component`,
        {
          params: {
            component: projectKey,
            metricKeys:
              "bugs,vulnerabilities,code_smells,security_hotspots,duplicated_lines_density,ncloc,complexity,coverage",
          },
          headers,
        }
      );

      if (response.data.component?.measures?.length > 0) {
        console.log(`Measures retrieved for ${projectKey}`);
        return response.data;
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }

    await new Promise((r) => setTimeout(r, retryDelay));
    // Adaptive: slow down over time (max 2s)
    retryDelay = Math.min(retryDelay + 300, 2000);
  }

  throw new Error(`Analysis for ${projectKey} did not produce measures.`);
}
