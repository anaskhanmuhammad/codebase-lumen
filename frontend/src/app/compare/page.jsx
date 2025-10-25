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
import {
  Code2,
  User,
  Bot,
  PlayCircle,
  CheckCircle2,
  FileCode,
  Loader2,
} from "lucide-react";
import { analyzeCode } from "./actions/analyzeCode";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const Compare = () => {
  const [humanCode, setHumanCode] = useState("");
  const [llmCode, setLlmCode] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState(null);

  const handleAnalyze = async () => {
    if (!humanCode.trim() || !llmCode.trim()) {
      alert("Please provide both code samples");
      return;
    }

    try {
      setIsAnalyzing(true);
      const res = await analyzeCode(humanCode, llmCode);
      if (res.success) {
        setResults(res);
        setShowResults(true);
      } else {
        alert(`Error: ${res.error}`);
      }
    } catch (err) {
      alert(`Error analyzing code: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    setHumanCode("");
    setLlmCode("");
    setShowResults(false);
    setResults(null);
  };

  const chartData = results
    ? [
        {
          name: "Security",
          Human: results.human.securityScore,
          LLM: results.llm.securityScore,
        },
        {
          name: "Quality",
          Human: results.human.qualityScore,
          LLM: results.llm.qualityScore,
        },
      ]
    : [];

  return (
    <div>
      <div className="max-w-7xl mx-auto space-y-6 ">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Code2 className="h-8 w-8 text-black-600" />
            <h1 className="text-4xl font-bold ">Code Comparison Analysis</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Compare human-written code with LLM-generated code for security and
            quality metrics
          </p>
        </div>

        {/* Code Input Sections */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Human Code */}
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
              <Label htmlFor="human-code" className="text-sm font-medium">
                Code Input
              </Label>
              <Textarea
                id="human-code"
                placeholder="// Paste your human-written code here..."
                value={humanCode}
                onChange={(e) => setHumanCode(e.target.value)}
                disabled={isAnalyzing}
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Lines: {humanCode.split("\n").length}</span>
                <span>Characters: {humanCode.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* LLM Code */}
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
              <Label htmlFor="llm-code" className="text-sm font-medium">
                Code Input
              </Label>
              <Textarea
                id="llm-code"
                placeholder="// Paste your LLM-generated code here..."
                value={llmCode}
                onChange={(e) => setLlmCode(e.target.value)}
                disabled={isAnalyzing}
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Lines: {llmCode.split("\n").length}</span>
                <span>Characters: {llmCode.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Buttons */}
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

        {/* Results */}
        {showResults && results && (
          <Card className="border-2 border-green-200 bg-green-50/50 dark:bg-green-950/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <CardTitle>Analysis Complete</CardTitle>
              </div>
              <CardDescription>
                Security and quality metrics for both code samples
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="security">Security</TabsTrigger>
                  <TabsTrigger value="quality">Quality</TabsTrigger>
                </TabsList>

                {/* OVERVIEW */}
                <TabsContent value="overview" className="space-y-6 mt-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Human */}
                    <div className="p-4 border rounded-lg bg-white dark:bg-slate-900">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Human Code Metrics
                      </h3>
                      <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                        <li>Security Score: {results.human.securityScore}</li>
                        <li>Quality Score: {results.human.qualityScore}</li>
                        <li>Functions: {results.human.functions}</li>
                        <li>Complexity: {results.human.complexity}</li>
                        <li>Comments: {results.human.comments}</li>
                      </ul>
                    </div>

                    {/* LLM */}
                    <div className="p-4 border rounded-lg bg-white dark:bg-slate-900">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        LLM Code Metrics
                      </h3>
                      <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                        <li>Security Score: {results.llm.securityScore}</li>
                        <li>Quality Score: {results.llm.qualityScore}</li>
                        <li>Functions: {results.llm.functions}</li>
                        <li>Complexity: {results.llm.complexity}</li>
                        <li>Comments: {results.llm.comments}</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="font-semibold mb-3">Overall Comparison</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {results.comparison.summary}
                    </p>
                  </div>

                  <div className="h-64 mt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Human" fill="#2563eb" />
                        <Bar dataKey="LLM" fill="#16a34a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                {/* SECURITY */}
                <TabsContent value="security" className="mt-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <strong>Human:</strong>{" "}
                    {results.human.foundDangerous.join(", ") ||
                      "No major issues"}{" "}
                    <br />
                    <strong>LLM:</strong>{" "}
                    {results.llm.foundDangerous.join(", ") || "No major issues"}
                  </p>
                </TabsContent>

                {/* QUALITY */}
                <TabsContent value="quality" className="mt-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <strong>Human:</strong> {results.human.todoCount} TODOs,
                    {results.human.longLines} long lines <br />
                    <strong>LLM:</strong> {results.llm.todoCount} TODOs,
                    {results.llm.longLines} long lines
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Compare;
