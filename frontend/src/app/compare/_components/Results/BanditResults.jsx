"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert } from "lucide-react";
import SeverityChart from "../SeverityChart";

const ConfidenceBadge = ({ level }) => {
  const colors = {
    HIGH: "border-green-600 text-green-600",
    MEDIUM: "border-yellow-600 text-yellow-600",
    LOW: "border-slate-500 text-slate-600",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded border text-xs ${colors[level] || ""}`}
    >
      {level}
    </span>
  );
};

const IssueCard = ({ issue }) => {
  return (
    <details className="group border rounded-lg p-3 mb-3">
      <summary className="cursor-pointer font-medium">
        {issue.test_id} — {issue.test_name}
      </summary>

      <div className="mt-2 text-sm space-y-2">
        <p className="text-slate-700 dark:text-slate-300">{issue.issue_text}</p>

        <p>
          <strong>Line:</strong> {issue.line_number}
        </p>

        <pre className="bg-slate-100 dark:bg-slate-800 p-2 rounded text-xs overflow-x-auto">
          {issue.code}
        </pre>
      </div>
    </details>
  );
};

const SummaryBox = ({ summary }) => {
  return (
    <div className="flex gap-6 p-3 border rounded-lg text-sm dark:bg-slate-900">
      <div>
        <div className="text-muted-foreground">Total Issues</div>
        <div className="text-lg font-semibold">{summary.total_issues}</div>
      </div>
      <div>
        <div className="text-muted-foreground">Lines of Code</div>
        <div className="text-lg font-semibold">{summary.loc}</div>
      </div>
    </div>
  );
};

const BanditResultsSection = ({ title, results }) => {
  if (!results) return null;

  const issues = results.issues || [];
  const summary = results.summary;

  return (
    <div className="p-4 border rounded-lg dark:bg-slate-900 space-y-4">
      <h3 className="font-semibold mb-2 flex items-center gap-2">
        {title} <Badge>{summary.total_issues}</Badge>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SummaryBox summary={summary} />
      </div>

      <div className="mt-4">
        {issues.length === 0 ? (
          <p className="text-sm text-green-600">No issues found 🎉</p>
        ) : (
          issues.map((issue, i) => <IssueCard key={i} issue={issue} />)
        )}
      </div>
    </div>
  );
};

const BanditResults = ({ human, llm, sessionId }) => {
  if (!human && !llm) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-yellow-600" />
          Bandit Security Analysis
        </CardTitle>
        <CardDescription>Session ID: {sessionId}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        <div className="grid md:grid-cols-2 gap-6">
          <BanditResultsSection title="Human Code" results={human} />
          <BanditResultsSection title="LLM Code" results={llm} />
        </div>
      </CardContent>
    </Card>
  );
};

export default BanditResults;
