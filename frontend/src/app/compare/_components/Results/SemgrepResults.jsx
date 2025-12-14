import { Card, CardContent, CardHeader } from "@/components/ui/card";
import SeverityChart from "../SeverityChart";
import { Badge, Bug, MapPin, ShieldAlert } from "lucide-react";
import SeverityBadge from "../SeverityBadge";

// Section component for LLM or Human findings
function FindingsSection({ title, findings }) {
  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">{title}</h3>
        <Badge variant="secondary">{findings.length}</Badge>
      </div>

      {/* Severity chart */}
      <SeverityChart findings={findings} />

      {/* Findings list */}
      <div className="space-y-3">
        {findings.map((f, i) => (
          <details
            key={i}
            className="group border border-border rounded-lg p-4 hover:border-primary/50 transition"
          >
            <summary className="cursor-pointer flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                <span className="font-medium">{f.check_id}</span>
              </div>
              <SeverityBadge severity={f.extra?.severity} />
            </summary>

            <div className="mt-3 space-y-2 text-sm">
              <p className="text-muted-foreground">{f.extra?.message}</p>

              <div className="flex flex-wrap gap-2 text-xs">
                {f.extra?.metadata?.cwe && (
                  <Badge variant="secondary">CWE: {f.extra.metadata.cwe}</Badge>
                )}
                {f.extra?.metadata?.owasp && (
                  <Badge variant="secondary">
                    OWASP: {f.extra.metadata.owasp}
                  </Badge>
                )}
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Line {f.start?.line}, Col{" "}
                  {f.start?.col}
                </span>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

// Main component
export default function SemgrepResults({ human, llm }) {
  return (
    <Card className="border-2">
      <CardHeader>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Semgrep Findings
        </h2>
      </CardHeader>

      <CardContent className="space-y-8">
        <FindingsSection
          title="LLM Code Findings"
          findings={llm.findings || []}
        />
        <FindingsSection
          title="Human Code Findings"
          findings={human.findings || []}
        />
      </CardContent>
    </Card>
  );
}
