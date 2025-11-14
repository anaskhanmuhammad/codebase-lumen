"use client";

import { TrendingUp } from "lucide-react";

export default function MetricCard({
  icon: Icon,
  title,
  humanValue,
  llmValue,
  color,
}) {
  const humanNum = parseFloat(humanValue) || 0;
  const llmNum = parseFloat(llmValue) || 0;
  const diff = llmNum - humanNum;
  const isLlmBetter = diff < 0;

  return (
    <div className="p-4 border rounded-lg bg-white dark:bg-slate-900">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <h3 className="font-semibold">{title}</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-500 mb-1">Human Code</p>
          <p className="text-2xl font-bold">{humanValue}</p>
        </div>
        <div>
          <p className="text-slate-500 mb-1">LLM Code</p>
          <p className="text-2xl font-bold">{llmValue}</p>
        </div>
      </div>

      {diff !== 0 && (
        <div
          className={`mt-2 text-xs flex items-center gap-1 ${
            isLlmBetter ? "text-green-600" : "text-red-600"
          }`}
        >
          <TrendingUp className="h-3 w-3" />
          <span>
            LLM has {Math.abs(diff).toFixed(1)} {isLlmBetter ? "fewer" : "more"}
          </span>
        </div>
      )}
    </div>
  );
}
