"use client";

import React, { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, XCircle } from "lucide-react";

import CodeInputCard from "./_components/CodeInputCard";
import ActionButtons from "./_components/ActionButtons";
import InfoCards from "./_components/InfoCards";
import ResultsWrapper from "./_components/Results/ResultsWrapper";
import Header from "./_components/Header";
import { analyzeBandit } from "./actions/analyzeBandit";
import { analyzeSemgrep } from "./actions/analyzeSemgrep";
import { analyzeCode } from "./actions/analyzeCode";

export default function Compare() {
  const [humanCode, setHumanCode] = useState("");
  const [llmCode, setLlmCode] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!humanCode.trim() || !llmCode.trim()) {
      alert("Please provide both code samples");
      return;
    }

    try {
      setIsAnalyzing(true);
      setError(null);
      setResults(null);

      const [sonar, semgrep] = await Promise.all([
        analyzeBandit(humanCode, llmCode),
        analyzeSemgrep(humanCode, llmCode),
        // analyzeCode(humanCode, llmCode),
      ]);

      if (!sonar.success || !semgrep.success) {
        throw new Error("One of the analyses failed.");
      }

      setResults({
        sessionId: sonar.sessionId,
        human: {
          ...sonar.human,
          measures: sonar.human.component?.measures,
          findings: semgrep.human.findings,
        },
        llm: {
          ...sonar.llm,
          measures: sonar.llm.component?.measures,
          findings: semgrep.llm.findings,
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    setHumanCode("");
    setLlmCode("");
    setResults(null);
    setError(null);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Header />

        {/* Info Alert */}
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-slate-700 dark:text-slate-300">
            Paste your code samples below and click <strong>Analyze</strong>
          </AlertDescription>
        </Alert>

        {/* Error */}
        {error && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-sm text-red-700 dark:text-red-300">
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Code Inputs */}
        <div className="grid lg:grid-cols-2 gap-6">
          <CodeInputCard
            title="Human-Written Code"
            icon="human"
            value={humanCode}
            setValue={setHumanCode}
            disabled={isAnalyzing}
          />

          <CodeInputCard
            title="LLM-Generated Code"
            icon="llm"
            value={llmCode}
            setValue={setLlmCode}
            disabled={isAnalyzing}
          />
        </div>

        <ActionButtons
          isAnalyzing={isAnalyzing}
          humanCode={humanCode}
          llmCode={llmCode}
          onAnalyze={handleAnalyze}
          onClear={handleClear}
        />

        {/* Results */}
        {results && <ResultsWrapper results={results} />}

        {/* <InfoCards /> */}
      </div>
    </div>
  );
}
