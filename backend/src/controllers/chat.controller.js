import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function resolveCurrentUser(clerkUserId) {
  if (!clerkUserId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { clerkUserId },
    select: { userId: true },
  });
}

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
    
    return {
      comparisonId,
      generatedAt: new Date().toISOString(),
      codeSamples: [],
      totals: { codeSamples: 0, vulnerabilities: 0 },
    };
  }
}

export const getOrCreateChatSession = async (req, res) => {
  const { comparisonId } = req.params;
  const clerkUserId = req.auth()?.userId;

  try {
    
    
    if (!clerkUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    
    const userRecord = await resolveCurrentUser(clerkUserId);
    if (!userRecord) {
      return res.status(401).json({ error: "User not found" });
    }

    const userId = userRecord.userId;
    
    let chatSession = await prisma.chatSession.findFirst({
      where: {
        comparisonId: comparisonId,
        userId: userId,
      },
    });

    if (!chatSession) {
      
      chatSession = await prisma.chatSession.create({
        data: {
          comparisonId: comparisonId,
          userId: userId,
        },
      });
      
    } else {
      
    }
    
    res.status(200).json(chatSession);
  } catch (error) {
    
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleNewChatMessage = async (req, res) => {
  const { comparisonId } = req.params;
  const clerkUserId = req.auth()?.userId;
  const { message } = req.body;

  

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    if (!clerkUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    
    const userRecord = await resolveCurrentUser(clerkUserId);
    if (!userRecord) {
      return res.status(401).json({ error: "User not found" });
    }

    const userId = userRecord.userId;

    
    let chatSession = await prisma.chatSession.findFirst({
      where: { comparisonId, userId },
    });
    if (!chatSession) {
      
      chatSession = await prisma.chatSession.create({
        data: { comparisonId, userId },
      });
      
    } else {
      
    }

    
    
    const userMessageRecord = await prisma.chatConversation.create({
      data: {
        chatSessionId: chatSession.chatSessionId,
        type: "user",
        messageText: message,
      },
    });
    

    const aiApiUrl = process.env.AI_CHAT_API_URL;
    const aiApiKey = process.env.AI_CHAT_API_KEY;
    
    
    if (!aiApiUrl) {
      
      return res.status(500).json({ error: "AI service is not configured" });
    }

    if (!aiApiKey) {
      
      return res.status(500).json({ error: "AI service key is not configured" });
    }
    
    

    const chatContext = await fetchComparisonVulnerabilityContext(comparisonId);

    const requestBody = {
      message,
      sarif: chatContext,
    };

    

    const aiApiResponse = await fetch(`${aiApiUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': aiApiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!aiApiResponse.ok) {
      const errorBody = await aiApiResponse.text();
      return res.status(aiApiResponse.status).json({ error: "Failed to get response from AI service" });
    }

    const aiResponseData = await aiApiResponse.json();
    const aiMessage = aiResponseData.response;

    let cleanMessage = aiMessage;

    const standardPattern = /<think>[\s\S]*?<\/think>/gi;
    const thinks = [...aiMessage.matchAll(standardPattern)];
    if (thinks.length > 0) {
      cleanMessage = cleanMessage.replace(standardPattern, '').trim();
    }

    
    if (cleanMessage.includes('</think>')) {
      const implicitThinkMatch = cleanMessage.match(/^([\s\S]*?)<\/think>/i);
      if (implicitThinkMatch) {
        
        cleanMessage = cleanMessage.replace(/^[\s\S]*?<\/think>/i, '').trim();
      }
    }

    
    if (cleanMessage.includes('<think>')) {
      const unclosedThinkMatch = cleanMessage.match(/<think>([\s\S]*)$/i);
      if (unclosedThinkMatch) {
        
        cleanMessage = cleanMessage.replace(/<think>[\s\S]*$/i, '').trim();
      }
    }

    

    
    const savedAiMessage = await prisma.chatConversation.create({
      data: {
        chatSessionId: chatSession.chatSessionId,
        type: "assistant",
        messageText: aiMessage,
      },
    });
    

    const responseToClient = {
      ...savedAiMessage,
      messageText: cleanMessage,
    };
    res.status(200).json(responseToClient);
  } catch (error) {
    
    res.status(500).json({ error: "Failed to get response from AI" });
  }
};

export const getChatHistory = async (req, res) => {
  const { comparisonId } = req.params;
  const clerkUserId = req.auth()?.userId;

  

  try {
    if (!clerkUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    
    const userRecord = await resolveCurrentUser(clerkUserId);
    if (!userRecord) {
      return res.status(401).json({ error: "User not found" });
    }

    const userId = userRecord.userId;

    const chatSession = await prisma.chatSession.findFirst({
      where: {
        comparisonId: comparisonId,
        userId: userId,
      },
    });

    if (!chatSession) {
      return res.status(200).json([]);
    }

    

    const history = await prisma.chatConversation.findMany({
      where: {
        chatSessionId: chatSession.chatSessionId,
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    
    
    
    const cleanHistory = history.map((msg, idx) => {
      let cleanText = msg.messageText;
      if (msg.type === "assistant" && cleanText) {
        cleanText = cleanText.replace(/<think>[\s\S]*?<\/think>/gi, '');
        
        if (cleanText.includes('</think>')) {
          cleanText = cleanText.replace(/^[\s\S]*?<\/think>/i, '');
        }
        if (cleanText.includes('<think>')) {
          cleanText = cleanText.replace(/<think>[\s\S]*$/i, '');
        }
        cleanText = cleanText.trim();
      }
      
      return {
        ...msg,
        messageText: cleanText
      };
    });

    res.status(200).json(cleanHistory);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};