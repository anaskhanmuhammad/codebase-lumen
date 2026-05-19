"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, ShieldAlert, Activity, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

function toPrettyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getSeverityColor(severity) {
  const sev = String(severity).toUpperCase();
  if (sev === "HIGH") return "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300";
  if (sev === "MEDIUM") return "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
  if (sev === "LOW") return "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-950/30 dark:text-slate-300";
}

function getConfidenceColor(confidence) {
  const conf = String(confidence).toUpperCase();
  if (conf === "HIGH") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (conf === "MEDIUM") return "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
  if (conf === "LOW") return "bg-slate-100 text-slate-700 dark:bg-slate-950/30 dark:text-slate-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-950/30 dark:text-slate-300";
}

function BanditCodeSnippet({ snippet, startLine, highlightStart, highlightEnd, originalCode }) {
  if (!snippet && (!originalCode || !startLine)) return null;

  let lines = [];
  let displayStartLine = startLine;

  if (snippet) {
    const text = snippet.replace(/\n$/, "");
    lines = text.split("\n");
  } else {
    const allLines = originalCode.split(/\r?\n/);
    const startIdx = Math.max(0, startLine - 3);
    const endIdx = Math.min(allLines.length - 1, (highlightEnd || startLine) + 2);
    lines = allLines.slice(startIdx, endIdx + 1);
    displayStartLine = startIdx + 1;
  }

  return (
    <pre className="rounded-lg border bg-background p-3 text-sm overflow-auto mt-2">
      {lines.map((lineText, i) => {
        const currentLineNum = displayStartLine + i;
        const isHighlighted = currentLineNum >= highlightStart && currentLineNum <= highlightEnd;

        return (
          <div
            key={i}
            className={`flex px-2 py-0.5 ${
              isHighlighted ? "bg-yellow-50 dark:bg-yellow-900/20" : ""
            }`}
          >
            <span className="w-10 shrink-0 select-none text-right text-xs text-muted-foreground mr-3 pr-2 border-r border-border/50">
              {currentLineNum}
            </span>
            <span className="font-mono text-xs whitespace-pre">{lineText}</span>
          </div>
        );
      })}
    </pre>
  );
}

function BanditIssueCard({ issue, rule, expanded, onToggle, code }) {
  const message = issue.message?.text || "No message provided.";
  const ruleId = issue.ruleId || "Unknown Rule";
  
  const properties = issue.properties || {};
  const issueSeverity = properties.issue_severity || "UNKNOWN";
  const issueConfidence = properties.issue_confidence || "UNKNOWN";

  const location = issue.locations?.[0]?.physicalLocation || {};
  const filePath = location.artifactLocation?.uri || "unknown file";
  const region = location.region || {};
  const contextRegion = location.contextRegion || region;

  const tags = rule?.properties?.tags || [];
  const helpUri = rule?.helpUri;

  return (
    <div className="rounded-xl border bg-card transition-colors hover:bg-accent/20">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 p-4 text-left"
      >
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={getSeverityColor(issueSeverity)}>
              <ShieldAlert className="h-3 w-3 mr-1" />
              Sev: {issueSeverity}
            </Badge>
            <Badge className={getConfidenceColor(issueConfidence)}>
              <Activity className="h-3 w-3 mr-1" />
              Conf: {issueConfidence}
            </Badge>
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
              {ruleId}
            </span>
            {tags.map((tag) => (
              <span key={tag} className="text-xs text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>

          <div className="space-y-1">
            <p className="font-medium leading-snug text-foreground">{message}</p>
            <p className="break-all text-xs text-muted-foreground">
              {filePath}:{region.startLine || "?"}
            </p>
          </div>
        </div>

        <span className="mt-1 text-muted-foreground shrink-0">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      {expanded && (
        <div className="border-t bg-muted/10 p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground mb-1">Rule Info</p>
              <p className="font-medium text-sm">{rule?.name || ruleId}</p>
              {helpUri && (
                <a
                  href={helpUri}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline inline-flex items-center mt-2"
                >
                  View documentation <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              )}
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground mb-1">Location Details</p>
              <p className="font-medium text-sm font-mono break-all">{filePath}</p>
              <p className="text-xs mt-1 text-muted-foreground">
                Lines {region.startLine} to {region.endLine || region.startLine}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Code Context</p>
            <BanditCodeSnippet
              snippet={contextRegion.snippet?.text || region.snippet?.text}
              startLine={contextRegion.startLine || region.startLine}
              highlightStart={region.startLine}
              highlightEnd={region.endLine || region.startLine}
              originalCode={code}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Raw Issue JSON</p>
            <pre className="max-h-64 overflow-auto rounded-lg border bg-background p-3 text-xs">
              {toPrettyJson(issue)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BanditResultsView({ payload, code }) {
  const [expandedIssueId, setExpandedIssueId] = useState(null);

  const run = payload?.runs?.[0] || {};
  const invocations = run.invocations || [];
  const runProperties = run.properties || {};
  const metrics = runProperties.metrics?._totals || {};
  const results = run.results || [];
  const rules = run.tool?.driver?.rules || [];
  
  const ruleMap = new Map(rules.map((r) => [r.id, r]));

  const summary = {
    loc: metrics.loc || 0,
    highSev: metrics["SEVERITY.HIGH"] || 0,
    mediumSev: metrics["SEVERITY.MEDIUM"] || 0,
    lowSev: metrics["SEVERITY.LOW"] || 0,
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="issues">
            Issues {results.length > 0 && `(${results.length})`}
          </TabsTrigger>
          <TabsTrigger value="raw">Raw Bandit SARIF</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border bg-card p-4 flex flex-col justify-center items-center text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Findings</p>
              <p className="text-4xl font-bold">{results.length}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 flex flex-col justify-center items-center text-center">
              <p className="text-sm text-muted-foreground mb-1">High Severity</p>
              <p className="text-4xl font-bold text-red-600">{summary.highSev}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 flex flex-col justify-center items-center text-center">
              <p className="text-sm text-muted-foreground mb-1">Medium Severity</p>
              <p className="text-4xl font-bold text-amber-600">{summary.mediumSev}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 flex flex-col justify-center items-center text-center">
              <p className="text-sm text-muted-foreground mb-1">LOC Analyzed</p>
              <p className="text-4xl font-bold text-slate-700">{summary.loc}</p>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold mb-4 flex items-center">
              <Shield className="h-5 w-5 mr-2 text-slate-600" />
              Bandit Analysis Run Details
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Version</p>
                <p className="font-medium">{run.tool?.driver?.version || "Unknown"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Execution Time</p>
                <p className="font-medium">
                  {invocations[0]?.endTimeUtc
                    ? new Date(invocations[0].endTimeUtc).toLocaleString()
                    : "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rules Engine</p>
                <p className="font-medium">{run.tool?.driver?.name || "Bandit"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Execution Successful</p>
                <p className="font-medium">{invocations[0]?.executionSuccessful ? "Yes" : "No"}</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="issues" className="mt-6 space-y-4">
          {results.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No Bandit vulnerabilities found in this code.</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {results.map((issue, idx) => {
                const key = `${issue.ruleId}-${idx}`;
                return (
                  <BanditIssueCard
                    key={key}
                    issue={issue}
                    rule={ruleMap.get(issue.ruleId)}
                    expanded={expandedIssueId === key}
                    onToggle={() =>
                      setExpandedIssueId((prev) => (prev === key ? null : key))
                    }
                    code={code}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="raw" className="mt-6">
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Complete SARIF Payload</h3>
              <Badge variant="secondary">Bandit RAW</Badge>
            </div>
            <pre className="max-h-[32rem] overflow-auto rounded-lg border bg-muted/50 p-4 text-xs font-mono">
              {toPrettyJson(payload)}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
