"use client";

import BanditResults from "./BanditResults";
import SemgrepResults from "./SemgrepResults";
import SonarResults from "./SonarResults";

export default function ResultsWrapper({ results }) {
  if (!results) return null;

  return (
    <div className="space-y-6">
      {results.bandit && (
        <BanditResults
          human={results.bandit.human}
          llm={results.bandit.llm}
          sessionId={results.bandit.sessionId}
        />
      )}

      {results.semgrep && (
        <SemgrepResults
          human={results.semgrep.human}
          llm={results.semgrep.llm}
        />
      )}

      {results.sonar && (
        <SonarResults
          sessionId={results.sonar.sessionId}
          human={results.sonar.human}
          llm={results.sonar.llm}
        />
      )}
    </div>
  );
}
