"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { validateDockerfile, getRecommendation } from "./dockerfileValidator";
import { SEVERITY_LEVELS } from "./dockerfileRules";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Flame,
  Copy,
  Download,
} from "lucide-react";

const ScanDockerFile = () => {
  const [dockerfileContent, setDockerfileContent] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = (e) => {
    e.preventDefault();
    setLoading(true);

    // Simulate API call delay
    setTimeout(() => {
      const validationResults = validateDockerfile(dockerfileContent);
      setResults(validationResults);
      setLoading(false);
    }, 500);
  };

  const handleClear = () => {
    setDockerfileContent("");
    setResults(null);
  };

  const handleDownloadReport = () => {
    if (!results) return;

    const report = generateReport();
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(report),
    );
    element.setAttribute("download", "dockerfile-scan-report.txt");
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const generateReport = () => {
    const recommendation = getRecommendation(results.summary);
    let report = `DOCKERFILE SECURITY & BEST PRACTICES SCAN REPORT\n`;
    report += `${"=".repeat(50)}\n\n`;

    report += `STATUS: ${recommendation.status}\n`;
    report += `${recommendation.message}\n\n`;

    report += `SUMMARY:\n`;
    report += `Total Issues: ${results.summary.total}\n`;
    report += `Critical: ${results.summary.critical}\n`;
    report += `High: ${results.summary.high}\n`;
    report += `Medium: ${results.summary.medium}\n`;
    report += `Low: ${results.summary.low}\n\n`;

    if (results.violations.length > 0) {
      report += `VIOLATIONS FOUND:\n`;
      report += `${"-".repeat(50)}\n\n`;

      results.violations.forEach((violation, index) => {
        report += `${index + 1}. [${violation.severity.toUpperCase()}] ${violation.ruleName}\n`;
        report += `   Description: ${violation.description}\n`;
        report += `   Fix: ${violation.fix}\n`;
        if (violation.matchedLines.length > 0) {
          report += `   Lines: ${violation.matchedLines.join(", ")}\n`;
        }
        report += "\n";
      });
    } else {
      report += `No violations found!\n`;
    }

    return report;
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case "critical":
        return <Flame className="w-4 h-4 text-red-600" />;
      case "high":
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case "medium":
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case "low":
        return <CheckCircle2 className="w-4 h-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const recommendation = results ? getRecommendation(results.summary) : null;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold  mb-2">
            Dockerfile Security Scanner
          </h1>
          <p className="text-lg text-gray-600">
            Analyze your Dockerfile for security vulnerabilities and best
            practices
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Section */}
          <div className="lg:col-span-2">
            <Card className="p-6 border-2">
              <form onSubmit={handleAnalyze}>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Paste your Dockerfile
                  </label>
                  <Textarea
                    placeholder={`FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \\
    python3 \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

EXPOSE 8000
CMD ["python3", "app.py"]`}
                    value={dockerfileContent}
                    onChange={(e) => setDockerfileContent(e.target.value)}
                    className="min-h-80 font-mono text-sm border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setDockerfileContent(
                        `FROM node:latest
RUN sudo apt-get update
RUN apt-get install -y curl

ENV DB_PASSWORD=secret123
ENV API_KEY=sk_live_abc123xyz

WORKDIR /app
ADD . .

RUN npm install

CMD ["node", "server.js"]`
                      )
                    }
                    className="mt-2 text-xs text-blue-600 hover:text-blue-700 underline"
                  >
                    Load Sample Vulnerable Dockerfile
                  </button>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={!dockerfileContent.trim() || loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    {loading ? "Analyzing..." : "Analyze Dockerfile"}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleClear}
                    variant="outline"
                    className="px-6"
                  >
                    Clear
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          {/* Quick Stats */}
          <div>
            <Card className="p-6 border-2  sticky top-6">
              <h2 className="text-lg font-bold  mb-4">
                Quick Stats
              </h2>

              {results ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <div className="text-3xl font-bold text-gray-900">
                      {results.summary.total}
                    </div>
                    <div className="text-sm text-gray-600">Total Issues</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                      <div className="text-xl font-bold text-red-700">
                        {results.summary.critical}
                      </div>
                      <div className="text-xs text-red-600 font-medium">
                        Critical
                      </div>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                      <div className="text-xl font-bold text-orange-700">
                        {results.summary.high}
                      </div>
                      <div className="text-xs text-orange-600 font-medium">
                        High
                      </div>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                      <div className="text-xl font-bold text-yellow-700">
                        {results.summary.medium}
                      </div>
                      <div className="text-xs text-yellow-600 font-medium">
                        Medium
                      </div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <div className="text-xl font-bold text-blue-700">
                        {results.summary.low}
                      </div>
                      <div className="text-xs text-blue-600 font-medium">
                        Low
                      </div>
                    </div>
                  </div>

                  {results.summary.total > 0 && (
                    <Button
                      onClick={handleDownloadReport}
                      variant="outline"
                      className="w-full mt-4"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Report
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">
                    Paste a Dockerfile and click analyze to see results
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Results Section */}
        {results && (
          <div className="mt-8">
            {/* Recommendation Alert */}
            <Alert className={`mb-6 border-2 p-4 ${recommendation?.color}`}>
              <div className="flex items-start gap-3">
                {results.summary.critical > 0 && (
                  <Flame className="w-5 h-5 mt-0.5 flex-shrink-0" />
                )}
                {results.summary.high > 0 && !results.summary.critical && (
                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                )}
                {results.summary.critical === 0 &&
                  results.summary.high === 0 &&
                  results.summary.medium > 0 && (
                    <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  )}
                {results.summary.total === 0 && (
                  <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
                )}

                <div>
                  <h3 className="font-bold text-lg">
                    {recommendation?.status}
                  </h3>
                  <p className="text-sm mt-1">{recommendation?.message}</p>
                </div>
              </div>
            </Alert>

            {/* Violations List */}
            {results.violations.length > 0 ? (
              <Tabs defaultValue="all" className="bg-white rounded-lg border-2">
                <TabsList className="grid w-full grid-cols-5 p-1 m-1">
                  <TabsTrigger value="all">
                    All ({results.summary.total})
                  </TabsTrigger>
                  <TabsTrigger value="critical">
                    Critical ({results.summary.critical})
                  </TabsTrigger>
                  <TabsTrigger value="high">
                    High ({results.summary.high})
                  </TabsTrigger>
                  <TabsTrigger value="medium">
                    Medium ({results.summary.medium})
                  </TabsTrigger>
                  <TabsTrigger value="low">
                    Low ({results.summary.low})
                  </TabsTrigger>
                </TabsList>

                {["all", "critical", "high", "medium", "low"].map((tab) => (
                  <TabsContent key={tab} value={tab} className="p-4 space-y-3">
                    {results.violations
                      .filter((v) => tab === "all" || v.severity === tab)
                      .map((violation, idx) => (
                        <div
                          key={idx}
                          className={`border-l-4 p-4 rounded-lg bg-opacity-50 ${SEVERITY_LEVELS[violation.severity].color}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              {getSeverityIcon(violation.severity)}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-bold text-gray-900">
                                    {violation.ruleName}
                                  </h4>
                                  <Badge variant="outline" className="text-xs">
                                    {violation.severity.toUpperCase()}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-700 mb-2">
                                  {violation.description}
                                </p>
                                <div className="bg-white bg-opacity-60 p-2 rounded text-sm font-mono text-gray-800 border border-gray-200 mb-2">
                                  💡 <span className="font-semibold">Fix:</span>{" "}
                                  {violation.fix}
                                </div>
                                {violation.matchedLines.length > 0 && (
                                  <p className="text-xs text-gray-600">
                                    Line(s):{" "}
                                    <span className="font-mono">
                                      {violation.matchedLines.join(", ")}
                                    </span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              <Card className="p-8 text-center border-2 border-green-200 bg-green-50">
                <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-green-900 mb-2">
                  Perfect!
                </h3>
                <p className="text-green-700">
                  Your Dockerfile passes all security checks and best practices
                  guidelines.
                </p>
              </Card>
            )}
          </div>
        )}

        {/* Footer Info */}
        {!results && (
          <Card className="mt-8 p-6  border-2 border-blue-200">
            <h3 className="font-bold  mb-3">📋 What We Check</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm ">
              <div>
                <h4 className="font-semibold text-red-600 mb-2">
                  Security Issues
                </h4>
                <ul className="list-disc list-inside space-y-1 ">
                  <li>Hardcoded secrets and credentials</li>
                  <li>Running as root user</li>
                  <li>Using sudo commands</li>
                  <li>Privileged mode usage</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-blue-600 mb-2">
                  Best Practices
                </h4>
                <ul className="list-disc list-inside space-y-1 ">
                  <li>Specific version tags (not latest)</li>
                  <li>Minimal layers and optimized size</li>
                  <li>Proper metadata labels</li>
                  <li>Health checks and documentation</li>
                </ul>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ScanDockerFile;
