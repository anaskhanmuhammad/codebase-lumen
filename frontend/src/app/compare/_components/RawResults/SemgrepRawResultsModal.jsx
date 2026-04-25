"use client";

import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

export default function SemgrepRawResultsModal({ isOpen, onClose, semgrepData, targetIndex }) {
  const [expandedResult, setExpandedResult] = useState(null);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  if (!semgrepData || !semgrepData.success) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="relative w-full max-w-4xl rounded-xl border border-border bg-card p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold">Semgrep Raw Results - Target {targetIndex + 1}</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700 dark:text-red-300">
              Semgrep analysis did not complete successfully.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const renderMetrics = (metrics) => {
    if (!metrics) return null;
    return (
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted p-3 rounded">
            <p className="text-muted-foreground">Total Issues</p>
            <p className="text-2xl font-bold">{metrics.totalIssues || 0}</p>
          </div>
          <div className="bg-muted p-3 rounded">
            <p className="text-muted-foreground">Files Scanned</p>
            <p className="text-2xl font-bold">{metrics.filesScannedCount || 0}</p>
          </div>
        </div>

        {metrics.bySeverity && (
          <div>
            <p className="font-semibold mb-2">By Severity</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metrics.bySeverity).map(([severity, count]) => (
                <div key={severity} className="text-xs bg-muted px-2 py-1 rounded">
                  {severity}: {count}
                </div>
              ))}
            </div>
          </div>
        )}

        {metrics.byCategory && (
          <div>
            <p className="font-semibold mb-2">By Category</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metrics.byCategory).map(([category, count]) => (
                count > 0 && (
                  <div key={category} className="text-xs bg-muted px-2 py-1 rounded">
                    {category}: {count}
                  </div>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFinding = (finding, index) => {
    const isExpanded = expandedResult === index;
    const severity = finding.extra?.severity || "UNKNOWN";
    const severityColor = {
      ERROR: "bg-destructive/10 text-destructive",
      WARNING: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300",
      INFO: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
    }[severity] || "bg-gray-100 text-gray-700";

    return (
      <div key={index} className="border rounded-lg overflow-hidden hover:bg-muted/50 transition">
        <button
          onClick={() => setExpandedResult(isExpanded ? null : index)}
          className="w-full p-4 text-left flex items-start justify-between"
        >
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={severityColor}>{severity}</Badge>
              <span className="font-mono text-sm break-all">{finding.check_id}</span>
            </div>
            <p className="text-sm text-muted-foreground">{finding.extra?.message}</p>
            <p className="text-xs text-muted-foreground">
              {finding.path}:{finding.start?.line}:{finding.start?.col}
            </p>
          </div>
          <span className="ml-4 text-muted-foreground text-lg">
            {isExpanded ? "−" : "+"}
          </span>
        </button>

        {isExpanded && (
          <div className="border-t p-4 bg-muted/30 space-y-4">
            {finding.extra?.metadata && (
              <div>
                <p className="font-semibold text-sm mb-2">Metadata</p>
                <div className="space-y-2 text-xs">
                  {finding.extra.metadata.cwe && (
                    <div>
                      <p className="font-medium text-muted-foreground">CWE</p>
                      {finding.extra.metadata.cwe.map((cwe, i) => (
                        <p key={i} className="ml-2 text-muted-foreground">{cwe}</p>
                      ))}
                    </div>
                  )}
                  {finding.extra.metadata.owasp && (
                    <div>
                      <p className="font-medium text-muted-foreground">OWASP</p>
                      {finding.extra.metadata.owasp.map((owasp, i) => (
                        <p key={i} className="ml-2 text-muted-foreground">{owasp}</p>
                      ))}
                    </div>
                  )}
                  {finding.extra.metadata.references && finding.extra.metadata.references.length > 0 && (
                    <div>
                      <p className="font-medium text-muted-foreground">References</p>
                      {finding.extra.metadata.references.map((ref, i) => (
                        <a
                          key={i}
                          href={ref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-blue-600 hover:underline break-all"
                        >
                          {ref}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <p className="font-semibold text-sm mb-2">Raw JSON</p>
              <pre className="bg-background p-3 rounded text-xs overflow-x-auto border">
                {JSON.stringify(finding, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderResults = (data, label) => {
    if (!data || !data.raw) {
      return (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No data available</AlertDescription>
        </Alert>
      );
    }

    const { raw, metrics, findings } = data;

    return (
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold mb-3">{label} - Metrics</h3>
          {renderMetrics(metrics)}
        </div>

        <div>
          <h3 className="font-semibold mb-3">
            {label} - Findings ({findings?.length || 0})
          </h3>
          {findings && findings.length > 0 ? (
            <div className="space-y-2">
              {findings.map((finding, idx) => renderFinding(finding, idx))}
            </div>
          ) : (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                No security issues found
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div>
          <h3 className="font-semibold mb-3">Raw Response</h3>
          <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto border max-h-96">
            {JSON.stringify(raw, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-4xl rounded-xl border border-border bg-card p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold">Semgrep Raw Results - Target {targetIndex + 1}</h2>
            <p className="text-sm text-muted-foreground">Raw analyzer output from Semgrep</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Tabs defaultValue="human" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="human" className="flex-1">
              Human Code
            </TabsTrigger>
            <TabsTrigger value="llm" className="flex-1">
              LLM Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="human" className="mt-4 space-y-4">
            {renderResults(semgrepData.human, "Human Code")}
          </TabsContent>

          <TabsContent value="llm" className="mt-4 space-y-4">
            {renderResults(semgrepData.llm, "LLM Code")}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
