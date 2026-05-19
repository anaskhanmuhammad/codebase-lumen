"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, ShieldAlert, Activity, Shield, AlertCircle, Bug, Clock, Lightbulb } from "lucide-react";
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
  if (sev === "BLOCKER" || sev === "CRITICAL") return "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300";
  if (sev === "MAJOR") return "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
  if (sev === "MINOR" || sev === "INFO") return "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-950/30 dark:text-slate-300";
}

function getTypeIcon(type) {
  const t = String(type).toUpperCase();
  if (t === "BUG") return <Bug className="h-3 w-3 mr-1" />;
  if (t === "VULNERABILITY" || t === "SECURITY_HOTSPOT") return <ShieldAlert className="h-3 w-3 mr-1" />;
  return <Lightbulb className="h-3 w-3 mr-1" />; // default for CODE_SMELL
}

function SonarCodeSnippet({ snippet, startLine, highlightStart, highlightEnd, originalCode }) {
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

function SonarIssueCard({ issue, rule, expanded, onToggle, code }) {
  const ruleId = issue.ruleId || rule?.id || "Unknown Rule";
  const message = issue.message?.text || rule?.shortDescription?.text || "No message provided.";
  
  const properties = issue.properties || {};
  const severity = properties.severity || "UNKNOWN";
  const type = properties.type || "UNKNOWN";
  const status = properties.status || "OPEN";
  const effort = properties.effort;
  const category = properties.category || "Unknown";
  
  const location = issue.locations?.[0]?.physicalLocation || {};
  const filePath = location.artifactLocation?.uri || "unknown file";
  const region = location.region || {};
  
  const helpText = rule?.fullDescription?.text || rule?.shortDescription?.text;

  return (
    <div className="rounded-xl border bg-card transition-colors hover:bg-accent/20">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 p-4 text-left"
      >
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={getSeverityColor(severity)}>
              Sev: {severity}
            </Badge>
            <Badge variant="outline" className="bg-background">
              {getTypeIcon(type)}
              {String(type).replace("_", " ")}
            </Badge>
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
              {ruleId}
            </span>
            {effort && (
              <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Clock className="h-3 w-3 mr-1" />
                {effort}
              </Badge>
            )}
          </div>

          <div className="space-y-1">
            <p className="font-medium leading-snug text-foreground">{message}</p>
            <p className="break-all text-xs text-muted-foreground">
              {filePath}:{region.startLine || "?"}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-1 mt-2">
            {category && (
              <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
                Cat: {category}
              </span>
            )}
            {status && (
              <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
                Status: {status}
              </span>
            )}
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
              <p className="text-xs text-muted-foreground mt-2">{helpText}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground mb-1">Location Details</p>
              <p className="font-medium text-sm font-mono break-all">{filePath}</p>
              <p className="text-xs mt-1 text-muted-foreground">
                Lines {region.startLine} to {region.endLine || region.startLine}
              </p>
              {region.startColumn && (
                <p className="text-xs mt-1 text-muted-foreground">
                  Cols {region.startColumn} to {region.endColumn || region.startColumn}
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Code Context</p>
            <SonarCodeSnippet
              snippet={region.snippet?.text}
              startLine={region.startLine}
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

export default function SonarResultsView({ payload, code }) {
  const [expandedIssueId, setExpandedIssueId] = useState(null);

  const run = payload?.runs?.[0] || {};
  const results = run.results || [];
  const rules = run.tool?.driver?.rules || [];
  const topProperties = run.properties || {};
  
  const ruleMap = new Map(rules.map((r) => [r.id, r]));

  let codeSmellCount = 0;
  let bugCount = 0;
  let vulnCount = 0;
  let criticalBlockerCount = 0;

  results.forEach(res => {
    const props = res.properties || {};
    const type = String(props.type || "").toUpperCase();
    const severity = String(props.severity || "").toUpperCase();
    
    if (type === "CODE_SMELL") codeSmellCount++;
    else if (type === "BUG") bugCount++;
    else if (type === "VULNERABILITY" || type === "SECURITY_HOTSPOT") vulnCount++;

    if (severity === "CRITICAL" || severity === "BLOCKER") criticalBlockerCount++;
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="issues">
            Issues {results.length > 0 && `(${results.length})`}
          </TabsTrigger>
          <TabsTrigger value="raw">Raw SonarQube SARIF</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border bg-card p-4 flex flex-col justify-center items-center text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Issues</p>
              <p className="text-4xl font-bold">{topProperties.totalIssues || results.length}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 flex flex-col justify-center items-center text-center">
              <p className="text-sm text-muted-foreground mb-1">Critical / Blocker</p>
              <p className="text-4xl font-bold text-red-600">{criticalBlockerCount}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 flex flex-col justify-center items-center text-center">
              <p className="text-sm text-muted-foreground mb-1">Code Smells</p>
              <p className="text-4xl font-bold text-amber-600">{codeSmellCount}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 flex flex-col justify-center items-center text-center">
              <p className="text-sm text-muted-foreground mb-1">Bugs</p>
              <p className="text-4xl font-bold text-blue-600">{bugCount}</p>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold mb-4 flex items-center">
              <Shield className="h-5 w-5 mr-2 text-slate-600" />
              SonarQube Analysis Details
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Rules Engine</p>
                <p className="font-medium">{run.tool?.driver?.name || "SonarQube"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paging Info</p>
                <p className="font-medium">
                  {topProperties.paging?.total ? `Total ${topProperties.paging.total} records` : "Unknown"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">Component Key</p>
                <p className="font-medium break-all">{topProperties.componentKey || "None provided"}</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="issues" className="mt-6 space-y-4">
          {results.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No SonarQube issues found in this code.</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {results.map((issue, idx) => {
                const key = `${issue.ruleId || 'rule'}-${idx}`;
                return (
                  <SonarIssueCard
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
              <Badge variant="secondary">SonarQube RAW</Badge>
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