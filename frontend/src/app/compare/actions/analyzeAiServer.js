"use server";

// We set a character limit to prevent crashing the Python backend's 8192 token limit.
// 1 token ≈ 4 characters. Limit = (8192 - 1500 buffer) * 4 ≈ 26000.
const MAX_CHAR_LIMIT = 26000;

export async function analyzeAiServer(humanCode, llmCode, language = "auto", framework = "") {
  // Graceful fallback if the env var isn't set
  console.log("The language is:", language)
  if (!process.env.AI_SERVER_URL) {
    return { success: false, error: "AI_SERVER_URL is not configured in environment variables." };
  }

  const AI_SERVER_URL = `${process.env.AI_SERVER_URL}/analyze`;

  // 1. Fail fast if the code is too large (saves minutes of waiting just to get a backend error)
  if (humanCode?.length > MAX_CHAR_LIMIT || llmCode?.length > MAX_CHAR_LIMIT) {
    return {
      success: false,
      error: `Code payload too large. Max allowed is ${MAX_CHAR_LIMIT} characters.`
    };
  }

  try {
    const payloads = [
      { code: humanCode, type: "human" },
      { code: llmCode, type: "llm" }
    ];

    const results = [];

    // Send requests consecutively, not concurrently
    for (const item of payloads) {
      // Skip empty code editors
      if (!item.code || item.code.trim() === "") {
        results.push({ type: item.type, success: true, data: null });
        continue;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 420000); // 7m timeout

        const response = await fetch(AI_SERVER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // CRITICAL: Bypasses Ngrok's free-tier HTML warning screen
            "ngrok-skip-browser-warning": "true"
          },
          body: JSON.stringify({
            language: language,
            framework: framework,
            code: item.code
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // 2. Handle specific HTTP Errors
        if (response.status === 413) {
          throw new Error("Code is too large for the AI context window.");
        }
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        const data = await response.json();

        // 3. Handle Python Backend Statuses
        if (data.status === "success" || data.status === "partial_success") {
          results.push({
            type: item.type,
            success: true,
            data: data.analysis,
            warning: data.status === "partial_success" ? data.validation_error : null
          });
        } else {
          throw new Error(data.detail || "AI Server returned an error status");
        }
      } catch (err) {
        console.error(`AI Server analysis failed for ${item.type}:`, err.message);
        results.push({
          type: item.type,
          success: false,
          error: err.name === "AbortError" ? "Analysis timed out after 7 minutes." : err.message
        });
      }
    }

    // Return only after all requests have been satisfied
    return {
      success: true,
      human: results.find(r => r.type === "human"),
      llm: results.find(r => r.type === "llm")
    };
  } catch (error) {
    console.error("General Error in analyzeAiServer:", error);
    return {
      success: false,
      error: error.message
    };
  }
}