"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, ShieldAlert, Activity, Shield, AlertCircle, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

function toPrettyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getSeverityColor(severity) {
  const sev = String(severity).toUpperCase();
  if (sev === "ERROR" || sev === "HIGH") return "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300";
  if (sev === "WARNING" || sev === "MEDIUM") return "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
  if (sev === "NOTE" || sev === "LOW") return "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-950/30 dark:text-slate-300";
}

function SemgrepCodeSnippet({ snippet, startLine, highlightStart, highlightEnd, originalCode }) {
  if (!snippet && (!originalCode || !startLine)) return null;

  let lines = [];
  let displayStartLine = startLine;

  if (snippet) {
    const text = String(snippet).replace(/\n$/, "");
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

function SemgrepIssueCard({ issue, rule, expanded, onToggle, code }) {
  const ruleId = issue.ruleId || rule?.id || "Unknown Rule";
  const message = issue.message?.text || rule?.shortDescription?.text || rule?.fullDescription?.text || "No message provided.";
  
  const level = issue.level || rule?.defaultConfiguration?.level || "WARNING";
  
  const location = issue.locations?.[0]?.physicalLocation || {};
  const filePath = location.artifactLocation?.uri || "unknown file";
  const region = location.region || {};
  
  const properties = rule?.properties || {};
  const tags = properties.tags || [];
  const precision = properties.precision || "unknown";
  
  const helpUri = rule?.helpUri;
  const helpText = rule?.help?.text || rule?.fullDescription?.text;
  
  const fixes = issue.fixes || [];

  return (
    <div className="rounded-xl border bg-card transition-colors hover:bg-accent/20">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 p-4 text-left"
      >
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={getSeverityColor(level)}>
              <ShieldAlert className="h-3 w-3 mr-1" />
              Sev: {level}
            </Badge>
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
              {ruleId}
            </span>
            {precision !== "unknown" && (
              <Badge variant="outline" className="bg-background">
                Precision: {precision}
              </Badge>
            )}
            {fixes.length > 0 && (
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                <Wrench className="h-3 w-3 mr-1" />
                Fix Available
              </Badge>
            )}
          </div>

          <div className="space-y-1">
            <p className="font-medium leading-snug text-foreground">{message}</p>
            <p className="break-all text-xs text-muted-foreground">
              {filePath}:{region.startLine || "?"}
            </p>
          </div>
          
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.slice(0, 5).map((tag) => (
                <span key={tag} className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
                  {tag}
                </span>
              ))}
              {tags.length > 5 && (
                <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
                  +{tags.length - 5} more
                </span>
              )}
            </div>
          )}
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
                  className="text-xs text-blue-600 hover:underline inline-flex items-center mt-2 break-all"
                >
                  View documentation <ExternalLink className="h-3 w-3 ml-1 shrink-0" />
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
            <p className="mb-2 text-sm font-semibold">Description & Help</p>
            <div className="rounded-lg border bg-background p-3 text-sm text-muted-foreground whitespace-pre-wrap">
              {helpText || "No extended description provided."}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Code Context</p>
            <SemgrepCodeSnippet
              snippet={region.snippet?.text}
              startLine={region.startLine}
              highlightStart={region.startLine}
              highlightEnd={region.endLine || region.startLine}
              originalCode={code}
            />
          </div>

          {fixes.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold flex items-center">
                <Wrench className="h-4 w-4 mr-2" />
                Suggested Fixes
              </p>
              <div className="space-y-3">
                {fixes.map((fix, idx) => (
                  <div key={idx} className="rounded-lg border bg-background p-3 space-y-2">
                    <p className="text-sm text-muted-foreground">{fix.description?.text || "Suggested replacement"}</p>
                    {fix.artifactChanges?.map((change, cIdx) => (
                      <div key={cIdx} className="space-y-2">
                        {change.replacements?.map((replacement, rIdx) => (
                          <div key={rIdx} className="rounded border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10 p-2">
                            <p className="text-xs text-muted-foreground mb-1">Insert at line {replacement.deletedRegion?.startLine}:</p>
                            <pre className="text-sm font-mono text-emerald-600 dark:text-emerald-400 whitespace-pre-wrap">
                              {replacement.insertedContent?.text || "(empty)"}
                            </pre>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

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

export default function SemgrepResultsView({ payload, code }) {
  const [expandedIssueId, setExpandedIssueId] = useState(null);

  const run = payload?.runs?.[0] || {};
  const invocations = run.invocations || [];
  const results = run.results || [];
  const rules = run.tool?.driver?.rules || [];
  
  const ruleMap = new Map(rules.map((r) => [r.id, r]));

  let errorCount = 0;
  let warningCount = 0;
  let noteCount = 0;
  let fixableCount = 0;

  results.forEach(res => {
    const r = ruleMap.get(res.ruleId) || resultMatchedRuleByFingerprint(res, ruleMap);
    const level = (res.level || r?.defaultConfiguration?.level || "WARNING").toUpperCase();
    
    if (level === "ERROR") errorCount++;
    else if (level === "WARNING") warningCount++;
    else noteCount++;

    if (res.fixes && res.fixes.length > 0) fixableCount++;
  });

  function resultMatchedRuleByFingerprint(res, rm) {
    if (res.ruleId) return rm.get(res.ruleId);
    if (rm.size === 1) return Array.from(rm.values())[0];
    return null;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="issues">
            Issues {results.length > 0 && `(${results.length})`}
          </TabsTrigger>
          <TabsTrigger value="raw">Raw Semgrep SARIF</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border bg-card p-4 flex flex-col justify-center items-center text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Findings</p>
              <p className="text-4xl font-bold">{results.length}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 flex flex-col justify-center items-center text-center">
              <p className="text-sm text-muted-foreground mb-1">Errors</p>
              <p className="text-4xl font-bold text-red-600">{errorCount}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 flex flex-col justify-center items-center text-center">
              <p className="text-sm text-muted-foreground mb-1">Warnings</p>
              <p className="text-4xl font-bold text-amber-600">{warningCount}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 flex flex-col justify-center items-center text-center">
              <p className="text-sm text-muted-foreground mb-1">Fixable</p>
              <p className="text-4xl font-bold text-blue-600">{fixableCount}</p>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold mb-4 flex items-center">
              <Shield className="h-5 w-5 mr-2 text-slate-600" />
              Semgrep Analysis Details
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Version</p>
                <p className="font-medium">{run.tool?.driver?.semanticVersion || run.tool?.driver?.version || "Unknown"}</p>
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
                <p className="font-medium">{run.tool?.driver?.name || "Semgrep"}</p>
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
              <AlertDescription>No Semgrep vulnerabilities found in this code.</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {results.map((issue, idx) => {
                const fetchedRule = ruleMap.get(issue.ruleId) || resultMatchedRuleByFingerprint(issue, ruleMap);
                const key = `${issue.ruleId || 'rule'}-${idx}`;
                return (
                  <SemgrepIssueCard
                    key={key}
                    issue={issue}
                    rule={fetchedRule}
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
              <Badge variant="secondary">Semgrep RAW</Badge>
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