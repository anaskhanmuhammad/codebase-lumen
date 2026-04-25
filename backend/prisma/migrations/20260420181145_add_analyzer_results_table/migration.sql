-- CreateTable
CREATE TABLE "AnalyzerResult" (
    "resultId" TEXT NOT NULL,
    "codeSampleId" TEXT NOT NULL,
    "analyzerType" TEXT NOT NULL,
    "rawOutput" JSONB NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyzerResult_pkey" PRIMARY KEY ("resultId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalyzerResult_codeSampleId_analyzerType_key" ON "AnalyzerResult"("codeSampleId", "analyzerType");

-- AddForeignKey
ALTER TABLE "AnalyzerResult" ADD CONSTRAINT "AnalyzerResult_codeSampleId_fkey" FOREIGN KEY ("codeSampleId") REFERENCES "CodeSample"("codeSampleId") ON DELETE CASCADE ON UPDATE CASCADE;
