"use client";

import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";

export default function InfoCards() {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Analysis Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            SonarQube, Bandit, Semgrep, ESLint & more
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Standards Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            CWE, OWASP, CERT, ISO/IEC 25010
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Metrics Evaluated
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Security, Quality, Maintainability & more
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
