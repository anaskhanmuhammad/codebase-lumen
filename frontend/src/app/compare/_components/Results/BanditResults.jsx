"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, User, ShieldAlert, AlertTriangle } from "lucide-react";

const SeverityBadge = ({ level }) => {
  const colors = {
    HIGH: "bg-red-600 text-white",
    MEDIUM: "bg-orange-500 text-white",
    LOW: "bg-yellow-500 text-white",
    INFO: "bg-blue-500 text-white",
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs ${colors[level] || ""}`}>
      {level}
    </span>
  );
};

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
    <div className="mb-4 p-3 border rounded-lg">
      <p>
        <strong>Test:</strong> {issue.test_id} — {issue.test_name}
      </p>

      <p className="flex items-center gap-2 mt-1">
        <strong>Severity:</strong>
        <SeverityBadge level={issue.issue_severity} />
      </p>

      <p className="flex items-center gap-2 mt-1">
        <strong>Confidence:</strong>
        <ConfidenceBadge level={issue.issue_confidence} />
      </p>

      <p className="mt-1">
        <strong>Message:</strong> {issue.issue_text}
      </p>

      <p className="mt-1">
        <strong>Location:</strong> Line {issue.line_number}
      </p>

      {issue.cwe && (
        <p className="mt-1">
          <strong>CWE:</strong> {issue.cwe.id}
        </p>
      )}

      <pre className=" mt-2 p-2 rounded text-xs whitespace-pre-wrap">
        {issue.code}
      </pre>
    </div>
  );
};

const SummaryBox = ({ summary }) => {
  return (
    <div className="p-3 border rounded-lg  dark:bg-slate-900 text-sm">
      <p className="flex justify-between">
        <span>Total Issues:</span>
        <span className="font-bold">{summary.total_issues}</span>
      </p>
      <p className="flex justify-between">
        <span>Lines of Code:</span>
        <span className="font-bold">{summary.loc}</span>
      </p>
      <p className="flex justify-between">
        <span>Skipped Tests:</span>
        <span className="font-bold">{summary.skipped_tests}</span>
      </p>

      <div className="mt-2">
        <strong>Severity Counts:</strong>
        <ul className="ml-3 mt-1 text-xs">
          {Object.entries(summary.severity_counts).map(([key, val]) => (
            <li key={key}>
              {key}: <strong>{val}</strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-2">
        <strong>Confidence Counts:</strong>
        <ul className="ml-3 mt-1 text-xs">
          {Object.entries(summary.confidence_counts).map(([key, val]) => (
            <li key={key}>
              {key}: <strong>{val}</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const BanditResults = ({ results }) => {
  if (!results) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-yellow-600" />
          Bandit Security Analysis
        </CardTitle>
        <CardDescription>Session ID: {results.sessionId}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* ------------------- HUMAN RESULTS ------------------- */}
        <div className="p-4 border rounded-lg  dark:bg-slate-900">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <User className="h-4 w-4" />
            Human Code Bandit Results
            <Badge>{results.human.summary.total_issues}</Badge>
          </h3>

          <SummaryBox summary={results.human.summary} />

          <div className="mt-4">
            {results.human.issues.length === 0 ? (
              <p className="text-sm text-green-600">No issues found 🎉</p>
            ) : (
              results.human.issues.map((issue, i) => (
                <IssueCard key={i} issue={issue} />
              ))
            )}
          </div>
        </div>
        {/* ------------------- LLM RESULTS ------------------- */}
        <div className="p-4 border rounded-lg  dark:bg-slate-900">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Bot className="h-4 w-4" />
            LLM Code Bandit Results
            <Badge>{results.llm.summary.total_issues}</Badge>
          </h3>

          <SummaryBox summary={results.llm.summary} />

          <div className="mt-4">
            {results.llm.issues.length === 0 ? (
              <p className="text-sm text-green-600">No issues found 🎉</p>
            ) : (
              results.llm.issues.map((issue, i) => (
                <IssueCard key={i} issue={issue} />
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BanditResults;
