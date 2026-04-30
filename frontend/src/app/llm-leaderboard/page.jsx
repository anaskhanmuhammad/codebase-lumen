'use client';

"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { AlertCircle, Info, Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { aggregateByLlm, buildSparklinePoints, formatScore } from "@/lib/benchmarking";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function ScoreBar({ value, variant }) {
  const score = Math.max(0, Math.min(100, Number(value) || 0));
  const barClass =
    variant === "security"
      ? "bg-rose-500"
      : variant === "quality"
        ? "bg-emerald-500"
        : "bg-slate-900 dark:bg-slate-100";

  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${barClass}`} style={{ width: `${score}%` }} />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round(score)}</span>
    </div>
  );
}

function FindingsStack({ securityCount, qualityCount }) {
  const s = Number(securityCount) || 0;
  const q = Number(qualityCount) || 0;
  const total = s + q;
  const sPct = total ? (s / total) * 100 : 0;
  const qPct = total ? (q / total) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
        <div className="flex h-full w-full">
          <div className="bg-rose-500" style={{ width: `${sPct}%` }} />
          <div className="bg-emerald-500" style={{ width: `${qPct}%` }} />
        </div>
      </div>
      <div className="flex w-40 justify-between text-[11px] text-muted-foreground">
        <span>Sec: {s}</span>
        <span>Qual: {q}</span>
      </div>
    </div>
  );
}

function Sparkline({ values, title }) {
  const points = buildSparklinePoints(values, 120, 28, 2);
  if (!points) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <svg width="120" height="28" viewBox="0 0 120 28" aria-label={title} role="img">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.7" />
    </svg>
  );
}

function TopModelsChart({ rows, mode }) {
  const data = useMemo(() => {
    const key = mode === "security" ? "avgSecurity" : mode === "quality" ? "avgQuality" : "bothScore";
    return [...(rows || [])]
      .sort((a, b) => (b[key] || 0) - (a[key] || 0))
      .slice(0, 8)
      .map((r) => ({
        name: r.llmName,
        score: Math.round(Number(r[key] || 0)),
      }))
      .reverse();
  }, [rows, mode]);

  const fill = mode === "security" ? "var(--destructive)" : mode === "quality" ? "var(--chart-2)" : "var(--chart-1)";

  if (!data.length) {
    return <div className="text-sm text-muted-foreground">No data yet.</div>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 12 }}
            interval={0}
          />
          <RechartsTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="score" fill={fill} radius={[6, 6, 6, 6]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RulesSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Info className="h-4 w-4" />
          Benchmark rules
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Benchmark rules & formulas</SheetTitle>
          <SheetDescription>
            This explains exactly how the Security / Quality / Both benchmarks are calculated.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-4 text-sm">
          <div className="space-y-2">
            <div className="font-semibold">1) Findings input</div>
            {/* <div className="text-muted-foreground">
              We use each code sample’s persisted analyzer raw outputs and read SARIF-like results from
              <span className="font-mono"> runs[0].results</span> (or the closest equivalent shape).
              We do not persist benchmark scores; they are computed in real-time each run.
            </div> */}
          </div>

          <div className="space-y-2">
            <div className="font-semibold">2) Security vs Quality classification (same as the analyzer viewer)</div>
            <div className="text-muted-foreground">For each finding:</div>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>If analyzer is Bandit → category = Security.</li>
              <li>If <span className="font-mono">result.properties.category</span> contains “security” → Security.</li>
              <li>If it contains “quality” → Quality.</li>
              <li>
                Otherwise, we look at finding + rule tags for security markers (e.g. “cwe”, “owasp”, “xss”, “csrf”,
                “sqli”, “rce”, “crypto”). If any match → Security; else → Quality.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <div className="font-semibold">3) Severity → penalty</div>
            <div className="text-muted-foreground">Each finding contributes a penalty based on its severity:</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border p-2">
                <div className="text-xs text-muted-foreground">Error</div>
                <div className="font-semibold">10</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="text-xs text-muted-foreground">Warning</div>
                <div className="font-semibold">6</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="text-xs text-muted-foreground">Note</div>
                <div className="font-semibold">3</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="text-xs text-muted-foreground">Unspecified / other</div>
                <div className="font-semibold">1</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="font-semibold">4) Per-sample scores</div>
            <div className="text-muted-foreground">
              For a given code sample <span className="font-mono">j</span>:
            </div>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>
                SecurityPenalty<sub>j</sub> = Σ penalties of Security findings.
              </li>
              <li>
                QualityPenalty<sub>j</sub> = Σ penalties of Quality findings.
              </li>
              <li>
                SecurityScore<sub>j</sub> = max(0, 100 − SecurityPenalty<sub>j</sub>).
              </li>
              <li>
                QualityScore<sub>j</sub> = max(0, 100 − QualityPenalty<sub>j</sub>).
              </li>
              <li>
                BothScore<sub>j</sub> = (SecurityScore<sub>j</sub> + QualityScore<sub>j</sub>) / 2.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <div className="font-semibold">5) Per-LLM averages (benchmarks)</div>
            <div className="text-muted-foreground">
              For an LLM with <span className="font-mono">N</span> samples:
            </div>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>AvgSecurity = (1/N) · Σ SecurityScore<sub>j</sub></li>
              <li>AvgQuality = (1/N) · Σ QualityScore<sub>j</sub></li>
              <li>BothBenchmark = (AvgSecurity + AvgQuality) / 2</li>
            </ul>
            <div className="text-muted-foreground">
              No explicit analyzer weights are applied; all findings contribute via the penalty table.
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LeaderboardTable({ rows, mode }) {
  const sorted = useMemo(() => {
    const list = [...(rows || [])];
    const key = mode === "security" ? "avgSecurity" : mode === "quality" ? "avgQuality" : "bothScore";
    list.sort((a, b) => (b[key] || 0) - (a[key] || 0));
    return list;
  }, [rows, mode]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-3 text-left font-medium text-muted-foreground w-12">#</th>
            <th className="p-3 text-left font-medium text-muted-foreground">Model</th>
            <th className="p-3 text-left font-medium text-muted-foreground">Provider</th>
            <th className="p-3 text-left font-medium text-muted-foreground">Score</th>
            <th className="p-3 text-left font-medium text-muted-foreground">Findings mix</th>
            <th className="p-3 text-left font-medium text-muted-foreground">Trend</th>
            <th className="p-3 text-right font-medium text-muted-foreground">Samples</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => {
            const score =
              mode === "security" ? row.avgSecurity : mode === "quality" ? row.avgQuality : row.bothScore;
            const variant = mode === "both" ? "both" : mode;
            const series = (row.scoresTimeline || []).map((pt) => (mode === "security" ? pt.security : mode === "quality" ? pt.quality : pt.both));

            return (
              <tr key={row.llmId} className="border-b hover:bg-muted/40 transition-colors">
                <td className="p-3 text-muted-foreground font-semibold">{idx + 1}</td>
                <td className="p-3">
                  <div className="font-medium">{row.llmName}</div>
                </td>
                <td className="p-3">
                  <Badge variant="outline" className="text-xs">
                    {row.provider || "Unknown"}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <ScoreBar value={score} variant={variant} />
                    <Badge className="tabular-nums" variant={mode === "both" ? "default" : "outline"}>
                      {formatScore(score)}
                    </Badge>
                  </div>
                </td>
                <td className="p-3">
                  <FindingsStack securityCount={row.findings.security} qualityCount={row.findings.quality} />
                </td>
                <td className="p-3">
                  <Sparkline values={series} title={`${row.llmName} score trend`} />
                </td>
                <td className="p-3 text-right tabular-nums text-muted-foreground">{row.sampleCount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function LLMLeaderboard() {
  const { getToken } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [samples, setSamples] = useState(null);

  const runBenchmark = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/projects/benchmarks/llm-leaderboard-dataset`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to fetch benchmark dataset.");
        setSamples([]);
        return;
      }

      setSamples(Array.isArray(data?.samples) ? data.samples : []);
    } catch {
      setError("Network error. Please try again.");
      setSamples([]);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const rows = useMemo(() => {
    if (!samples) return [];
    return aggregateByLlm(samples);
  }, [samples]);

  const totals = useMemo(() => {
    const totalSamples = Array.isArray(samples) ? samples.length : 0;
    const totalLlms = rows.length;
    const totalSecurityFindings = rows.reduce((acc, r) => acc + (r.findings.security || 0), 0);
    const totalQualityFindings = rows.reduce((acc, r) => acc + (r.findings.quality || 0), 0);
    return { totalSamples, totalLlms, totalSecurityFindings, totalQualityFindings };
  }, [samples, rows]);

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">LLM Benchmarks</h1>
            {/* <Badge variant="outline">Real-time</Badge> */}
          </div>
          {/* <p className="text-sm text-muted-foreground">
            Security / Quality / Both benchmarks computed on demand using analyzer results.
          </p> */}
        </div>

        <div className="flex items-center gap-2">
          <RulesSheet />
          <Button onClick={runBenchmark} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertCircle className="h-4 w-4" />}
            {loading ? "Running…" : "Run benchmark"}
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Separator />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">LLMs</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{totals.totalLlms}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Samples</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{totals.totalSamples}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Security findings</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
            {totals.totalSecurityFindings}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Quality findings</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {totals.totalQualityFindings}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="both" className="space-y-4">
        <TabsList>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="both">Both</TabsTrigger>
        </TabsList>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Security benchmark
              </CardTitle>
            </CardHeader>
            <CardContent>
              {samples ? (
                <div className="space-y-6">
                  <TopModelsChart rows={rows} mode="security" />
                  <LeaderboardTable rows={rows} mode="security" />
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Click “Run benchmark” to compute scores.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Quality benchmark
              </CardTitle>
            </CardHeader>
            <CardContent>
              {samples ? (
                <div className="space-y-6">
                  <TopModelsChart rows={rows} mode="quality" />
                  <LeaderboardTable rows={rows} mode="quality" />
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Click “Run benchmark” to compute scores.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="both">
          <Card>
            <CardHeader>
              <CardTitle>Both benchmark (Security + Quality)</CardTitle>
            </CardHeader>
            <CardContent>
              {samples ? (
                <div className="space-y-6">
                  <TopModelsChart rows={rows} mode="both" />
                  <LeaderboardTable rows={rows} mode="both" />
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Click “Run benchmark” to compute scores.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
