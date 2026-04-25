"use server";

import axios from "axios";

// Helper to sanitize code string for JSON
const sanitizeCode = (code) => {
  return code
    .replace(/\\/g, "\\\\") // Escape backslashes
    .replace(/"/g, '\\"')   // Escape double quotes
    .replace(/\n/g, "\\n")  // Escape newlines
    .replace(/\r/g, "\\r")  // Escape carriage returns
    .replace(/\t/g, "\\t"); // Escape tabs
};

export async function analyzeAiServer(humanCode, llmCode) {
  const AI_SERVER_URL = `${process.env.AI_SERVER_URL}/analyze`;

  try {
    const payloads = [
      { code: humanCode, type: "human" },
      { code: llmCode, type: "llm" }
    ];

    const promises = payloads.map(async (item) => {
      try {
        // The server expects: { "language": "javascript", "framework": "...", "code": "..." }
        // We'll default language/framework for now or let the server detect if possible.
        // Based on the prompt, it seems we send the raw code text in the "code" field.
        
        const response = await axios.post(AI_SERVER_URL, {
          language: "javascript", // Defaulting as per prompt example, strictly could be dynamic but fine for now
          framework: null, // Defaulting as per prompt example
          code: item.code
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 700000 // 7m timeout for AI model
        });

        if (response.data && response.data.status === "success") {
            return {
                type: item.type,
                success: true,
            raw: response.data,
            };
        } else {
             throw new Error("AI Server returned incomplete or failed status");
        }

      } catch (err) {
        console.error(`AI Server analysis failed for ${item.type}:`, err.message);
        return {
          type: item.type,
          success: false,
          error: err.message,
          raw: err.response?.data || null,
        };
      }
    });

    const results = await Promise.all(promises);

    const humanResult = results.find(r => r.type === "human");
    const llmResult = results.find(r => r.type === "llm");

    return {
      success: true,
      human: humanResult?.raw || null,
      llm: llmResult?.raw || null,
    };

  } catch (error) {
    console.error("General Error in analyzeAiServer:", error);
    return {
      success: false,
      error: error.message
    };
  }
}
