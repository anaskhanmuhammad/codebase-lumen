"use client";

import { Button } from "@/components/ui/button";
import { PlayCircle, Loader2 } from "lucide-react";

export default function ActionButtons({
  isAnalyzing,
  humanCode,
  llmCode,
  onAnalyze,
  onClear,
}) {
  return (
    <div className="flex items-center justify-center gap-4">
      <Button
        size="lg"
        onClick={onAnalyze}
        disabled={isAnalyzing || !humanCode.trim() || !llmCode.trim()}
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <PlayCircle className="mr-2 h-5 w-5" />
            Analyze Code
          </>
        )}
      </Button>

      <Button
        size="lg"
        variant="outline"
        onClick={onClear}
        disabled={isAnalyzing}
      >
        Clear All
      </Button>
    </div>
  );
}
