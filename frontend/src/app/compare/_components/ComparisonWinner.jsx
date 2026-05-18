"use client";

import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Trophy, ShieldAlert, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const SECURITY_MARKERS = [
  "security",
  "cwe",
  "owasp",
  "vuln",
  "vulnerability",
  "injection",
  "xss",
  "csrf",
  "ssrf",
  "rce",
  "auth",
  "crypto",
  "sqli",
  "sql",
  "ssl",
  "privacy",
];

function normalizeStandards(allStandardsViolated) {
  if (!Array.isArray(allStandardsViolated)) return [];
  return allStandardsViolated
    .map((tag) => String(tag || "").trim().toLowerCase())
    .filter(Boolean);
}

function isSecurityByStandards(allStandardsViolated) {
  const tags = normalizeStandards(allStandardsViolated);
  return tags.some((tag) => SECURITY_MARKERS.some((marker) => tag.includes(marker)));
}

function getPenalty(vulnerability) {
  const levelOrSeverity = String(vulnerability?.level || vulnerability?.severity || "")
    .trim()
    .toLowerCase();

  if (["error", "blocker", "critical", "high"].includes(levelOrSeverity)) return 10;
  if (["warning", "major", "medium"].includes(levelOrSeverity)) return 6;
  if (["note", "minor", "low"].includes(levelOrSeverity)) return 3;
  return 1;
}

export default function ComparisonWinner({ results, rawAnalyzerResponses }) {
  const { chartData, winner } = useMemo(() => {
    if (!results || results.length === 0 || !rawAnalyzerResponses) {
      return { chartData: [], winner: null };
    }

    let bestScore = Infinity;
    let currentWinner = null;
    const data = [];

    results.forEach((item) => {
      let securityPenalty = 0;
      let qualityPenalty = 0;
      let securityCount = 0;
      let qualityCount = 0;
      let totalPenalty = 0;

      const codeResponse = rawAnalyzerResponses[item.codeKey];
      const vulnerabilities = Array.isArray(codeResponse?.vulnerabilities)
        ? codeResponse.vulnerabilities
        : [];

      if (vulnerabilities.length > 0) {
        for (const vulnerability of vulnerabilities) {
          const penalty = getPenalty(vulnerability);
          const isSecurity = isSecurityByStandards(vulnerability?.allStandardsViolated);

          totalPenalty += penalty;

          if (isSecurity) {
            securityCount += 1;
            securityPenalty += penalty;
          } else {
            qualityCount += 1;
            qualityPenalty += penalty;
          }
        }
      }

      data.push({
        name: item.label,
        Security: securityCount,
        Quality: qualityCount,
        Penalty: totalPenalty,
      });

      // Tie-breaker: least penalty, then least security score, then least quality score
      if (totalPenalty < bestScore) {
        bestScore = totalPenalty;
        currentWinner = {
          ...item,
          totalPenalty,
          securityCount,
          qualityCount,
          securityPenalty,
          qualityPenalty,
        };
      } else if (totalPenalty === bestScore && currentWinner) {
        if (securityPenalty < (currentWinner.securityPenalty || 0)) {
          currentWinner = {
            ...item,
            totalPenalty,
            securityCount,
            qualityCount,
            securityPenalty,
            qualityPenalty,
          };
        } else if (
          securityPenalty === (currentWinner.securityPenalty || 0) &&
          qualityPenalty < (currentWinner.qualityPenalty || 0)
        ) {
          currentWinner = {
            ...item,
            totalPenalty,
            securityCount,
            qualityCount,
            securityPenalty,
            qualityPenalty,
          };
        }
      }
    });

    return { chartData: data, winner: currentWinner };
  }, [results, rawAnalyzerResponses]);

  if (!chartData || chartData.length === 0) return null;

  return (
    <div className="space-y-6 mt-8">
      {winner && (
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Trophy size={120} />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Trophy className="h-6 w-6 text-yellow-500" />
              Comparison Winner: {winner.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <p className="text-sm text-emerald-800 dark:text-emerald-300 mb-4">
              This code sample demonstrated the lowest vulnerability penalty score, making it the most robust choice based on current analysis.
            </p>
            <div className="flex gap-4">
              <Badge variant="outline" className="bg-white/50 dark:bg-black/20 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-3 py-1">
                <ShieldAlert className="w-4 h-4 mr-2" />
                {winner.securityCount} Security Issues
              </Badge>
              <Badge variant="outline" className="bg-white/50 dark:bg-black/20 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-3 py-1">
                <Zap className="w-4 h-4 mr-2" />
                {winner.qualityCount} Quality Issues
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Vulnerability Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "var(--accent)" }}
                  contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)" }}
                />
                <Legend />
                <Bar dataKey="Security" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Quality" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
