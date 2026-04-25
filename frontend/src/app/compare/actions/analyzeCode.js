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
  let projectKey;

  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    sessionId = uuidv4();
    projectKey = `session-${sessionId}`;
    const projectDir = path.join(TEMP_DIR, projectKey);

    console.log("Starting batched analysis for session:", sessionId);
    
    // Setup project directory
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, "human.js"), humanCode, "utf-8");
    await fs.writeFile(path.join(projectDir, "llm.js"), llmCode, "utf-8");

    // Run combined analysis
    await runSonarAnalysis(projectDir, projectKey);

    // Fetch results for each file
    // Component key format in SonarQube is "projectKey:fileName"
    const humanMetrics = await fetchFileMetrics(`${projectKey}:human.js`);
    const llmMetrics = await fetchFileMetrics(`${projectKey}:llm.js`);

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
        await fs.rm(path.join(TEMP_DIR, projectKey), { recursive: true, force: true });
      } catch (e) {
        console.error(`Failed to cleanup ${projectKey}:`, e);
      }
    }
  }
}

async function runSonarAnalysis(projectDir, projectKey) {
  console.log(`Running SonarQube scanner for ${projectKey}...`);
  
  const cachePath = path.resolve(process.cwd(), "../.cache/sonarqube");
  await fs.mkdir(cachePath, { recursive: true });
  process.env.SONAR_USER_HOME = cachePath;
  process.env.SONAR_SCANNER_OPTS = "-Xmx2048m"; // Optimized to 2GB

  // Enforce 2GB memory limit
  process.env.SONAR_SCANNER_OPTS = "-Xmx2048m";

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
          "sonar.sources": ".", // Scan all files in dir (human.js and llm.js)
          "sonar.scm.disabled": "true",
          "sonar.sourceEncoding": "UTF-8",
        },
      },
      async (err, result) => {
        if (err) return reject(err);

        // Polling for task completion
        const taskId = result?.ceTaskId;
        if (taskId) {
            try {
                await waitForTask(taskId);
                resolve();
            } catch(e) {
                reject(e);
            }
        } else {
            resolve();
        }
      }
    );
  });
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
            headers 
        });
        
        const status = data.task?.status;
        if (status === "SUCCESS") return;
        if (status === "FAILED" || status === "CANCELED") throw new Error(`Analysis ${status}`);

        await new Promise(r => setTimeout(r, pollInterval));
        pollInterval = Math.min(pollInterval + 200, 2000);
    }
    throw new Error("Analysis task timed out");
}

async function fetchFileMetrics(componentKey) {
    const auth = Buffer.from(`${SONARQUBE_TOKEN}:`).toString("base64");
    const headers = { Authorization: `Basic ${auth}` };
    const metricKeys = "bugs,vulnerabilities,code_smells,security_hotspots,duplicated_lines_density,ncloc,complexity,coverage";

    // Retry logic for fetching measures (DB consistency delay)
    let retryDelay = 500;
    for (let i = 0; i < 20; i++) {
        try {
            // Get measures
            const measuresResp = await axios.get(`${SONARQUBE_URL}/api/measures/component`, {
                params: { component: componentKey, metricKeys },
                headers
            });

            // Get issues
            const issuesResp = await axios.get(`${SONARQUBE_URL}/api/issues/search`, {
                params: { componentKeys: componentKey },
                headers
            });

            return {
              measuresResponse: measuresResp.data,
              issuesResponse: issuesResp.data,
            };

        } catch (error) {
            if (i === 19) throw error; 
            // 404 means component not ready yet in some versions, or DB delay
            await new Promise(r => setTimeout(r, retryDelay));
            retryDelay = Math.min(retryDelay + 300, 2000);
        }
    }
}
