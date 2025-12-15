// app/actions/analyzeCode.js
"use server";

import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const SONARQUBE_URL = process.env.SONARQUBE_URL || "http://localhost:9000";
const SONARQUBE_TOKEN = process.env.SONARQUBE_TOKEN || "your_token_here";
const TEMP_DIR = path.join(process.cwd(), "temp_analysis");

export async function analyzeCode(humanCode, llmCode) {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    const sessionId = uuidv4();
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
  }
}

async function analyzeSingleCode(code, projectKey) {
  const projectDir = path.join(TEMP_DIR, projectKey);
  await fs.mkdir(projectDir, { recursive: true });

  const filePath = path.join(projectDir, "code.js");
  await fs.writeFile(filePath, code, "utf-8");

  const sonarProps = `sonar.projectKey=${projectKey}
sonar.projectName=${projectKey}
sonar.sources=.
sonar.sourceEncoding=UTF-8
`;
  await fs.writeFile(
    path.join(projectDir, "sonar-project.properties"),
    sonarProps
  );

  console.log(`Running SonarQube analysis for ${projectKey}...`);
  console.log(`Project directory: ${projectDir}`);

  let wslPath = projectDir.replace(/\\/g, "/");
  if (wslPath.match(/^[A-Za-z]:/)) {
    const driveLetter = wslPath[0].toLowerCase();
    wslPath = `/mnt/${driveLetter}${wslPath.substring(2)}`;
  }

  const command = `wsl -e docker run --rm --network=host -v "${wslPath}:/usr/src" sonarsource/sonar-scanner-cli -Dsonar.host.url=${SONARQUBE_URL} -Dsonar.login=${SONARQUBE_TOKEN}`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10,
    });
    console.log(`Scanner output for ${projectKey}:`, stdout);
    if (stderr && !stderr.includes("Pulling")) console.error(stderr);
  } catch (execError) {
    console.error(`Scanner failed for ${projectKey}:`, execError);
    throw new Error(
      `SonarQube scanner failed: ${execError.stderr || execError.message}`
    );
  }

  // Wait for measures
  const maxRetries = 30;
  const retryDelay = 3000;
  const auth = Buffer.from(`${SONARQUBE_TOKEN}:`).toString("base64");

  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, retryDelay));
    try {
      const projectCheck = await axios.get(
        `${SONARQUBE_URL}/api/projects/search`,
        {
          params: { projects: projectKey },
          headers: { Authorization: `Basic ${auth}` },
        }
      );

      if (projectCheck.data.components?.length > 0) {
        const response = await axios.get(
          `${SONARQUBE_URL}/api/measures/component`,
          {
            params: {
              component: projectKey,
              metricKeys:
                "bugs,vulnerabilities,code_smells,security_hotspots,duplicated_lines_density,ncloc,complexity,coverage",
            },
            headers: { Authorization: `Basic ${auth}` },
          }
        );

        if (response.data.component?.measures?.length > 0) {
          return response.data;
        }
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }

  throw new Error(`Analysis for ${projectKey} did not produce measures.`);
}
