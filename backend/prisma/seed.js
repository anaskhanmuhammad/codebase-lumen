import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const provider = await prisma.provider.upsert({
    where: { providerName: "OpenAI" },
    update: { isActive: true },
    create: {
      providerName: "OpenAI",
      description: "OpenAI models",
      isActive: true,
    },
  });

  await prisma.llm.upsert({
    where: { llmName: "GPT-4.1" },
    update: { isActive: true, providerId: provider.providerId },
    create: {
      llmName: "GPT-4.1",
      providerId: provider.providerId,
      modelIdentifier: "gpt-4.1",
      description: "Seeded model for UI testing",
      isActive: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
