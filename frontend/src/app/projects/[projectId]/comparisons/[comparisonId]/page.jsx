"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Loader2, ArrowLeft, Plus, Trash2, GitCompareArrows } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, XCircle } from "lucide-react";

import Header from "@/app/compare/_components/Header";
import CodeInputCard from "@/app/compare/_components/CodeInputCard";
import ResultsWrapper from "@/app/compare/_components/Results/ResultsWrapper";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { analyzeBandit } from "@/app/compare/actions/analyzeBandit";
import { analyzeSemgrep } from "@/app/compare/actions/analyzeSemgrep";
import { analyzeCode } from "@/app/compare/actions/analyzeCode";
import { analyzeAiServer } from "@/app/compare/actions/analyzeAiServer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function ComparisonPage() {
  const { getToken } = useAuth();
  const { projectId, comparisonId } = useParams();
  const router = useRouter();

  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [humanCode, setHumanCode] = useState("");
  // Start with 1 LLM code field
  const [llmCodes, setLlmCodes] = useState([""]);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null); // Array of result objects, one per LLM
  
  const [selectedAnalyses, setSelectedAnalyses] = useState({
    bandit: true,
    semgrep: false,
    sonar: false,
    aiServer: false,
  });

  useEffect(() => {
    const fetchComparison = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${BACKEND_URL}/projects/${projectId}/comparisons/${comparisonId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to load comparison.");
          return;
        }
        const data = await res.json();
        setComparison(data.comparison);
        
        // If type is LLM vs LLM, start with two LLMs and no Human code
        if (data.comparison.type === "LLM vs LLM") {
          setLlmCodes(["", ""]);
        }
      } catch (err) {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    if (projectId && comparisonId) fetchComparison();
  }, [projectId, comparisonId, getToken]);

  const handleToggleAnalysis = (key, checked) => {
    setSelectedAnalyses((prev) => ({
      ...prev,
      [key]: checked === true,
    }));
  };

  const addLlmField = () => {
    setLlmCodes([...llmCodes, ""]);
  };

  const removeLlmField = (index) => {
    const newCodes = [...llmCodes];
    newCodes.splice(index, 1);
    setLlmCodes(newCodes);
  };

  const updateLlmCode = (index, value) => {
    const newCodes = [...llmCodes];
    newCodes[index] = value;
    setLlmCodes(newCodes);
  };

  const handleAnalyze = async () => {
    const isHumanVsLlm = comparison?.type === "Human vs LLM";
    
    if (isHumanVsLlm && !humanCode.trim()) {
      alert("Please provide the human-written code sample.");
      return;
    }
    
    if (llmCodes.some(code => !code.trim())) {
      alert("Please provide code for all LLM fields.");
      return;
    }

    try {
      setIsAnalyzing(true);
      setError(null);
      setResults(null);

      const analyzers = [];
      if (selectedAnalyses.bandit) analyzers.push({ name: "bandit", fn: analyzeBandit });
      if (selectedAnalyses.semgrep) analyzers.push({ name: "semgrep", fn: analyzeSemgrep });
      if (selectedAnalyses.sonar) analyzers.push({ name: "sonar", fn: analyzeCode });
      if (selectedAnalyses.aiServer) analyzers.push({ name: "aiServer", fn: analyzeAiServer });

      // Build analysis tasks for each LLM
      const allLlmResults = [];
      
      // For LLM vs LLM, we'll treat llmCodes[0] as the "human" base for comparison against the rest,
      // or we can just compare them pairwise if there are exactly two.
      // If there are >2, we compare index 0 against index 1, index 0 against index 2, etc.
      const baseCode = isHumanVsLlm ? humanCode : llmCodes[0];
      const targetCodes = isHumanVsLlm ? llmCodes : llmCodes.slice(1);
      
      for (let i = 0; i < targetCodes.length; i++) {
        const resultsArray = await Promise.allSettled(
          analyzers.map((a) => a.fn(baseCode, targetCodes[i]))
        );

        const combinedResults = {};
        analyzers.forEach((a, j) => {
          const res = resultsArray[j];
          combinedResults[a.name] = res.status === "fulfilled" ? res.value : {
            human: { findings: [] },
            llm: { findings: [] },
            success: false,
          };
        });

        if (Object.values(combinedResults).some((r) => !r.success)) {
          console.warn(`Some analyses failed for Target ${i+1}`);
        }

        allLlmResults.push({
          sessionId: combinedResults.bandit?.sessionId || null,
          bandit: selectedAnalyses.bandit ? combinedResults.bandit : null,
          semgrep: selectedAnalyses.semgrep ? combinedResults.semgrep : null,
          sonar: selectedAnalyses.sonar ? combinedResults.sonar : null,
          aiServer: selectedAnalyses.aiServer ? combinedResults.aiServer : null,
        });
      }

      setResults(allLlmResults);
    } catch (err) {
      setError(err.message || "Unexpected error during analysis");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    setHumanCode("");
    setLlmCodes(comparison?.type === "LLM vs LLM" ? ["", ""] : [""]);
    setResults(null);
    setError(null);
    setSelectedAnalyses({ bandit: true, semgrep: false, sonar: false, aiServer: false });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !comparison) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => router.push(`/projects/${projectId}`)} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Project
        </Button>
      </div>
    );
  }

  const isHumanVsLlm = comparison.type === "Human vs LLM";

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/projects/${projectId}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{comparison.name || "Untitled Comparison"}</h1>
              <p className="text-sm text-muted-foreground">Type: {comparison.type}</p>
            </div>
          </div>
        </div>

        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-slate-700 dark:text-slate-300">
            Paste your code samples below. You can add multiple LLMs to compare against the {isHumanVsLlm ? "human code" : "first LLM code"}.
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

        <div className="flex flex-col lg:flex-row gap-6 items-stretch">
          {/* Base Code Container */}
          <div className="flex-1">
            {isHumanVsLlm ? (
              <CodeInputCard
                title="Human-Written Code"
                icon="human"
                value={humanCode}
                setValue={setHumanCode}
                disabled={isAnalyzing}
              />
            ) : (
              <CodeInputCard
                title="LLM 1 (Base)"
                icon="llm"
                value={llmCodes[0]}
                setValue={(val) => updateLlmCode(0, val)}
                disabled={isAnalyzing}
              />
            )}
          </div>

          <div className="hidden lg:flex flex-col justify-center items-center px-4">
            <div className="bg-muted p-3 rounded-full">
              <GitCompareArrows className="h-6 w-6 text-muted-foreground" />
            </div>
            <span className="text-xs font-semibold mt-2 text-muted-foreground uppercase">VS</span>
          </div>

          {/* Targets Container */}
          <div className="flex-1 space-y-4">
            {(isHumanVsLlm ? llmCodes : llmCodes.slice(1)).map((code, idx) => {
              const actualIndex = isHumanVsLlm ? idx : idx + 1;
              return (
                <div key={actualIndex} className="relative">
                  <CodeInputCard
                    title={`LLM ${isHumanVsLlm ? actualIndex + 1 : actualIndex + 1}`}
                    icon="llm"
                    value={code}
                    setValue={(val) => updateLlmCode(actualIndex, val)}
                    disabled={isAnalyzing}
                  />
                  {((isHumanVsLlm && llmCodes.length > 1) || (!isHumanVsLlm && llmCodes.length > 2)) && (
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={() => removeLlmField(actualIndex)}
                      disabled={isAnalyzing}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
            <Button 
              variant="outline" 
              className="w-full border-dashed" 
              onClick={addLlmField}
              disabled={isAnalyzing}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another LLM
            </Button>
          </div>
        </div>

        <div className="mt-6 bg-card border rounded-xl p-4">
          <h4 className="font-semibold mb-3">Select Analyses:</h4>
          <div className="flex flex-wrap gap-4">
            {["bandit", "semgrep", "sonar", "aiServer"].map((key) => (
              <Label
                key={key}
                htmlFor={key}
                className="hover:bg-accent/50 flex items-center gap-2 rounded-lg border p-3 cursor-pointer
                  has-[[aria-checked=true]]:border-primary 
                  has-[[aria-checked=true]]:bg-primary/5"
              >
                <Checkbox
                  id={key}
                  checked={selectedAnalyses[key]}
                  onCheckedChange={(checked) => handleToggleAnalysis(key, checked)}
                  disabled={isAnalyzing}
                />
                <span className="font-medium capitalize">{key}</span>
              </Label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 py-4 justify-end">
          <Button variant="outline" onClick={handleClear} disabled={isAnalyzing}>
            Clear
          </Button>
          <Button onClick={handleAnalyze} disabled={isAnalyzing} size="lg">
            {isAnalyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isAnalyzing ? "Analyzing..." : "Run Analysis"}
          </Button>
        </div>

        {results && results.length > 0 && (
          <div className="mt-8 space-y-6">
            <h2 className="text-xl font-bold">Analysis Results</h2>
            {results.length === 1 ? (
               <ResultsWrapper results={results[0]} />
            ) : (
              <Tabs defaultValue="target-0">
                <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto p-1 bg-muted/50">
                  {results.map((r, i) => (
                    <TabsTrigger key={`target-${i}`} value={`target-${i}`} className="py-2.5">
                      Vs LLM {isHumanVsLlm ? i + 1 : i + 2}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {results.map((r, i) => (
                  <TabsContent key={`content-${i}`} value={`target-${i}`} className="mt-6">
                    <ResultsWrapper results={r} />
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
