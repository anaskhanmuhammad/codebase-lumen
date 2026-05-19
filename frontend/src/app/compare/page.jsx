"use client";

import React, { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, XCircle } from "lucide-react";

import CodeInputCard from "./_components/CodeInputCard";
import ActionButtons from "./_components/ActionButtons";
import Header from "./_components/Header";
import AnalyzerRawModal from "./_components/RawResults/AnalyzerRawModal";

import { analyzeBandit } from "./actions/analyzeBandit";
import { analyzeSemgrep } from "./actions/analyzeSemgrep";
import { analyzeCode } from "./actions/analyzeCode";
import { analyzeAiServer } from "./actions/analyzeAiServer";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import ruby from "highlight.js/lib/languages/ruby";
import php from "highlight.js/lib/languages/php";
import kotlin from "highlight.js/lib/languages/kotlin";
import swift from "highlight.js/lib/languages/swift";
import sql from "highlight.js/lib/languages/sql";
import bash from "highlight.js/lib/languages/bash";

hljs.registerLanguage("python", python);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("java", java);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("php", php);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("bash", bash);

const SUPPORTED_LANGS = [
  "python",
  "javascript",
  "typescript",
  "java",
  "cpp",
  "csharp",
  "go",
  "rust",
  "ruby",
  "php",
  "kotlin",
  "swift",
  "sql",
  "bash",
];

function detectLanguage(code) {
  const text = (code || "").trim();
  if (!text) return null;

  try {
    const result = hljs.highlightAuto(text, SUPPORTED_LANGS);
    return result.language || null;
  } catch {
    return null;
  }
}

export default function Compare() {
  const [humanCode, setHumanCode] = useState("");
  const [llmCode, setLlmCode] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [rawAnalyzerResponses, setRawAnalyzerResponses] = useState({});
  const [rawResultsModalState, setRawResultsModalState] = useState({
    isOpen: false,
    codeKey: null,
  });

  const [selectedAnalyses, setSelectedAnalyses] = useState({
    bandit: true,
    semgrep: false,
    sonar: false,
    aiServer: false,
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

    const detectedHumanLanguage = detectLanguage(humanCode);
    const detectedLlmLanguage = detectLanguage(llmCode);
    const detectedLanguageKey = detectedHumanLanguage || detectedLlmLanguage || "javascript";

    try {
      setIsAnalyzing(true);
      setError(null);
      setResults(null);

      const analyzers = [];
      if (selectedAnalyses.bandit)
        analyzers.push({ name: "bandit", fn: analyzeBandit });
      if (selectedAnalyses.semgrep)
        analyzers.push({ name: "semgrep", fn: analyzeSemgrep });
      if (selectedAnalyses.sonar)
        analyzers.push({ name: "sonar", fn: analyzeCode });
      if (selectedAnalyses.aiServer)
        analyzers.push({ name: "aiServer", fn: analyzeAiServer });

      const resultsArray = await Promise.allSettled(
        analyzers.map((a) => a.fn(humanCode, llmCode, detectedLanguageKey))
      );

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

      const rawByCode = {
        human: {
          codeKey: "human",
          label: "Human Code",
          code: humanCode,
          analyzers: {
            bandit: combinedResults.bandit?.human || null,
            semgrep: combinedResults.semgrep?.human || null,
            sonar: combinedResults.sonar?.human || null,
            aiServer: combinedResults.aiServer?.human || null,
          },
        },
        llm: {
          codeKey: "llm",
          label: "LLM Code",
          code: llmCode,
          analyzers: {
            bandit: combinedResults.bandit?.llm || null,
            semgrep: combinedResults.semgrep?.llm || null,
            sonar: combinedResults.sonar?.llm || null,
            aiServer: combinedResults.aiServer?.llm || null,
          },
        },
      };

      setRawAnalyzerResponses(rawByCode);
      setResults([
        { codeKey: "human", label: "Human Code" },
        { codeKey: "llm", label: "LLM Code" },
      ]);
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
    setRawAnalyzerResponses({});
    setError(null);
    setSelectedAnalyses({ bandit: true, semgrep: false, sonar: false, aiServer: false });
  };

  const hasAnyRawResults = Object.keys(rawAnalyzerResponses || {}).length > 0;

  const openRawModal = (codeKey) => {
    setRawResultsModalState({
      isOpen: true,
      codeKey,
    });
  };

  const activeCodeEntry = rawResultsModalState.codeKey
    ? rawAnalyzerResponses?.[rawResultsModalState.codeKey]
    : null;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Header />

        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-slate-700 dark:text-slate-300">
            Paste your code samples, select analyzers, and click{" "}
            <strong>Analyze</strong>
          </AlertDescription>
        </Alert>

        {error && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-sm text-red-700 dark:text-red-300">
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

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

        <div className="mt-6">
          <h4 className="font-semibold mb-2">Select Analyses:</h4>
          <div className="flex flex-col md:flex-row gap-4">
            {["bandit", "semgrep", "sonar", "aiServer"].map((key) => (
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

        <ActionButtons
          isAnalyzing={isAnalyzing}
          humanCode={humanCode}
          llmCode={llmCode}
          onAnalyze={handleAnalyze}
          onClear={handleClear}
        />

        {results && results.length > 0 && (
          <div className="mt-8 space-y-6">
            <h2 className="text-xl font-bold">Analysis Results</h2>

            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-slate-700 dark:text-slate-300">
                Results are code-wise. Open a code card to view all selected analyzers in one raw output modal.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 md:grid-cols-2">
              {results.map((resultItem) => {
                const codeResult = rawAnalyzerResponses?.[resultItem.codeKey];
                const availableAnalyzers = Object.entries(codeResult?.analyzers || {})
                  .filter(([, payload]) => Boolean(payload))
                  .map(([name]) =>
                    name === "aiServer" ? "AI Server" : name.charAt(0).toUpperCase() + name.slice(1)
                  );

                return (
                  <div key={resultItem.codeKey} className="rounded-xl border bg-card p-4 space-y-3">
                    <h3 className="font-semibold">{resultItem.label}</h3>
                    <p className="text-xs text-muted-foreground">
                      {availableAnalyzers.length > 0
                        ? `Available raw outputs: ${availableAnalyzers.join(", ")}`
                        : "No raw output available"}
                    </p>
                    <Button
                      className="w-full"
                      onClick={() => openRawModal(resultItem.codeKey)}
                      disabled={!hasAnyRawResults || availableAnalyzers.length === 0}
                    >
                      Open Issue Dashboard
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <AnalyzerRawModal
          isOpen={rawResultsModalState.isOpen}
          onClose={() => setRawResultsModalState((prev) => ({ ...prev, isOpen: false }))}
          codeEntry={activeCodeEntry}
        />
      </div>
    </div>
  );
}
