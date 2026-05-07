"use client";

import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Trophy, ShieldAlert, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  getSarifResults,
  getSarifRuleMap,
  getIssueCategory,
  getIssueSeverity,
  getSeverityPenalty,
} from "@/lib/sarif";

const ANALYZERS = ["semgrep", "sonar", "bandit", "aiServer"];

export default function ComparisonWinner({ results, rawAnalyzerResponses }) {
  const { chartData, winner } = useMemo(() => {
    if (!results || results.length === 0 || !rawAnalyzerResponses) {
      return { chartData: [], winner: null };
    }

    let bestScore = Infinity;
    let currentWinner = null;
    const data = [];

    results.forEach((item) => {
      let securityScore = 0;
      let qualityScore = 0;
      let securityCount = 0;
      let qualityCount = 0;
      let totalPenalty = 0;

      const codeResponse = rawAnalyzerResponses[item.codeKey];
      if (codeResponse?.analyzers) {
        for (const name of ANALYZERS) {
          const payload = codeResponse.analyzers[name];
          if (!payload) continue;

          const sarifResults = getSarifResults(payload);
          const ruleMap = getSarifRuleMap(payload);

          for (const result of sarifResults) {
            const severity = getIssueSeverity(result);
            const category = getIssueCategory(result, name, ruleMap);
            const penalty = getSeverityPenalty(severity);

            totalPenalty += penalty;

            if (category === "security") {
              securityCount++;
              securityScore += penalty;
            } else {
              qualityCount++;
              qualityScore += penalty;
            }
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
        currentWinner = { ...item, totalPenalty, securityCount, qualityCount };
      } else if (totalPenalty === bestScore && currentWinner) {
        if (securityScore < currentWinner.securityScore) {
          currentWinner = { ...item, totalPenalty, securityCount, qualityCount, securityScore };
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
