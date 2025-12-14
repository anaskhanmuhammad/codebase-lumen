"use client";

import {
  Card,
  CardHeader,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Shield, User, Bot, Bug, AlertTriangle, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import SeverityBadge from "../SeverityBadge";
import SeverityChart from "../SeverityChart";

/* ---------- helpers ---------- */

function groupIssuesByType(issues = []) {
  return issues.reduce(
    (acc, issue) => {
      const type = issue.type || "CODE_SMELL";
      acc[type] = acc[type] || [];
      acc[type].push(issue);
      return acc;
    },
    { BUG: [], VULNERABILITY: [], CODE_SMELL: [] }
  );
}

function MetricGrid({ measures }) {
  if (!measures?.length) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {measures.map((m, i) => (
        <div key={i} className="border rounded-lg p-3 text-center">
          <div className="text-sm text-muted-foreground">{m.metric}</div>
          <div className="text-xl font-bold">{m.value}</div>
        </div>
      ))}
    </div>
  );
}

function IssueGroup({ title, icon: Icon, issues }) {
  if (!issues.length) return null;

  return (
    <details className="border rounded-lg">
      <summary className="cursor-pointer flex items-center justify-between p-4">
        <div className="flex items-center gap-2 font-semibold">
          <Icon className="h-4 w-4" />
          {title}
        </div>
        <Badge variant="secondary">{issues.length}</Badge>
      </summary>

      <div className="p-4 space-y-3">
        {issues.map((issue, idx) => (
          <div key={idx} className="border rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between items-start gap-2">
              <div className="font-medium">{issue.rule}</div>
              <SeverityBadge severity={issue.severity} />
            </div>

            {issue.message && (
              <p className="text-muted-foreground">{issue.message}</p>
            )}

            {issue.component && (
              <div className="text-xs text-muted-foreground">
                {issue.component}
                {issue.line && ` : line ${issue.line}`}
              </div>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

/* ---------- main section ---------- */

function SonarCodeSection({ title, icon: Icon, measures, issues }) {
  const grouped = groupIssuesByType(issues);

  return (
    <section className="space-y-6">
      <h3 className="font-semibold flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {title}
      </h3>

      {/* Metrics (primary Sonar signal) */}
      <MetricGrid measures={measures} />

      {/* Severity distribution */}
      {issues?.length > 0 && <SeverityChart findings={issues} />}

      {/* Issues grouped by type */}
      <div className="space-y-3">
        <IssueGroup
          title="Vulnerabilities"
          icon={AlertTriangle}
          issues={grouped.VULNERABILITY}
        />
        <IssueGroup title="Bugs" icon={Bug} issues={grouped.BUG} />
        <IssueGroup
          title="Code Smells"
          icon={Wrench}
          issues={grouped.CODE_SMELL}
        />
      </div>
    </section>
  );
}

/* ---------- exported component ---------- */

export default function SonarResults({ sessionId, human, llm }) {
  return (
    <Card className="border-2">
      <CardHeader>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Shield className="h-5 w-5" />
          SonarQube Analysis
        </h2>
        <CardDescription>Session ID: {sessionId}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-10">
        <SonarCodeSection
          title="Human Code"
          icon={User}
          measures={human.measures}
          issues={human.issues}
        />

        <SonarCodeSection
          title="LLM Code"
          icon={Bot}
          measures={llm.measures}
          issues={llm.issues}
        />
      </CardContent>
    </Card>
  );
}
