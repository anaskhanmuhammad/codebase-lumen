"use client";

import React, { useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

function toPrettyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function analyzerLabel(name) {
  if (name === "aiServer") return "AI Server";
  if (name === "sonar") return "SonarQube";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function unwrapSarifPayload(payload) {
  if (!payload) return null;
  if (payload.runs || payload.results) return payload;
  if (payload.analysis) return payload.analysis;
  if (payload.data?.analysis) return payload.data.analysis;
  if (payload.data?.runs || payload.data?.results) return payload.data;
  return payload.data || payload;
}

function getSarifResults(payload) {
  const sarifPayload = unwrapSarifPayload(payload);
  return sarifPayload?.runs?.[0]?.results || sarifPayload?.results || [];
}

function findingsCount(analyzerName, payload) {
  if (!payload) return 0;
  if (analyzerName === "semgrep") return getSarifResults(payload).length;
  if (analyzerName === "bandit") return getSarifResults(payload).length;
  if (analyzerName === "sonar") return getSarifResults(payload).length;
  if (analyzerName === "aiServer") return getSarifResults(payload).length;
  if (Array.isArray(payload.issues)) return payload.issues.length;
  if (Array.isArray(payload.findings)) return payload.findings.length;
  return 0;
}

function severityCounts(analyzerName, payload) {
  const counts = {};
  if (!payload) return counts;

  if (analyzerName === "semgrep") {
    for (const finding of getSarifResults(payload)) {
      const sev = finding?.level || finding?.extra?.severity || "UNSPECIFIED";
      counts[sev] = (counts[sev] || 0) + 1;
    }
    return counts;
  }

  if (analyzerName === "bandit") {
    for (const issue of getSarifResults(payload)) {
      const sev = issue?.level || issue?.issue_severity || "UNSPECIFIED";
      counts[sev] = (counts[sev] || 0) + 1;
    }
    return counts;
  }

  if (analyzerName === "sonar") {
    for (const issue of getSarifResults(payload)) {
      const sev = issue?.level || issue?.severity || "UNSPECIFIED";
      counts[sev] = (counts[sev] || 0) + 1;
    }
    return counts;
  }

  if (analyzerName === "aiServer") {
    for (const issue of getSarifResults(payload)) {
      const sev = issue?.level || issue?.severity || "UNSPECIFIED";
      counts[sev] = (counts[sev] || 0) + 1;
    }
    return counts;
  }

  const walk = (value, depth = 0) => {
    if (depth > 4 || value == null) return;

    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }

    if (typeof value === "object") {
      const sev = value.severity || value.issue_severity || value.level || null;
      if (typeof sev === "string" && sev.trim()) {
        counts[sev] = (counts[sev] || 0) + 1;
      }
      for (const nested of Object.values(value)) {
        if (typeof nested === "object") walk(nested, depth + 1);
      }
    }
  };

  walk(payload);
  return counts;
}

export default function AnalyzerRawModal({ isOpen, onClose, codeEntry }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const analyzers = ["semgrep", "sonar", "bandit", "aiServer"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative mx-4 max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Raw Output by Code</h2>
            <p className="text-sm text-muted-foreground">Code: {codeEntry?.label || "Unknown"}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!codeEntry ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No raw payload available for this code.</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {analyzers.map((analyzer) => {
              const payload = codeEntry.analyzers?.[analyzer] || null;
              const counts = severityCounts(analyzer, payload);
              const totalFindings = findingsCount(analyzer, payload);

              return (
                <div key={analyzer} className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{analyzerLabel(analyzer)}</h3>
                    <Badge variant="secondary">Findings: {totalFindings}</Badge>
                  </div>

                  {Object.keys(counts).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(counts).map(([severity, count]) => (
                        <Badge key={severity} variant="outline">
                          {severity}: {count}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Native severity not available for this analyzer payload.
                    </p>
                  )}

                  {payload ? (
                    <pre className="max-h-[40vh] overflow-auto rounded border bg-muted p-3 text-xs">
                      {toPrettyJson(payload)}
                    </pre>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>No payload returned for this analyzer.</AlertDescription>
                    </Alert>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
