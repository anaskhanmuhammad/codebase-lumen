"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Code2,
  User,
  Bot,
  PlayCircle,
  AlertCircle,
  CheckCircle2,
  FileCode,
  Loader2,
  XCircle,
  TrendingUp,
  Shield,
  Bug,
  AlertTriangle,
} from "lucide-react";
import { analyzeCode } from "./actions/analyzeCode";
import { analyzeSemgrep } from "./actions/analyzeSemgrep";

const Compare = () => {
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

    setIsAnalyzing(true);
    setError(null);
    setResults(null);

    try {
      // Run Sonar + Semgrep at the same time
      const [sonar, semgrep] = await Promise.all([
        analyzeCode(humanCode, llmCode),
        analyzeSemgrep(humanCode, llmCode),
      ]);

      if (!sonar.success || !semgrep.success) {
        throw new Error("One of the analyses failed.");
      }

      // merge results into single object
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

  // Helper to extract metric value
  const getMetricValue = (measures, metricKey) => {
    const measure = measures?.find((m) => m.metric === metricKey);
    return measure?.value || "0";
  };

  // Helper to render metric card
  const MetricCard = ({ icon: Icon, title, humanValue, llmValue, color }) => {
    const humanNum = parseFloat(humanValue) || 0;
    const llmNum = parseFloat(llmValue) || 0;
    const diff = llmNum - humanNum;
    const isLlmBetter = diff < 0;

    return (
      <div className="p-4 border rounded-lg bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2 mb-3">
          <Icon className={`h-5 w-5 ${color}`} />
          <h3 className="font-semibold">{title}</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500 mb-1">Human Code</p>
            <p className="text-2xl font-bold">{humanValue}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">LLM Code</p>
            <p className="text-2xl font-bold">{llmValue}</p>
          </div>
        </div>
        {diff !== 0 && (
          <div
            className={`mt-2 text-xs flex items-center gap-1 ${
              isLlmBetter ? "text-green-600" : "text-red-600"
            }`}
          >
            <TrendingUp className="h-3 w-3" />
            <span>
              {isLlmBetter ? "LLM has " : "LLM has "}
              {Math.abs(diff).toFixed(1)} {isLlmBetter ? "fewer" : "more"}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Code2 className="h-8 w-8 text-black-600" />
            <h1 className="text-4xl font-bold">Code Comparison Analysis</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Compare human-written code with LLM-generated code for security and
            quality metrics
          </p>
        </div>
        {/* Alert Info */}
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-slate-700 dark:text-slate-300">
            Paste your code samples below and click <strong>Analyze</strong> to
            run comprehensive security and quality analysis
          </AlertDescription>
        </Alert>
        {/* Error Alert */}
        {error && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-sm text-red-700 dark:text-red-300">
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
        )}
        {/* Main Comparison Area */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Human Code Section */}
          <Card className="border-2 hover:border-blue-300 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User />
                  <CardTitle>Human-Written Code</CardTitle>
                </div>
                <Badge variant="outline">
                  <FileCode className="h-3 w-3 mr-1" />
                  Source
                </Badge>
              </div>
              <CardDescription>
                Paste the original human-written code for comparison
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Label htmlFor="human-code" className="text-sm font-medium">
                  Code Input
                </Label>
                <Textarea
                  id="human-code"
                  placeholder="// Paste your human-written code here..."
                  value={humanCode}
                  onChange={(e) => setHumanCode(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  disabled={isAnalyzing}
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Lines: {humanCode.split("\n").length}</span>
                  <span>Characters: {humanCode.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* LLM Code Section */}
          <Card className="border-2 hover:border-blue-300 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot />
                  <CardTitle>LLM-Generated Code</CardTitle>
                </div>
                <Badge variant="outline">
                  <FileCode className="h-3 w-3 mr-1" />
                  AI
                </Badge>
              </div>
              <CardDescription>
                Paste the LLM-generated code for the same task
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Label htmlFor="llm-code" className="text-sm font-medium">
                  Code Input
                </Label>
                <Textarea
                  id="llm-code"
                  placeholder="// Paste your LLM-generated code here..."
                  value={llmCode}
                  onChange={(e) => setLlmCode(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  disabled={isAnalyzing}
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Lines: {llmCode.split("\n").length}</span>
                  <span>Characters: {llmCode.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-4">
          <Button
            size="lg"
            onClick={handleAnalyze}
            disabled={isAnalyzing || !humanCode.trim() || !llmCode.trim()}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <PlayCircle className="mr-2 h-5 w-5" />
                Analyze Code
              </>
            )}
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={handleClear}
            disabled={isAnalyzing}
          >
            Clear All
          </Button>
        </div>
        Results Section
        {results && (
          <div className="space-y-6">
            {/* ✅ SONARQUBE SECTION */}
            <Card className="border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
              <CardHeader>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  SonarQube Analysis
                </h2>
                <CardDescription>
                  Session ID: {results.sessionId}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* ✅ HUMAN SONAR */}
                <div className="p-4 border rounded-lg bg-white dark:bg-slate-900">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Human Code Metrics
                  </h3>

                  <ul className="text-sm space-y-1">
                    {results.human?.component?.measures?.map((m, idx) => (
                      <li key={idx} className="flex justify-between">
                        <span>{m.metric}:</span>
                        <span className="font-bold">{m.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* ✅ LLM SONAR */}
                <div className="p-4 border rounded-lg bg-white dark:bg-slate-900">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    LLM Code Metrics
                  </h3>

                  <ul className="text-sm space-y-1">
                    {results.llm?.component?.measures?.map((m, idx) => (
                      <li key={idx} className="flex justify-between">
                        <span>{m.metric}:</span>
                        <span className="font-bold">{m.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* ✅ SEMGREP SECTION */}
            <Card className="border-2 border-red-200 bg-red-50/50 dark:bg-red-950/20">
              <CardHeader>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Bug className="h-5 w-5 text-red-600" />
                  Semgrep Findings
                </h2>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* ✅ LLM SEMGREP FINDINGS */}
                <div className="p-4 border rounded-lg bg-white dark:bg-slate-900">
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <Bot className="h-4 w-4" />
                    LLM Code Findings
                    <Badge>
                      {results.segrep?.llm?.findings?.length ||
                        results.llm?.findings?.length}
                    </Badge>
                  </h3>

                  {(results.llm?.findings || []).map((f, i) => (
                    <div key={i} className="mb-4 p-3 border rounded-lg">
                      <p>
                        <strong>Rule:</strong> {f.check_id}
                      </p>
                      <p>
                        <strong>Severity:</strong> {f.extra?.severity}
                      </p>
                      <p>
                        <strong>Message:</strong> {f.extra?.message}
                      </p>
                      <p>
                        <strong>Location:</strong> Line {f.start?.line}, Col{" "}
                        {f.start?.col}
                      </p>

                      {f.extra?.metadata?.cwe && (
                        <p>
                          <strong>CWE:</strong> {f.extra.metadata.cwe}
                        </p>
                      )}

                      {f.extra?.metadata?.owasp && (
                        <p>
                          <strong>OWASP:</strong> {f.extra.metadata.owasp}
                        </p>
                      )}

                      <pre className="bg-slate-100 mt-2 p-2 rounded text-xs whitespace-pre-wrap">
                        {f.extra?.lines}
                      </pre>
                    </div>
                  ))}
                </div>

                {/* ✅ HUMAN SEMGREP FINDINGS */}
                <div className="p-4 border rounded-lg bg-white dark:bg-slate-900">
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <User className="h-4 w-4" />
                    Human Code Findings
                    <Badge>
                      {results.segrep?.human?.findings?.length ||
                        results.human?.findings?.length}
                    </Badge>
                  </h3>

                  {(results.human?.findings || []).map((f, i) => (
                    <div key={i} className="mb-4 p-3 border rounded-lg">
                      <p>
                        <strong>Rule:</strong> {f.check_id}
                      </p>
                      <p>
                        <strong>Severity:</strong> {f.extra?.severity}
                      </p>
                      <p>
                        <strong>Message:</strong> {f.extra?.message}
                      </p>
                      <p>
                        <strong>Location:</strong> Line {f.start?.line}, Col{" "}
                        {f.start?.col}
                      </p>

                      {f.extra?.metadata?.cwe && (
                        <p>
                          <strong>CWE:</strong> {f.extra.metadata.cwe}
                        </p>
                      )}

                      {f.extra?.metadata?.owasp && (
                        <p>
                          <strong>OWASP:</strong> {f.extra.metadata.owasp}
                        </p>
                      )}

                      <pre className="bg-slate-100 mt-2 p-2 rounded text-xs whitespace-pre-wrap">
                        {f.extra?.lines}
                      </pre>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Analysis Tools
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                SonarQube, Bandit, Semgrep, ESLint & more
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Standards Coverage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                CWE, OWASP, CERT, ISO/IEC 25010
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Metrics Evaluated
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Security, Quality, Maintainability & more
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Compare;
