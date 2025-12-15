"use client";

import React, { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, XCircle } from "lucide-react";

import CodeInputCard from "./_components/CodeInputCard";
import ActionButtons from "./_components/ActionButtons";
import ResultsWrapper from "./_components/Results/ResultsWrapper";
import Header from "./_components/Header";

import { analyzeBandit } from "./actions/analyzeBandit";
import { analyzeSemgrep } from "./actions/analyzeSemgrep";
import { analyzeCode } from "./actions/analyzeCode";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function Compare() {
  const [humanCode, setHumanCode] = useState("");
  const [llmCode, setLlmCode] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  // Track selected analyzers
  const [selectedAnalyses, setSelectedAnalyses] = useState({
    bandit: true,
    semgrep: false,
    sonar: false,
  });

  const handleToggleAnalysis = (key, checked) => {
    setSelectedAnalyses((prev) => ({
      ...prev,
      [key]: checked === true,
    }));
  };

  const handleAnalyze = async () => {
    if (!humanCode.trim() || !llmCode.trim()) {
      alert("Please provide both code samples");
      return;
    }

    try {
      setIsAnalyzing(true);
      setError(null);
      setResults(null);

      // Prepare selected analyzers
      const analyzers = [];
      if (selectedAnalyses.bandit)
        analyzers.push({ name: "bandit", fn: analyzeBandit });
      if (selectedAnalyses.semgrep)
        analyzers.push({ name: "semgrep", fn: analyzeSemgrep });
      if (selectedAnalyses.sonar)
        analyzers.push({ name: "sonar", fn: analyzeCode });

      // Run selected analyses in parallel
      const resultsArray = await Promise.allSettled(
        analyzers.map((a) => a.fn(humanCode, llmCode))
      );

      // Map results back to analyzer names
      const combinedResults = {};
      analyzers.forEach((a, i) => {
        const res = resultsArray[i];
        combinedResults[a.name] =
          res.status === "fulfilled"
            ? res.value
            : {
                human: { findings: [] },
                llm: { findings: [] },
                success: false,
              };
      });

      if (Object.values(combinedResults).some((r) => !r.success)) {
        setError(
          "One or more analyses failed. Partial results may be displayed."
        );
      }

      // Normalize results for UI
      const unifiedResults = {
        sessionId: combinedResults.bandit?.sessionId || null,

        bandit: selectedAnalyses.bandit ? combinedResults.bandit : null,

        semgrep: selectedAnalyses.semgrep ? combinedResults.semgrep : null,

        sonar: selectedAnalyses.sonar ? combinedResults.sonar : null,
      };

      setResults(unifiedResults);
    } catch (err) {
      setError(err.message || "Unexpected error during analysis");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    setHumanCode("");
    setLlmCode("");
    setResults(null);
    setError(null);
    setSelectedAnalyses({ bandit: true, semgrep: false, sonar: false });
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Header />

        {/* Info Alert */}
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-slate-700 dark:text-slate-300">
            Paste your code samples, select analyzers, and click{" "}
            <strong>Analyze</strong>
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

        {/* Analyzer Selection */}
        <div className="mt-6">
          <h4 className="font-semibold mb-2">Select Analyses:</h4>
          <div className="flex flex-col md:flex-row gap-4">
            {["bandit", "semgrep", "sonar"].map((key) => (
              <Label
                key={key}
                htmlFor={key}
                className="hover:bg-accent/50 flex items-center gap-2 rounded-lg border p-3
                  has-[[aria-checked=true]]:border-blue-600 
                  has-[[aria-checked=true]]:bg-blue-50 
                  dark:has-[[aria-checked=true]]:border-blue-900 
                  dark:has-[[aria-checked=true]]:bg-blue-950"
              >
                <Checkbox
                  id={key}
                  checked={selectedAnalyses[key]}
                  onCheckedChange={(checked) =>
                    handleToggleAnalysis(key, checked)
                  }
                />
                <span className="font-medium capitalize">{key}</span>
              </Label>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <ActionButtons
          isAnalyzing={isAnalyzing}
          humanCode={humanCode}
          llmCode={llmCode}
          onAnalyze={handleAnalyze}
          onClear={handleClear}
        />

        {/* Results */}
        {results && <ResultsWrapper results={results} />}
      </div>
    </div>
  );
}
