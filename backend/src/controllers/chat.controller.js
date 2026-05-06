import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper function to resolve Clerk user ID to database user ID
async function resolveCurrentUser(clerkUserId) {
  if (!clerkUserId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { clerkUserId },
    select: { userId: true },
  });
}

// Helper function to build a compact vulnerability context for a comparison.
// This intentionally avoids raw analyzer outputs to reduce token usage.
// Format:
// {
//   comparisonId: string,
//   generatedAt: ISODate,
//   codeSamples: [
//     { codeSampleId, codeType, vulnerabilityCount, vulnerabilities: [ ... ] }
//   ],
//   totals: { codeSamples, vulnerabilities }
// }
async function fetchComparisonVulnerabilityContext(comparisonId) {
  try {
    const codeSamples = await prisma.codeSample.findMany({
      where: { comparisonId },
      select: {
        codeSampleId: true,
        codeType: true,
        vulnerabilities: {
          select: {
            vulnerabilityId: true,
            ruleId: true,
            name: true,
            description: true,
            level: true,
            severity: true,
            confidence: true,
            filePath: true,
            lineNumber: true,
            message: true,
            detectedBy: true,
            allStandardsViolated: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const codeSamplesOut = (codeSamples || []).map((sample) => {
      const vulnerabilities = (sample.vulnerabilities || []).map((vuln) => ({
        vulnerabilityId: vuln.vulnerabilityId,
        ruleId: vuln.ruleId,
        name: vuln.name,
        description: vuln.description,
        level: vuln.level,
        severity: vuln.severity,
        confidence: vuln.confidence,
        filePath: vuln.filePath,
        lineNumber: vuln.lineNumber,
        message: vuln.message,
        detectedBy: vuln.detectedBy,
        allStandardsViolated: vuln.allStandardsViolated,
      }));

      return {
        codeSampleId: sample.codeSampleId,
        codeType: sample.codeType,
        vulnerabilityCount: vulnerabilities.length,
        vulnerabilities,
      };
    });

    const totalVulnerabilities = codeSamplesOut.reduce(
      (acc, sample) => acc + sample.vulnerabilityCount,
      0
    );

    return {
      comparisonId,
      generatedAt: new Date().toISOString(),
      codeSamples: codeSamplesOut,
      totals: {
        codeSamples: codeSamplesOut.length,
        vulnerabilities: totalVulnerabilities,
      },
    };
  } catch (error) {
    console.error("[CHAT] Error building vulnerability chat context:", error);
    return {
      comparisonId,
      generatedAt: new Date().toISOString(),
      codeSamples: [],
      totals: { codeSamples: 0, vulnerabilities: 0 },
    };
  }
}

// Get or create a chat session for a given comparison
export const getOrCreateChatSession = async (req, res) => {
  const { comparisonId } = req.params;
  const clerkUserId = req.auth()?.userId;

  try {
    console.log("[CHAT] getOrCreateChatSession - comparisonId:", comparisonId, "clerkUserId:", clerkUserId);
    
    if (!clerkUserId) {
      console.warn("[CHAT] No Clerk user ID found");
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Resolve Clerk user ID to database user ID
    const userRecord = await resolveCurrentUser(clerkUserId);
    if (!userRecord) {
      console.error("[CHAT] User not found in database for clerkUserId:", clerkUserId);
      return res.status(401).json({ error: "User not found" });
    }

    const userId = userRecord.userId;
    console.log("[CHAT] Resolved userId:", userId);
    
    let chatSession = await prisma.chatSession.findFirst({
      where: {
        comparisonId: comparisonId,
        userId: userId,
      },
    });

    if (!chatSession) {
      console.log("[CHAT] Creating new chat session for comparison:", comparisonId);
      chatSession = await prisma.chatSession.create({
        data: {
          comparisonId: comparisonId,
          userId: userId,
        },
      });
      console.log("[CHAT] Chat session created:", chatSession.chatSessionId);
    } else {
      console.log("[CHAT] Existing chat session found:", chatSession.chatSessionId);
    }
    
    res.status(200).json(chatSession);
  } catch (error) {
    console.error("Error getting or creating chat session:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Handle a new chat message
export const handleNewChatMessage = async (req, res) => {
  const { comparisonId } = req.params;
  const clerkUserId = req.auth()?.userId;
  const { message } = req.body;

  console.log("[CHAT] handleNewChatMessage - comparisonId:", comparisonId, "clerkUserId:", clerkUserId);
  console.log("[CHAT] User message received:", message);

  if (!message) {
    console.warn("[CHAT] Message is empty or undefined");
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    if (!clerkUserId) {
      console.warn("[CHAT] No Clerk user ID found");
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Resolve Clerk user ID to database user ID
    const userRecord = await resolveCurrentUser(clerkUserId);
    if (!userRecord) {
      console.error("[CHAT] User not found in database for clerkUserId:", clerkUserId);
      return res.status(401).json({ error: "User not found" });
    }

    const userId = userRecord.userId;
    console.log("[CHAT] Resolved userId:", userId);

    // 1. Get or create the session
    console.log("[CHAT] Getting or creating session...");
    let chatSession = await prisma.chatSession.findFirst({
      where: { comparisonId, userId },
    });
    if (!chatSession) {
      console.log("[CHAT] Session not found, creating new one...");
      chatSession = await prisma.chatSession.create({
        data: { comparisonId, userId },
      });
      console.log("[CHAT] New session created with ID:", chatSession.chatSessionId);
    } else {
      console.log("[CHAT] Existing session found with ID:", chatSession.chatSessionId);
    }

    // 2. Save the user's message
    console.log("[CHAT] Saving user message to database...");
    const userMessageRecord = await prisma.chatConversation.create({
      data: {
        chatSessionId: chatSession.chatSessionId,
        type: "user",
        messageText: message,
      },
    });
    console.log("[CHAT] User message saved to DB with ID:", userMessageRecord.messageId);

    // 3. Prepare context and call the AI model
    // NOTE: The AI_CHAT_API_URL needs to be set in your .env file
    const aiApiUrl = process.env.AI_CHAT_API_URL;
    const aiApiKey = process.env.AI_CHAT_API_KEY;
    console.log("[CHAT] AI API URL:", aiApiUrl ? "configured" : "NOT CONFIGURED");
    console.log("[CHAT] AI API KEY:", aiApiKey ? "configured" : "NOT CONFIGURED");
    
    if (!aiApiUrl) {
      console.error("AI_CHAT_API_URL is not defined in .env file");
      return res.status(500).json({ error: "AI service is not configured" });
    }

    if (!aiApiKey) {
      console.error("AI_CHAT_API_KEY is not defined in .env file");
      return res.status(500).json({ error: "AI service key is not configured" });
    }
    
    console.log("[CHAT] Fetching vulnerability context for comparison...");

    // Fetch vulnerability-based context for this comparison
    const chatContext = await fetchComparisonVulnerabilityContext(comparisonId);
    console.log(
      "[CHAT] Vulnerability context fetched with",
      chatContext.totals?.codeSamples || 0,
      "code samples and",
      chatContext.totals?.vulnerabilities || 0,
      "vulnerabilities"
    );

    // ===== DETAILED CONSOLIDATED CONTEXT DEBUG LOGGING =====
    console.log("[CHAT] ===== FULL CONSOLIDATED PAYLOAD DEBUG START =====");
    console.log("[CHAT] comparisonId:", chatContext.comparisonId || comparisonId);
    console.log("[CHAT] generatedAt:", chatContext.generatedAt || "(none)");
    console.log("[CHAT] CodeSamples Count:", (chatContext.codeSamples || []).length);
    console.log("[CHAT] Total Vulnerabilities:", chatContext.totals?.vulnerabilities || 0);

    (chatContext.codeSamples || []).forEach((cs, csIdx) => {
      console.log(`[CHAT]   CodeSample #${csIdx + 1}: id=${cs.codeSampleId} type=${cs.codeType}`);
      console.log(`[CHAT]     - vulnerability count: ${cs.vulnerabilityCount || 0}`);

      (cs.vulnerabilities || []).forEach((vuln, vulnIdx) => {
        console.log(
          `[CHAT]       Vulnerability #${vulnIdx + 1}: ruleId=${vuln.ruleId || "(none)"} severity=${vuln.severity || vuln.level || "(none)"} file=${vuln.filePath || "(none)"} line=${vuln.lineNumber || "(none)"}`
        );
      });
    });

    console.log("[CHAT] Full consolidated JSON preview:", JSON.stringify(chatContext, null, 2).substring(0, 1000) + "...");
    console.log("[CHAT] ===== FULL CONSOLIDATED PAYLOAD DEBUG END =====");

    console.log("[CHAT] Calling AI service with message payload...");

    const requestBody = {
      message,
      sarif: chatContext,
    };

    console.log("[CHAT] OUTBOUND AI REQUEST BODY (FULL):", requestBody);
    console.log("[CHAT] AI request body:", JSON.stringify(requestBody, null, 2));

    const aiApiResponse = await fetch(`${aiApiUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': aiApiKey,
      },
      body: JSON.stringify(requestBody),
    });

    console.log("[CHAT] AI service response status:", aiApiResponse.status);

    if (!aiApiResponse.ok) {
      const errorBody = await aiApiResponse.text();
      console.error("AI Service Error:", errorBody);
      return res.status(aiApiResponse.status).json({ error: "Failed to get response from AI service" });
    }

    const aiResponseData = await aiApiResponse.json();
    const aiMessage = aiResponseData.response; // This is the full response including <think> tags

    // Extract thinking blocks and clean message for DB/frontend
    let cleanMessage = aiMessage;
    
    // Pattern 1: Standard <think>...</think>
    const standardPattern = /<think>[\s\S]*?<\/think>/gi;
    const thinks = [...aiMessage.matchAll(standardPattern)];
    
    if (thinks.length > 0) {
      thinks.forEach((match, i) => {
        // match[0] is the full <think>...</think> string
        // We log the inside content
        const inside = match[0].replace(/^<think>/i, '').replace(/<\/think>$/i, '').trim();
        console.log(`[CHAT] AI MODEL THINKING #${i + 1}:\n`, inside);
      });
      // Remove all standard <think> blocks
      cleanMessage = cleanMessage.replace(standardPattern, '').trim();
    }

    // Pattern 2: Missing opening tag, but has closing tag.
    // DeepSeek models sometimes start responding immediately with thoughts and omit the opening <think>
    if (cleanMessage.includes('</think>')) {
      const implicitThinkMatch = cleanMessage.match(/^([\s\S]*?)<\/think>/i);
      if (implicitThinkMatch) {
        console.log(`[CHAT] AI MODEL THINKING (Implicit open):\n`, implicitThinkMatch[1].trim());
        cleanMessage = cleanMessage.replace(/^[\s\S]*?<\/think>/i, '').trim();
      }
    }

    // Pattern 3: Missing closing tag, but has opening tag.
    if (cleanMessage.includes('<think>')) {
      const unclosedThinkMatch = cleanMessage.match(/<think>([\s\S]*)$/i);
      if (unclosedThinkMatch) {
        console.log(`[CHAT] AI MODEL THINKING (Unclosed):\n`, unclosedThinkMatch[1].trim());
        cleanMessage = cleanMessage.replace(/<think>[\s\S]*$/i, '').trim();
      }
    }

    console.log("[CHAT] AI final clean response:", cleanMessage);

    // 4. Save the AI's response (store the ENTIRE message including <think> tags)
    console.log("[CHAT] Saving full AI message to database...");
    const savedAiMessage = await prisma.chatConversation.create({
      data: {
        chatSessionId: chatSession.chatSessionId,
        type: "assistant",
        messageText: aiMessage,
      },
    });
    console.log("[CHAT] AI message saved to DB with ID:", savedAiMessage.messageId);

    // 5. Return the clean response to the client
    console.log("[CHAT] Sending clean AI response back to client");
    const responseToClient = {
      ...savedAiMessage,
      messageText: cleanMessage, // Override with clean text for the frontend
    };
    res.status(200).json(responseToClient);
  } catch (error) {
    console.error("[CHAT] Error handling new chat message:", error.message);
    if (error.response) {
      console.error("AI Service Error:", error.response.data);
    }
    res.status(500).json({ error: "Failed to get response from AI" });
  }
};

// Get the chat history for a session
export const getChatHistory = async (req, res) => {
  const { comparisonId } = req.params;
  const clerkUserId = req.auth()?.userId;

  console.log("[CHAT] getChatHistory - comparisonId:", comparisonId, "clerkUserId:", clerkUserId);

  try {
    if (!clerkUserId) {
      console.warn("[CHAT] No Clerk user ID found");
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Resolve Clerk user ID to database user ID
    const userRecord = await resolveCurrentUser(clerkUserId);
    if (!userRecord) {
      console.error("[CHAT] User not found in database for clerkUserId:", clerkUserId);
      return res.status(401).json({ error: "User not found" });
    }

    const userId = userRecord.userId;
    console.log("[CHAT] Resolved userId:", userId);

    const chatSession = await prisma.chatSession.findFirst({
      where: {
        comparisonId: comparisonId,
        userId: userId,
      },
    });

    if (!chatSession) {
      console.log("[CHAT] No chat session found, returning empty history");
      return res.status(200).json([]); // No session, no history
    }

    console.log("[CHAT] Chat session found with ID:", chatSession.chatSessionId, "- fetching conversation history...");

    const history = await prisma.chatConversation.findMany({
      where: {
        chatSessionId: chatSession.chatSessionId,
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    console.log("[CHAT] Retrieved", history.length, "messages from history");
    
    // Strip <think> tags from assistant messages before sending to frontend
    const cleanHistory = history.map((msg, idx) => {
      let cleanText = msg.messageText;
      if (msg.type === "assistant" && cleanText) {
        // Strip standard <think>...</think>
        cleanText = cleanText.replace(/<think>[\s\S]*?<\/think>/gi, '');
        
        // Strip missing opening tag (e.g. starts string with thought, ends with </think>)
        if (cleanText.includes('</think>')) {
          cleanText = cleanText.replace(/^[\s\S]*?<\/think>/i, '');
        }
        
        // Strip missing closing tag (e.g. valid start, but cut off at end)
        if (cleanText.includes('<think>')) {
          cleanText = cleanText.replace(/<think>[\s\S]*$/i, '');
        }
        
        cleanText = cleanText.trim();
      }
      console.log(`[CHAT] Message ${idx + 1}: type="${msg.type}", message="${cleanText.substring(0, 50)}${cleanText.length > 50 ? '...' : ''}"`);
      return {
        ...msg,
        messageText: cleanText
      };
    });

    res.status(200).json(cleanHistory);
  } catch (error) {
    console.error("[CHAT] Error fetching chat history:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};