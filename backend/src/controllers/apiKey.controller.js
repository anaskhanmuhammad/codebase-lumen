import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ENCRYPTION_SECRET =
  process.env.API_KEY_ENCRYPTION_SECRET ||
  process.env.ENCRYPTION_SECRET ||
  process.env.DATABASE_URL ||
  "lumen-development-secret";

function getEncryptionKey() {
  return crypto.createHash("sha256").update(ENCRYPTION_SECRET).digest();
}

function encryptApiKey(apiKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptApiKey(encryptedValue) {
  const [ivHex, authTagHex, encryptedHex] = String(encryptedValue || "").split(":");
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted API key format");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

function maskApiKey(apiKey) {
  const value = String(apiKey || "").trim();
  if (!value) return null;
  if (value.length <= 8) {
    return `${value.slice(0, 2)}****${value.slice(-2)}`;
  }

  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

async function resolveCurrentUser(clerkUserId) {
  if (!clerkUserId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { clerkUserId },
    select: { userId: true },
  });
}

async function resolveProvider(providerName) {
  if (!providerName) {
    return null;
  }

  return prisma.provider.findFirst({
    where: {
      providerName: { equals: providerName.trim(), mode: "insensitive" },
      isActive: true,
    },
    select: {
      providerId: true,
      providerName: true,
    },
  });
}

function normalizeProvider(providerName) {
  return String(providerName || "").trim();
}

async function testProviderApiKey(providerName, apiKey) {
  const provider = normalizeProvider(providerName).toLowerCase();

  const testRequests = {
    openai: async () => {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      return { ok: response.ok, status: response.status, details: await response.text() };
    },
    anthropic: async () => {
      const response = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      });

      return { ok: response.ok, status: response.status, details: await response.text() };
    },
    google: async () => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
      );

      return { ok: response.ok, status: response.status, details: await response.text() };
    },
    mistral: async () => {
      const response = await fetch("https://api.mistral.ai/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      return { ok: response.ok, status: response.status, details: await response.text() };
    },
    openrouter: async () => {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      return { ok: response.ok, status: response.status, details: await response.text() };
    },
  };

  const tester = testRequests[provider];

  if (!tester) {
    return {
      ok: false,
      status: 400,
      details: `Unsupported provider for validation: ${providerName}`,
    };
  }

  return tester();
}

function buildValidationError(providerName, status, details) {
  const base = `Failed to validate ${providerName} API key`;
  if (!status) {
    return base;
  }

  const message = String(details || "").slice(0, 200);
  return message ? `${base} (HTTP ${status}): ${message}` : `${base} (HTTP ${status})`;
}

async function validateAndSaveKey({ userId, providerName, name, apiKey, testBeforeSave }) {
  const provider = await resolveProvider(providerName);
  if (!provider) {
    const availableProviders = await prisma.provider.findMany({
      where: { isActive: true },
      select: { providerName: true },
      orderBy: { providerName: "asc" },
    });

    return {
      status: 400,
      body: {
        error: "Unsupported provider",
        supportedProviders: availableProviders.map((row) => row.providerName),
      },
    };
  }

  const normalizedApiKey = String(apiKey || "").trim();
  if (!normalizedApiKey) {
    return {
      status: 400,
      body: { error: "API key is required" },
    };
  }

  let validationOutcome = { ok: true, status: 200, details: "Skipped validation" };

  if (testBeforeSave) {
    validationOutcome = await testProviderApiKey(provider.providerName, normalizedApiKey);
    if (!validationOutcome.ok) {
      return {
        status: 400,
        body: {
          error: buildValidationError(provider.providerName, validationOutcome.status, validationOutcome.details),
        },
      };
    }
  }

  const savedKey = await prisma.userApiKey.create({
    data: {
      userId,
      name: name?.trim() || null,
      provider: provider.providerName,
      encryptedKey: encryptApiKey(normalizedApiKey),
      maskedKey: maskApiKey(normalizedApiKey),
      keyMetadata: {
        providerId: provider.providerId,
        providerName: provider.providerName,
        validationMode: testBeforeSave ? "test-before-save" : "save-only",
      },
      isValidated: Boolean(validationOutcome.ok),
      validationStatus: validationOutcome.ok ? "validated" : "failed",
      validationError: validationOutcome.ok ? null : buildValidationError(provider.providerName, validationOutcome.status, validationOutcome.details),
      lastValidationAt: validationOutcome.ok ? new Date() : null,
    },
  });

  return {
    status: 201,
    body: { apiKey: savedKey },
  };
}

export const listUserApiKeys = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
    const user = await resolveCurrentUser(clerkUserId);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const apiKeys = await prisma.userApiKey.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      select: {
        keyId: true,
        name: true,
        provider: true,
        maskedKey: true,
        keyMetadata: true,
        isActive: true,
        isValidated: true,
        validationStatus: true,
        validationError: true,
        lastValidationAt: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ apiKeys });
  } catch (error) {
    console.error("Error listing API keys:", error);
    return res.status(500).json({ error: "Failed to list API keys" });
  }
};

export const listAvailableApiProviders = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
    const user = await resolveCurrentUser(clerkUserId);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const providerRows = await prisma.userApiKey.findMany({
      where: {
        userId: user.userId,
        isActive: true,
        isValidated: true,
      },
      select: {
        provider: true,
      },
      distinct: ["provider"],
      orderBy: {
        provider: "asc",
      },
    });

    return res.json({
      providers: providerRows.map((row) => row.provider),
    });
  } catch (error) {
    console.error("Error listing available API providers:", error);
    return res.status(500).json({ error: "Failed to list available providers" });
  }
};

export const createUserApiKey = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
    const user = await resolveCurrentUser(clerkUserId);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { provider, name, apiKey, testBeforeSave = true } = req.body;
    const result = await validateAndSaveKey({
      userId: user.userId,
      providerName: provider,
      name,
      apiKey,
      testBeforeSave: Boolean(testBeforeSave),
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Error creating API key:", error);
    return res.status(500).json({ error: "Failed to create API key" });
  }
};

export const retestUserApiKey = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
    const user = await resolveCurrentUser(clerkUserId);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { keyId } = req.params;

    const apiKeyRecord = await prisma.userApiKey.findFirst({
      where: { keyId, userId: user.userId },
    });

    if (!apiKeyRecord) {
      return res.status(404).json({ error: "API key not found" });
    }

    const decryptedKey = decryptApiKey(apiKeyRecord.encryptedKey);
    const testResult = await testProviderApiKey(apiKeyRecord.provider, decryptedKey);

    if (!testResult.ok) {
      const validationError = buildValidationError(apiKeyRecord.provider, testResult.status, testResult.details);
      const updated = await prisma.userApiKey.update({
        where: { keyId },
        data: {
          isValidated: false,
          validationStatus: "failed",
          validationError,
          lastValidationAt: new Date(),
        },
      });

      return res.status(400).json({ error: validationError, apiKey: updated });
    }

    const updated = await prisma.userApiKey.update({
      where: { keyId },
      data: {
        isValidated: true,
        validationStatus: "validated",
        validationError: null,
        lastValidationAt: new Date(),
      },
    });

    return res.json({ apiKey: updated });
  } catch (error) {
    console.error("Error retesting API key:", error);
    return res.status(500).json({ error: "Failed to retest API key" });
  }
};

export const updateUserApiKey = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
    const user = await resolveCurrentUser(clerkUserId);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { keyId } = req.params;
    const { isActive, apiKey, testAfterRotate = true, name } = req.body;

    const existing = await prisma.userApiKey.findFirst({
      where: { keyId, userId: user.userId },
    });

    if (!existing) {
      return res.status(404).json({ error: "API key not found" });
    }

    if (typeof apiKey === "string" && apiKey.trim()) {
      const testResult = Boolean(testAfterRotate)
        ? await testProviderApiKey(existing.provider, apiKey.trim())
        : { ok: true, status: 200, details: "Skipped validation" };

      if (!testResult.ok) {
        const validationError = buildValidationError(existing.provider, testResult.status, testResult.details);
        return res.status(400).json({ error: validationError });
      }

      const updated = await prisma.userApiKey.update({
        where: { keyId },
        data: {
          name: typeof name === "string" ? name.trim() || null : existing.name,
          encryptedKey: encryptApiKey(apiKey.trim()),
          maskedKey: maskApiKey(apiKey.trim()),
          isValidated: true,
          validationStatus: "validated",
          validationError: null,
          lastValidationAt: new Date(),
          isActive: typeof isActive === "boolean" ? isActive : existing.isActive,
        },
      });

      return res.json({ apiKey: updated });
    }

    const updated = await prisma.userApiKey.update({
      where: { keyId },
      data: {
        isActive: typeof isActive === "boolean" ? isActive : existing.isActive,
        name: typeof name === "string" ? name.trim() || null : existing.name,
      },
    });

    return res.json({ apiKey: updated });
  } catch (error) {
    console.error("Error updating API key:", error);
    return res.status(500).json({ error: "Failed to update API key" });
  }
};

export const deleteUserApiKey = async (req, res) => {
  try {
    const clerkUserId = req.auth()?.userId;
    const user = await resolveCurrentUser(clerkUserId);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { keyId } = req.params;

    const existing = await prisma.userApiKey.findFirst({
      where: { keyId, userId: user.userId },
      select: { keyId: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "API key not found" });
    }

    await prisma.userApiKey.delete({
      where: { keyId },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting API key:", error);
    return res.status(500).json({ error: "Failed to delete API key" });
  }
};
