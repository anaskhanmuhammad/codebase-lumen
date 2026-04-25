/*
  Warnings:

  - You are about to drop the column `provider` on the `Llm` table. All the data in the column will be lost.
  - Added the required column `providerId` to the `Llm` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Llm" DROP COLUMN "provider",
ADD COLUMN     "providerId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Provider" (
    "providerId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("providerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Provider_providerName_key" ON "Provider"("providerName");

-- AddForeignKey
ALTER TABLE "Llm" ADD CONSTRAINT "Llm_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("providerId") ON DELETE RESTRICT ON UPDATE CASCADE;
