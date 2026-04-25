-- AlterTable
ALTER TABLE "UserApiKey" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "maskedKey" TEXT;
