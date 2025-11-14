"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Bug, User, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function SemgrepResults({ human, llm }) {
  return (
    <Card className="border-2 border-red-200 bg-red-50/50 dark:bg-red-950/20">
      <CardHeader>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Bug className="h-5 w-5 text-red-600" />
          Semgrep Findings
        </h2>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* LLM Findings */}
        <div className="p-4 border rounded-lg bg-white dark:bg-slate-900">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <Bot className="h-4 w-4" />
            LLM Code Findings
            <Badge>{llm.findings?.length || 0}</Badge>
          </h3>

          {(llm.findings || []).map((f, i) => (
            <div key={i} className="mb-4 p-3 border rounded-lg">
              <p>
                <strong>Rule:</strong> {f.check_id}
              </p>
              <p>
                <strong>Severity:</strong> {f.extra?.severity}
              </p>
              <p>
                <strong>Message:</strong> {f.extra?.message}
              </p>
              <p>
                <strong>Location:</strong> Line {f.start?.line}, Col{" "}
                {f.start?.col}
              </p>

              {f.extra?.metadata?.cwe && (
                <p>
                  <strong>CWE:</strong> {f.extra.metadata.cwe}
                </p>
              )}

              {f.extra?.metadata?.owasp && (
                <p>
                  <strong>OWASP:</strong> {f.extra.metadata.owasp}
                </p>
              )}

              <pre className="bg-slate-100 mt-2 p-2 rounded text-xs whitespace-pre-wrap">
                {f.extra?.lines}
              </pre>
            </div>
          ))}
        </div>

        {/* Human Findings */}
        <div className="p-4 border rounded-lg bg-white dark:bg-slate-900">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <User className="h-4 w-4" />
            Human Code Findings
            <Badge>{human.findings?.length || 0}</Badge>
          </h3>

          {(human.findings || []).map((f, i) => (
            <div key={i} className="mb-4 p-3 border rounded-lg">
              <p>
                <strong>Rule:</strong> {f.check_id}
              </p>
              <p>
                <strong>Severity:</strong> {f.extra?.severity}
              </p>
              <p>
                <strong>Message:</strong> {f.extra?.message}
              </p>
              <p>
                <strong>Location:</strong> Line {f.start?.line}, Col{" "}
                {f.start?.col}
              </p>

              {f.extra?.metadata?.cwe && (
                <p>
                  <strong>CWE:</strong> {f.extra.metadata.cwe}
                </p>
              )}

              {f.extra?.metadata?.owasp && (
                <p>
                  <strong>OWASP:</strong> {f.extra.metadata.owasp}
                </p>
              )}

              <pre className="bg-slate-100 mt-2 p-2 rounded text-xs whitespace-pre-wrap">
                {f.extra?.lines}
              </pre>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
