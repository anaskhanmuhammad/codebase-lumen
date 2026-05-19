"use server";

const MAX_CHAR_LIMIT = 26000;

export async function analyzeAiServer(code, language = "auto", framework = "", filename = "") {
  if (!process.env.AI_SERVER_URL) {
    return { success: false, error: "AI_SERVER_URL is not configured in environment variables." };
  }

  const AI_SERVER_URL = `${process.env.AI_SERVER_URL}/analyze`;

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 420000);

    try {
      const response = await fetch(AI_SERVER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 413) {
        throw new Error("Code is too large for the AI context window.");
      }
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
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
      return {
        success: false,
        error: err.name === "AbortError" ? "Analysis timed out after 7 minutes." : err.message
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}