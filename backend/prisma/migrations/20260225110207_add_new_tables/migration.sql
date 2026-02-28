-- CreateTable
CREATE TABLE "UserApiKey" (
    "keyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "keyMetadata" JSONB,
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "lastValidationAt" TIMESTAMP(3),
    "validationStatus" TEXT,
    "validationError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserApiKey_pkey" PRIMARY KEY ("keyId")
);

-- CreateTable
CREATE TABLE "StandardPure" (
    "standardId" TEXT NOT NULL,
    "standardName" TEXT NOT NULL,
    "standardType" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "reference" TEXT,

    CONSTRAINT "StandardPure_pkey" PRIMARY KEY ("standardId")
);

-- CreateTable
CREATE TABLE "Analyzer" (
    "analyzerId" TEXT NOT NULL,
    "analyzerName" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Analyzer_pkey" PRIMARY KEY ("analyzerId")
);

-- CreateTable
CREATE TABLE "AnalyzerRuleMapping" (
    "mappingId" TEXT NOT NULL,
    "analyzerId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "standardName" TEXT NOT NULL,
    "standardType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyzerRuleMapping_pkey" PRIMARY KEY ("mappingId")
);

-- CreateTable
CREATE TABLE "Language" (
    "languageId" TEXT NOT NULL,
    "languageName" TEXT NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("languageId")
);

-- CreateTable
CREATE TABLE "AnalyzerWeightage" (
    "weightageId" TEXT NOT NULL,
    "analyzerId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "weightage" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyzerWeightage_pkey" PRIMARY KEY ("weightageId")
);

-- CreateTable
CREATE TABLE "Llm" (
    "llmId" TEXT NOT NULL,
    "llmName" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelIdentifier" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Llm_pkey" PRIMARY KEY ("llmId")
);

-- CreateTable
CREATE TABLE "Project" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "topLanguage" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "ProjectLanguage" (
    "projectLanguageId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ProjectLanguage_pkey" PRIMARY KEY ("projectLanguageId")
);

-- CreateTable
CREATE TABLE "Comparison" (
    "comparisonId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT,
    "languageId" TEXT,
    "promptText" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "analyzerVersions" JSONB,
    "llmId" TEXT,

    CONSTRAINT "Comparison_pkey" PRIMARY KEY ("comparisonId")
);

-- CreateTable
CREATE TABLE "CodeSample" (
    "codeSampleId" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "codeType" TEXT NOT NULL,
    "llmId" TEXT,
    "codeContent" TEXT NOT NULL,
    "source" TEXT,
    "repositoryUrl" TEXT,
    "isOriginal" BOOLEAN NOT NULL DEFAULT false,
    "promptUsed" TEXT,
    "generatedAt" TIMESTAMP(3),
    "modificationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeSample_pkey" PRIMARY KEY ("codeSampleId")
);

-- CreateTable
CREATE TABLE "Vulnerability" (
    "vulnerabilityId" TEXT NOT NULL,
    "codeSampleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filePath" TEXT,
    "lineNumber" INTEGER,
    "severityByEachAnalyzer" JSONB,
    "severity" TEXT,
    "severityScore" DOUBLE PRECISION,
    "confidenceScoreByEachAnalyzer" JSONB,
    "confidenceScore" DOUBLE PRECISION,
    "detectedBy" JSONB,
    "allStandardsViolated" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vulnerability_pkey" PRIMARY KEY ("vulnerabilityId")
);

-- CreateTable
CREATE TABLE "BenchmarkScore" (
    "benchmarkId" TEXT NOT NULL,
    "codeSampleId" TEXT NOT NULL,
    "securityScore" DOUBLE PRECISION,
    "qualityScore" DOUBLE PRECISION,
    "overallBenchmarkIndex" DOUBLE PRECISION,
    "isUpdateGlobal" BOOLEAN NOT NULL DEFAULT false,
    "analyzerVersions" JSONB,
    "computationMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BenchmarkScore_pkey" PRIMARY KEY ("benchmarkId")
);

-- CreateTable
CREATE TABLE "GlobalBenchmark" (
    "globalBenchmarkId" TEXT NOT NULL,
    "llmId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "avgSecurityScore" DOUBLE PRECISION,
    "avgQualityScore" DOUBLE PRECISION,
    "avgOBI" DOUBLE PRECISION,
    "totalComparisons" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "severityDistribution" JSONB,

    CONSTRAINT "GlobalBenchmark_pkey" PRIMARY KEY ("globalBenchmarkId")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "chatSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "comparisonId" TEXT,
    "vulnerabilityId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("chatSessionId")
);

-- CreateTable
CREATE TABLE "ChatConversation" (
    "messageId" TEXT NOT NULL,
    "chatSessionId" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vulnerabilityId" TEXT,
    "type" TEXT,
    "generatedOutput" TEXT,
    "isHelpful" BOOLEAN,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("messageId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Analyzer_analyzerName_key" ON "Analyzer"("analyzerName");

-- CreateIndex
CREATE UNIQUE INDEX "Language_languageName_key" ON "Language"("languageName");

-- CreateIndex
CREATE UNIQUE INDEX "Llm_llmName_key" ON "Llm"("llmName");

-- AddForeignKey
ALTER TABLE "UserApiKey" ADD CONSTRAINT "UserApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyzerRuleMapping" ADD CONSTRAINT "AnalyzerRuleMapping_analyzerId_fkey" FOREIGN KEY ("analyzerId") REFERENCES "Analyzer"("analyzerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyzerRuleMapping" ADD CONSTRAINT "AnalyzerRuleMapping_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "StandardPure"("standardId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyzerWeightage" ADD CONSTRAINT "AnalyzerWeightage_analyzerId_fkey" FOREIGN KEY ("analyzerId") REFERENCES "Analyzer"("analyzerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyzerWeightage" ADD CONSTRAINT "AnalyzerWeightage_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("languageId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLanguage" ADD CONSTRAINT "ProjectLanguage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLanguage" ADD CONSTRAINT "ProjectLanguage_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("languageId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("languageId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_llmId_fkey" FOREIGN KEY ("llmId") REFERENCES "Llm"("llmId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeSample" ADD CONSTRAINT "CodeSample_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "Comparison"("comparisonId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vulnerability" ADD CONSTRAINT "Vulnerability_codeSampleId_fkey" FOREIGN KEY ("codeSampleId") REFERENCES "CodeSample"("codeSampleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkScore" ADD CONSTRAINT "BenchmarkScore_codeSampleId_fkey" FOREIGN KEY ("codeSampleId") REFERENCES "CodeSample"("codeSampleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalBenchmark" ADD CONSTRAINT "GlobalBenchmark_llmId_fkey" FOREIGN KEY ("llmId") REFERENCES "Llm"("llmId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalBenchmark" ADD CONSTRAINT "GlobalBenchmark_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("languageId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "Comparison"("comparisonId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession"("chatSessionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "Vulnerability"("vulnerabilityId") ON DELETE SET NULL ON UPDATE CASCADE;
