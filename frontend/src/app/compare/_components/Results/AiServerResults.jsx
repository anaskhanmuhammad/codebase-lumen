"use client";

import React from "react";
import {
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  Code2,
  Briefcase,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const SeverityBadge = ({ severity }) => {
  const colors = {
    Critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
    High: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    Medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    Low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
  };

  const defaultColor = "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        colors[severity] || defaultColor
      }`}
    >
      {severity}
    </span>
  );
};

const IssueCard = ({ issue }) => {
  return (
    <div className="border rounded-lg p-4 bg-white dark:bg-slate-900 shadow-sm space-y-3">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm md:text-base flex items-center gap-2">
                {issue.title}
            </h4>
            {issue.standard && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                    {issue.standard}
                </Badge>
            )}
        </div>
        {issue.severity && <SeverityBadge severity={issue.severity} />}
      </div>
      
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {issue.description}
      </p>

      {issue.snippet && (
        <div className="bg-slate-50 dark:bg-slate-950 rounded p-3 text-xs font-mono border overflow-x-auto">
          <div className="flex justify-between text-muted-foreground mb-1 select-none">
            <span>
              {issue.file_name} : {issue.start_line}-{issue.end_line}
            </span>
          </div>
          <code>{issue.snippet}</code>
        </div>
      )}

      {issue.remediation && (
         <div className="text-sm bg-blue-50 dark:bg-blue-900/10 p-3 rounded-md border border-blue-100 dark:border-blue-800">
            <span className="font-semibold text-blue-700 dark:text-blue-300 block mb-1">Remediation:</span>
            <p className="text-slate-700 dark:text-slate-300 mb-2">{issue.remediation}</p>
            {issue.fixed_snippet && (
                 <div className="bg-slate-900 text-slate-50 rounded p-2 text-xs font-mono overflow-x-auto">
                    <code>{issue.fixed_snippet}</code>
                 </div>
            )}
         </div>
      )}
    </div>
  );
};

const AnalysisSection = ({ title, icon: Icon, issues, defaultOpen = false }) => {
  if (!issues || issues.length === 0) return null;

  return (
    <Accordion type="single" collapsible defaultValue={defaultOpen ? "item-1" : ""}>
      <AccordionItem value="item-1" className="border rounded-lg bg-slate-50/50 dark:bg-slate-900/20 px-4">
        <AccordionTrigger className="hover:no-underline py-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Icon className="h-5 w-5" />
            <span>{title}</span>
            <Badge variant="secondary" className="ml-2">
              {issues.length}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-4 space-y-4">
          {issues.map((issue, idx) => (
            <IssueCard key={idx} issue={issue} />
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

const ResultView = ({ data, type }) => {
    if(!data) return null;
    const analysis = data; // Data is already the analysis object

    if(!analysis) return <div className="p-4 text-center text-muted-foreground">No analysis data available</div>

    return (
        <div className="space-y-6">
            {/* Summary Card */}
            <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-indigo-100 dark:border-indigo-900">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                        <Info className="h-5 w-5" />
                        Analysis Summary
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm md:text-base leading-relaxed text-slate-700 dark:text-slate-300">
                        {analysis.summary}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-4">
                        {analysis.languages_detected?.map(lang => (
                            <Badge key={lang} variant="outline" className="border-indigo-200 bg-indigo-100/50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                                {lang}
                            </Badge>
                        ))}
                         {analysis.frameworks_detected?.map(fw => (
                            <Badge key={fw} variant="outline" className="border-purple-200 bg-purple-100/50 text-purple-800 dark:border-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                                {fw}
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <AnalysisSection 
                    title="Security Issues" 
                    icon={ShieldAlert} 
                    issues={analysis.security_issues} 
                    defaultOpen={true}
                />
                <AnalysisSection 
                    title="Quality Issues" 
                    icon={Code2} 
                    issues={analysis.quality_issues} 
                />
                <AnalysisSection 
                    title="Business Logic Issues" 
                    icon={Briefcase} 
                    issues={analysis.business_logic_issues} 
                />
            </div>
        </div>
    )
}

export default function AiServerResults({ human, llm }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
            <h2 className="text-2xl font-bold tracking-tight">AI Server Analysis</h2>
            <p className="text-muted-foreground">Deep analysis powered by Qwen 2.5 Coder</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 flex items-center justify-center font-bold">
                    H
                </div>
                <h3 className="text-xl font-semibold">Human Code</h3>
            </div>
            {human?.success ? (
                 <ResultView data={human.data} type="human" />
            ) : (
                <div className="p-4 border rounded-lg border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900">
                    Analysis failed: {human?.error || "Unknown error"}
                </div>
            )}
        </div>

        <div className="space-y-4">
             <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300 flex items-center justify-center font-bold">
                    AI
                </div>
                <h3 className="text-xl font-semibold">LLM Code</h3>
            </div>
             {llm?.success ? (
                 <ResultView data={llm.data} type="llm" />
            ) : (
                <div className="p-4 border rounded-lg border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900">
                    Analysis failed: {llm?.error || "Unknown error"}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
