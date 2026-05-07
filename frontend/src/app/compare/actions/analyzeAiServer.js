"use server";

// We set a character limit to prevent crashing the Python backend's 8192 token limit.
// 1 token ≈ 4 characters. Limit = (8192 - 1500 buffer) * 4 ≈ 26000.
const MAX_CHAR_LIMIT = 26000;

export async function analyzeAiServer(code, language = "auto", framework = "", filename = "") {
  // Graceful fallback if the env var isn't set
  console.log("The language is:", language);
  if (!process.env.AI_SERVER_URL) {
    return { success: false, error: "AI_SERVER_URL is not configured in environment variables." };
  }

  const AI_SERVER_URL = `${process.env.AI_SERVER_URL}/analyze`;

  // 1. Fail fast if the code is too large (saves minutes of waiting just to get a backend error)
  if (code?.length > MAX_CHAR_LIMIT) {
    return {
      success: false,
      error: `Code payload too large. Max allowed is ${MAX_CHAR_LIMIT} characters.`
    };
  }

  try {
    if (!code || code.trim() === "") {
      return { success: true, data: null };
    }

    const requestBody = {
      filename: filename || "",
      language,
      code,
    };

    console.log("AI Server request:\n" + JSON.stringify(requestBody, null, 2));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 420000); // 7m timeout

    try {
      const response = await fetch(AI_SERVER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // CRITICAL: Bypasses Ngrok's free-tier HTML warning screen
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify(requestBody),
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
      console.log("AI Server response:", data);
      console.log("AI Server data response:", data?.data?.analysis?.runs);

      // 3. Handle Python Backend Statuses
      const analysis = data?.data?.analysis;
      if (analysis) {
        return {
          success: true,
          data: analysis,
          warning: data?.data?.validation_error || null,
        };
      }

      throw new Error(data?.detail || "AI Server returned an invalid response format");
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("AI Server analysis failed:", err.message);
      return {
        success: false,
        error: err.name === "AbortError" ? "Analysis timed out after 7 minutes." : err.message
      };
    }
  } catch (error) {
    console.error("General Error in analyzeAiServer:", error);
    return {
      success: false,
      error: error.message
    };
  }
}