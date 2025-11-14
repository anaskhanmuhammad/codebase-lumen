"use client";

import {
  Card,
  CardHeader,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Shield, User, Bot } from "lucide-react";

export default function SonarResults({ sessionId, human, llm }) {
  return (
    <Card className="border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
      <CardHeader>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          SonarQube Analysis
        </h2>
        <CardDescription>Session ID: {sessionId}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Human metrics */}
        <div className="p-4 border rounded-lg bg-white dark:bg-slate-900">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <User className="h-4 w-4" />
            Human Code Metrics
          </h3>

          <ul className="text-sm space-y-1">
            {human.measures?.map((m, idx) => (
              <li key={idx} className="flex justify-between">
                <span>{m.metric}:</span>
                <span className="font-bold">{m.value}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* LLM metrics */}
        <div className="p-4 border rounded-lg bg-white dark:bg-slate-900">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Bot className="h-4 w-4" />
            LLM Code Metrics
          </h3>

          <ul className="text-sm space-y-1">
            {llm.measures?.map((m, idx) => (
              <li key={idx} className="flex justify-between">
                <span>{m.metric}:</span>
                <span className="font-bold">{m.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
