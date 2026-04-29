"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ANALYZERS = ["semgrep", "sonar", "bandit", "aiServer"];

const SEVERITY_RANK = {
  error: 4,
  warning: 3,
  note: 2,
  none: 1,
  unspecified: 0,
};

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

function getSarifRules(payload) {
  const sarifPayload = unwrapSarifPayload(payload);
  return sarifPayload?.runs?.[0]?.tool?.driver?.rules || [];
}

function getSarifRuleMap(payload) {
  return new Map(getSarifRules(payload).map((rule) => [rule.id, rule]));
}

function getCodeSnippet(code, line, context = 1) {
  if (!code || !line) return null;
  const rows = String(code).split(/\r?\n/);
  const idx = Math.max(0, Number(line) - 1);
  const start = Math.max(0, idx - context);
  const end = Math.min(rows.length - 1, idx + context);
  const slice = rows.slice(start, end + 1);
  return { lines: slice, startLine: start + 1, highlightIndex: idx - start };
}

function normalizeSeverity(severity) {
  return String(severity || "unspecified").trim().toLowerCase();
}

function getIssueSeverity(issue) {
  return normalizeSeverity(issue?.level || issue?.severity || issue?.properties?.severity);
}

function getIssueMessage(issue) {
  if (!issue) return "No message provided.";
  if (typeof issue.message === "string") return issue.message;
  return issue.message?.text || issue.properties?.message || "No message provided.";
}

function getPrimaryLocation(issue) {
  const location = issue?.locations?.[0]?.physicalLocation;
  const region = location?.region || {};

  return {
    filePath: location?.artifactLocation?.uri || issue?.properties?.filePath || "unknown",
    line: region.startLine || issue?.properties?.line || null,
    column: region.startColumn || issue?.properties?.column || null,
  };
}

function collectTags(issue, ruleMap) {
  const tags = [];
  const issueTags = issue?.properties?.tags;
  const ruleTags = ruleMap.get(issue?.ruleId)?.properties?.tags || ruleMap.get(issue?.ruleId)?.tags;

  if (Array.isArray(issueTags)) tags.push(...issueTags);
  if (Array.isArray(ruleTags)) tags.push(...ruleTags);
  if (typeof issue?.properties?.category === "string") tags.push(issue.properties.category);
  if (typeof issue?.properties?.kind === "string") tags.push(issue.properties.kind);

  return tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean);
}

function isSecurityIssue(issue, analyzerName, ruleMap) {
  if (analyzerName === "bandit") return true;

  const tags = collectTags(issue, ruleMap);
  const securityMarkers = [
    "security",
    "secure",
    "cwe",
    "owasp",
    "vulnerability",
    "vulnerabilities",
    "vuln",
    "injection",
    "xss",
    "csrf",
    "ssrf",
    "rce",
    "auth",
    "crypto",
    "cryptography",
    "sql",
    "sqli",
  ];

  return tags.some((tag) => securityMarkers.some((marker) => tag.includes(marker)));
}

function getIssueCategory(issue, analyzerName, ruleMap) {
  if (issue?.properties?.category) {
    const category = String(issue.properties.category).trim().toLowerCase();
    if (category.includes("security")) return "security";
    if (category.includes("quality")) return "quality";
  }

  return isSecurityIssue(issue, analyzerName, ruleMap) ? "security" : "quality";
}

function getIssueFingerprint(issue) {
  const location = getPrimaryLocation(issue);
  const severity = getIssueSeverity(issue);
  const message = getIssueMessage(issue).trim().toLowerCase();
  const ruleId = String(issue?.ruleId || issue?.rule || issue?.check_id || "no-rule").trim().toLowerCase();
  return [ruleId, location.filePath, location.line || "unknown", location.column || "unknown", severity, message]
    .join("::");
}

function getSeverityLabel(severity) {
  const normalized = normalizeSeverity(severity);
  if (normalized === "error") return "Error";
  if (normalized === "warning") return "Warning";
  if (normalized === "note") return "Note";
  return "Unspecified";
}

function severityBadgeClass(severity) {
  const normalized = normalizeSeverity(severity);
  if (normalized === "error") return "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300";
  if (normalized === "warning") return "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
  if (normalized === "note") return "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-950/30 dark:text-slate-300";
}

function categoryBadgeClass(category) {
  if (category === "security") return "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300";
}

function formatLocation(issue) {
  const location = getPrimaryLocation(issue);
  const line = location.line ? `:${location.line}` : "";
  const column = location.column ? `:${location.column}` : "";
  return `${location.filePath}${line}${column}`;
}

function IssueCard({ issue, expanded, onToggle, code }) {
  const locationText = formatLocation(issue);

  return (
    <div className="rounded-xl border bg-card transition-colors hover:bg-accent/20">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 p-4 text-left"
      >
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={severityBadgeClass(issue.severity)}>{getSeverityLabel(issue.severity)}</Badge>
            <Badge className={categoryBadgeClass(issue.category)}>{issue.category}</Badge>
            <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
              {issue.sourceCount} analyzer{issue.sourceCount === 1 ? "" : "s"}
            </span>
          </div>

          <div className="space-y-1">
            <p className="font-medium leading-snug text-foreground">{issue.message}</p>
            <p className="text-xs text-muted-foreground">{issue.ruleId || "No rule id"}</p>
            <p className="break-all text-xs text-muted-foreground">{locationText}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {issue.sources.map((source) => (
              <Badge key={source.name} variant="outline" className="text-xs">
                {source.label}
              </Badge>
            ))}
          </div>
        </div>

        <span className="mt-1 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      {expanded && (
        <div className="border-t bg-muted/20 p-4 space-y-4">
          {/* Code snippet around the issue line (if available) */}
          {issue.line && code && (
            (() => {
              const snippet = getCodeSnippet(code, issue.line, 1);
              if (!snippet) return null;
              return (
                <div>
                  <p className="mb-2 text-sm font-semibold">Code context (line {issue.line})</p>
                  <pre className="rounded-lg border bg-background p-3 text-sm overflow-auto">
                    {snippet.lines.map((l, i) => {
                      const lineNumber = snippet.startLine + i;
                      const isHighlight = i === snippet.highlightIndex;
                      return (
                        <div key={i} className={isHighlight ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}>
                          <span className="text-xs text-muted-foreground pr-3">{String(lineNumber).padStart(4, " ")} |</span>
                          <span className="font-mono">{l}</span>
                        </div>
                      );
                    })}
                  </pre>
                </div>
              );
            })()
          )}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Severity</p>
              <p className="font-medium">{getSeverityLabel(issue.severity)}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="font-medium capitalize">{issue.category}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Sources</p>
              <p className="font-medium">{issue.sources.map((source) => source.label).join(", ")}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Description</p>
            <p className="rounded-lg border bg-background p-3 text-sm leading-6 text-muted-foreground">
              {issue.description || issue.message}
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Raw issue JSON</p>
            <pre className="max-h-80 overflow-auto rounded-lg border bg-background p-3 text-xs">
              {toPrettyJson(issue.raw)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryBar({ securityCount, qualityCount }) {
  const total = securityCount + qualityCount;
  const securityPct = total > 0 ? (securityCount / total) * 100 : 0;
  const qualityPct = total > 0 ? (qualityCount / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full border bg-muted">
        <div className="bg-rose-500" style={{ width: `${securityPct}%` }} />
        <div className="bg-emerald-500" style={{ width: `${qualityPct}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Security: {securityCount}</span>
        <span>Quality: {qualityCount}</span>
      </div>
    </div>
  );
}

function AnalyzerStatsCard({ analyzerName, stats }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{analyzerLabel(analyzerName)}</h3>
          <p className="text-xs text-muted-foreground">Analyzer output summary</p>
        </div>
        <Badge variant="secondary">{stats.total} findings</Badge>
      </div>

      <SummaryBar securityCount={stats.security} qualityCount={stats.quality} />

      <div className="flex flex-wrap gap-2">
        {Object.entries(stats.severityCounts).map(([severity, count]) => (
          count > 0 && (
            <Badge key={severity} variant="outline" className={severityBadgeClass(severity)}>
              {getSeverityLabel(severity)}: {count}
            </Badge>
          )
        ))}
      </div>
    </div>
  );
}

function buildDashboard(codeEntry) {
  const analyzerPayloads = ANALYZERS.map((name) => ({
    name,
    payload: codeEntry?.analyzers?.[name] || null,
  })).filter((entry) => Boolean(entry.payload));

  // Show findings as-is (no deduplication). Each SARIF result becomes its
  // own issue entry. This preserves analyzer-specific findings and ordering.
  const analyzerStats = {};
  let totalFindings = 0;
  const allIssues = [];
  const analyzerIssues = {};

  for (const { name, payload } of analyzerPayloads) {
    const results = getSarifResults(payload);
    const ruleMap = getSarifRuleMap(payload);

    const stats = {
      total: results.length,
      security: 0,
      quality: 0,
      severityCounts: {
        error: 0,
        warning: 0,
        note: 0,
        none: 0,
        unspecified: 0,
      },
    };

    for (const result of results) {
      totalFindings += 1;

      const severity = getIssueSeverity(result);
      stats.severityCounts[severity] = (stats.severityCounts[severity] || 0) + 1;

      const category = getIssueCategory(result, name, ruleMap);
      if (category === "security") stats.security += 1;
      else stats.quality += 1;

      const location = getPrimaryLocation(result);
      const message = getIssueMessage(result);
      const ruleId = result?.ruleId || result?.rule || result?.check_id || "no-rule";

      const issuePayload = {
        ruleId,
        message,
        description:
          result?.message?.text || result?.properties?.description || result?.shortDescription?.text || message,
        filePath: location.filePath,
        line: location.line,
        column: location.column,
        severity,
        category,
        raw: result,
        sources: [
          {
            name,
            label: analyzerLabel(name),
            severity,
          },
        ],
        sourceCount: 1,
      };

      allIssues.push(issuePayload);

      // also track per-analyzer issues (no deduplication)
      if (!analyzerIssues[name]) analyzerIssues[name] = [];
      analyzerIssues[name].push(issuePayload);
    }

    analyzerStats[name] = stats;
  }

  const combinedIssues = allIssues.sort((a, b) => {
    const severityDelta = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0);
    if (severityDelta !== 0) return severityDelta;

    const fileDelta = String(a.filePath).localeCompare(String(b.filePath));
    if (fileDelta !== 0) return fileDelta;

    return Number(a.line || 0) - Number(b.line || 0);
  });

  const securityIssues = combinedIssues.filter((issue) => issue.category === "security");
  const qualityIssues = combinedIssues.filter((issue) => issue.category === "quality");

  return {
    analyzerStats,
    analyzerPayloads,
    combinedIssues,
    analyzerIssues,
    totalFindings,
    uniqueIssues: combinedIssues.length,
    securityIssues,
    qualityIssues,
  };
}

export default function AnalyzerRawModal({ isOpen, onClose, codeEntry }) {
  const [expandedIssueId, setExpandedIssueId] = useState(null);
  const [selectedAnalyzer, setSelectedAnalyzer] = useState(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };

    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setExpandedIssueId(null);
    }
  }, [isOpen]);

  const dashboard = useMemo(() => buildDashboard(codeEntry), [codeEntry]);

  useEffect(() => {
    // default to the first available analyzer when dashboard updates
    const first = dashboard?.analyzerPayloads?.[0]?.name || null;
    setSelectedAnalyzer((prev) => prev || first);
  }, [dashboard]);

  if (!isOpen) return null;

  if (!codeEntry) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="relative mx-4 max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Issue Dashboard</h2>
              <p className="text-sm text-muted-foreground">Code: Unknown</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No raw payload available for this code.</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const renderIssueList = (issues) => {
    if (!issues.length) {
      return (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No issues available for this category.</AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-3">
        {issues.map((issue) => {
          const issueId = getIssueFingerprint(issue);
          return (
            <IssueCard
              key={issueId}
              issue={issue}
              code={codeEntry?.code}
              expanded={expandedIssueId === issueId}
              onToggle={() => setExpandedIssueId((prev) => (prev === issueId ? null : issueId))}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative mx-4 flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b p-6">
          <div>
            <h2 className="text-xl font-semibold">Issue Dashboard</h2>
            <p className="text-sm text-muted-foreground">Code: {codeEntry?.label || "Unknown"}</p>

            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Analyzer</label>
              <select
                value={selectedAnalyzer || ""}
                onChange={(e) => setSelectedAnalyzer(e.target.value)}
                className="rounded-md border bg-background px-2 py-1 text-sm"
              >
                {dashboard.analyzerPayloads.map((a) => (
                  <option key={a.name} value={a.name}>{analyzerLabel(a.name)}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="issues">Issues</TabsTrigger>
              <TabsTrigger value="raw">Raw Payloads</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {selectedAnalyzer ? (
                  (() => {
                    const stats = dashboard.analyzerStats[selectedAnalyzer] || { total: 0, severityCounts: {} };
                    const issues = dashboard.analyzerIssues?.[selectedAnalyzer] || [];
                    const securityCount = issues.filter((i) => i.category === "security").length;
                    const qualityCount = issues.length - securityCount;

                    return (
                      <>
                        <div className="rounded-xl border bg-card p-4">
                          <p className="text-sm text-muted-foreground">Total Findings</p>
                          <p className="text-3xl font-bold">{stats.total}</p>
                        </div>
                        <div className="rounded-xl border bg-card p-4">
                          <p className="text-sm text-muted-foreground">Unique Issues</p>
                          <p className="text-3xl font-bold">{issues.length}</p>
                        </div>
                        <div className="rounded-xl border bg-card p-4">
                          <p className="text-sm text-muted-foreground">Security Issues</p>
                          <p className="text-3xl font-bold">{securityCount}</p>
                        </div>
                        <div className="rounded-xl border bg-card p-4">
                          <p className="text-sm text-muted-foreground">Quality Issues</p>
                          <p className="text-3xl font-bold">{qualityCount}</p>
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <>
                    <div className="rounded-xl border bg-card p-4">
                      <p className="text-sm text-muted-foreground">Total Findings</p>
                      <p className="text-3xl font-bold">0</p>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                      <p className="text-sm text-muted-foreground">Unique Issues</p>
                      <p className="text-3xl font-bold">0</p>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                      <p className="text-sm text-muted-foreground">Security Issues</p>
                      <p className="text-3xl font-bold">0</p>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                      <p className="text-sm text-muted-foreground">Quality Issues</p>
                      <p className="text-3xl font-bold">0</p>
                    </div>
                  </>
                )}
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">Security vs Quality</h3>
                      <p className="text-xs text-muted-foreground">
                        Combined unique issue distribution for this code sample.
                      </p>
                    </div>
                    <Badge variant="secondary">{dashboard.uniqueIssues} unique</Badge>
                  </div>
                  <SummaryBar
                    securityCount={dashboard.securityIssues.length}
                    qualityCount={dashboard.qualityIssues.length}
                  />

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border bg-background p-3">
                      <p className="text-xs text-muted-foreground">Security</p>
                      <p className="text-2xl font-semibold">{dashboard.securityIssues.length}</p>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <p className="text-xs text-muted-foreground">Quality</p>
                      <p className="text-2xl font-semibold">{dashboard.qualityIssues.length}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {ANALYZERS.filter((name) => dashboard.analyzerStats[name]).map((name) => (
                    <AnalyzerStatsCard key={name} analyzerName={name} stats={dashboard.analyzerStats[name]} />
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="issues" className="mt-6 space-y-6">
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all">All Issues</TabsTrigger>
                  <TabsTrigger value="security">Security</TabsTrigger>
                  <TabsTrigger value="quality">Quality</TabsTrigger>
                </TabsList>

                {selectedAnalyzer ? (
                  <> 
                    <TabsContent value="all" className="mt-5">
                      {renderIssueList(dashboard.analyzerIssues?.[selectedAnalyzer] || [])}
                    </TabsContent>

                    <TabsContent value="security" className="mt-5">
                      {renderIssueList(
                        (dashboard.analyzerIssues?.[selectedAnalyzer] || []).filter((i) => i.category === "security"),
                      )}
                    </TabsContent>

                    <TabsContent value="quality" className="mt-5">
                      {renderIssueList(
                        (dashboard.analyzerIssues?.[selectedAnalyzer] || []).filter((i) => i.category === "quality"),
                      )}
                    </TabsContent>
                  </>
                ) : (
                  <TabsContent value="all" className="mt-5">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>No analyzer selected.</AlertDescription>
                    </Alert>
                  </TabsContent>
                )}
              </Tabs>
            </TabsContent>

            <TabsContent value="raw" className="mt-6 space-y-4">
              {selectedAnalyzer ? (
                (() => {
                  const payload = codeEntry.analyzers?.[selectedAnalyzer] || null;
                  const results = getSarifResults(payload);
                  const ruleMap = getSarifRuleMap(payload);
                  const securityCount = results.filter((result) => isSecurityIssue(result, selectedAnalyzer, ruleMap)).length;
                  const qualityCount = results.length - securityCount;

                  return (
                    <div className="rounded-xl border bg-card p-4 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{analyzerLabel(selectedAnalyzer)}</h3>
                          <p className="text-xs text-muted-foreground">
                            {results.length} findings | {securityCount} security | {qualityCount} quality
                          </p>
                        </div>
                        <Badge variant="secondary">Raw SARIF</Badge>
                      </div>

                      <SummaryBar securityCount={securityCount} qualityCount={qualityCount} />

                      <pre className="max-h-[32rem] overflow-auto rounded-lg border bg-muted p-3 text-xs">
                        {toPrettyJson(payload)}
                      </pre>
                    </div>
                  );
                })()
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>No analyzer selected.</AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}