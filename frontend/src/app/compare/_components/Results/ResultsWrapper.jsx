"use client";

import SonarResults from "./SonarResults";
import SemgrepResults from "./SemgrepResults";
import BanditResults from "./BanditResults";

export default function ResultsWrapper({ results }) {
  return (
    <div className="space-y-6">
      <SonarResults
        sessionId={results.sessionId}
        human={results.human}
        llm={results.llm}
      />

      {/* <BanditResults results={results} /> */}
      <SemgrepResults human={results.human} llm={results.llm} />
    </div>
  );
}
