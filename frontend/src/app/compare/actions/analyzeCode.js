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
    // Create temp dir
    await fs.mkdir(TEMP_DIR, { recursive: true });

    const sessionId = uuidv4();

    console.log("Starting analysis for session:", sessionId);

    // Analyze both
    const humanResult = await analyzeSingleCode(
      humanCode,
      `human-${sessionId}`
    );
    const llmResult = await analyzeSingleCode(llmCode, `llm-${sessionId}`);

    return {
      success: true,
      sessionId,
      human: humanResult,
      llm: llmResult,
    };
  } catch (error) {
    console.error("Error in analyzeCode:", error);
    return {
      success: false,
      error: error.message,
      details: error.response?.data || null,
    };
  }
}

async function analyzeSingleCode(code, projectKey) {
  const projectDir = path.join(TEMP_DIR, projectKey);
  await fs.mkdir(projectDir, { recursive: true });

  const filePath = path.join(projectDir, "code.js");
  await fs.writeFile(filePath, code, "utf-8");

  // sonar-project.properties file
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

  // Convert Windows path to WSL path
  let wslPath = projectDir.replace(/\\/g, "/");
  if (wslPath.match(/^[A-Za-z]:/)) {
    const driveLetter = wslPath[0].toLowerCase();
    wslPath = `/mnt/${driveLetter}${wslPath.substring(2)}`;
  }

  console.log(`WSL path: ${wslPath}`);

  // Run Docker command through WSL
  const command = `wsl -e docker run --rm --network=host -v "${wslPath}:/usr/src" sonarsource/sonar-scanner-cli -Dsonar.host.url=${SONARQUBE_URL} -Dsonar.login=${SONARQUBE_TOKEN}`;

  console.log(`Executing: ${command}`);

  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });
    console.log(`Scanner output for ${projectKey}:`, stdout);
    if (stderr && !stderr.includes("Pulling")) {
      console.error(`Scanner stderr:`, stderr);
    }
  } catch (execError) {
    console.error(`Scanner failed for ${projectKey}:`, execError);
    throw new Error(
      `SonarQube scanner failed: ${execError.stderr || execError.message}`
    );
  }

  // Wait for analysis to complete and measures to be available
  const maxRetries = 30; // Increased retries
  const retryDelay = 3000; // 3 seconds between retries

  console.log(`Waiting for analysis results for ${projectKey}...`);

  const auth = Buffer.from(`${SONARQUBE_TOKEN}:`).toString("base64");

  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, retryDelay));

    try {
      // Check if project exists
      const projectCheck = await axios.get(
        `${SONARQUBE_URL}/api/projects/search`,
        {
          params: { projects: projectKey },
          headers: { Authorization: `Basic ${auth}` },
        }
      );

      if (projectCheck.data.components?.length > 0) {
        console.log(`Project ${projectKey} found, checking for measures...`);

        // Fetch measures
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

        // Check if measures are actually populated
        if (response.data.component?.measures?.length > 0) {
          console.log(
            `Successfully retrieved ${response.data.component.measures.length} measures for ${projectKey}`
          );
          console.log("Measures:", response.data.component.measures);
          return response.data;
        } else {
          console.log(
            `Retry ${
              i + 1
            }/${maxRetries}: Measures not ready yet (empty array)...`
          );
        }
      } else {
        console.log(`Retry ${i + 1}/${maxRetries}: Project not found yet...`);
      }
    } catch (error) {
      if (error.response?.status === 404 && i < maxRetries - 1) {
        console.log(`Retry ${i + 1}/${maxRetries}: 404 error, retrying...`);
        continue;
      }
      if (i === maxRetries - 1) {
        throw error;
      }
      console.log(
        `Retry ${i + 1}/${maxRetries}: Error occurred, retrying...`,
        error.message
      );
    }
  }

  throw new Error(
    `Analysis for ${projectKey} did not complete with measures after ${
      (maxRetries * retryDelay) / 1000
    } seconds. The project may exist but measures are not available.`
  );
}
