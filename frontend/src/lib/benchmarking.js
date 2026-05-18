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

function inferCategory(vulnerability) {
  if (isSecurityByStandards(vulnerability?.allStandardsViolated)) return "security";

  const issueType = String(vulnerability?.detectedBy?.issueType || "")
    .trim()
    .toLowerCase();
  if (issueType.includes("vulnerability") || issueType.includes("security")) return "security";

  const severity = String(vulnerability?.severity || "")
    .trim()
    .toLowerCase();
  if (["blocker", "critical", "high"].includes(severity)) return "security";

  return "quality";
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

function getSeverityBucket(vulnerability) {
  const levelOrSeverity = String(vulnerability?.level || vulnerability?.severity || "")
    .trim()
    .toLowerCase();

  if (["error", "blocker", "critical", "high"].includes(levelOrSeverity)) return "error";
  if (["warning", "major", "medium"].includes(levelOrSeverity)) return "warning";
  if (["note", "minor", "low"].includes(levelOrSeverity)) return "note";
  return "other";
}

function clampScore(value) {
  if (Number.isNaN(value) || value == null) return 0;
  return Math.max(0, Math.min(100, value));
}

export function scoreSample({ vulnerabilities }) {
  const summary = {
    penalties: { security: 0, quality: 0 },
    counts: { security: 0, quality: 0 },
    bySeverity: {
      security: { error: 0, warning: 0, note: 0, other: 0 },
      quality: { error: 0, warning: 0, note: 0, other: 0 },
    },
  };

  const list = Array.isArray(vulnerabilities) ? vulnerabilities : [];

  for (const vulnerability of list) {
    const category = inferCategory(vulnerability);
    const penalty = getPenalty(vulnerability);
    const bucket = getSeverityBucket(vulnerability);

    summary.penalties[category] += penalty;
    summary.counts[category] += 1;
    summary.bySeverity[category][bucket] += 1;
  }

  const securityScore = clampScore(100 - summary.penalties.security);
  const qualityScore = clampScore(100 - summary.penalties.quality);

  return {
    securityScore,
    qualityScore,
    bothScore: clampScore((securityScore + qualityScore) / 2),
    summary,
  };
}

export function aggregateByLlm(samples) {
  const rowsByLlm = new Map();

  for (const sample of samples || []) {
    const llm = sample?.llm;
    if (!llm?.llmId) continue;

    const vulnerabilities = Array.isArray(sample?.vulnerabilities) ? sample.vulnerabilities : [];

    const scored = scoreSample({ vulnerabilities });

    const existing = rowsByLlm.get(llm.llmId) || {
      llmId: llm.llmId,
      llmName: llm.llmName || "Unknown",
      provider: llm.provider || null,
      sampleCount: 0,
      sumSecurity: 0,
      sumQuality: 0,
      scoresTimeline: [],
      findings: {
        security: 0,
        quality: 0,
      },
      severity: {
        security: { error: 0, warning: 0, note: 0, other: 0 },
        quality: { error: 0, warning: 0, note: 0, other: 0 },
      },
    };

    existing.sampleCount += 1;
    existing.sumSecurity += scored.securityScore;
    existing.sumQuality += scored.qualityScore;
    existing.scoresTimeline.push({
      t: sample?.createdAt ? new Date(sample.createdAt).getTime() : Date.now(),
      security: scored.securityScore,
      quality: scored.qualityScore,
      both: scored.bothScore,
    });

    existing.findings.security += scored.summary.counts.security;
    existing.findings.quality += scored.summary.counts.quality;

    for (const bucket of ["error", "warning", "note", "other"]) {
      existing.severity.security[bucket] += scored.summary.bySeverity.security[bucket];
      existing.severity.quality[bucket] += scored.summary.bySeverity.quality[bucket];
    }

    rowsByLlm.set(llm.llmId, existing);
  }

  const rows = Array.from(rowsByLlm.values()).map((row) => {
    const avgSecurity = row.sampleCount ? row.sumSecurity / row.sampleCount : 0;
    const avgQuality = row.sampleCount ? row.sumQuality / row.sampleCount : 0;
    const bothScore = (avgSecurity + avgQuality) / 2;

    const timeline = [...row.scoresTimeline].sort((a, b) => a.t - b.t);

    return {
      ...row,
      avgSecurity,
      avgQuality,
      bothScore,
      scoresTimeline: timeline,
    };
  });

  return rows;
}

export function formatScore(value) {
  if (value == null || Number.isNaN(Number(value))) return "0";
  return String(Math.round(Number(value)));
}

export function buildSparklinePoints(values, width = 120, height = 28, padding = 2) {
  const list = Array.isArray(values) ? values : [];
  if (list.length === 0) return "";

  const min = Math.min(...list);
  const max = Math.max(...list);
  const range = Math.max(1, max - min);

  const xStep = list.length === 1 ? 0 : (width - padding * 2) / (list.length - 1);

  return list
    .map((v, idx) => {
      const x = padding + idx * xStep;
      const y = padding + (height - padding * 2) * (1 - (v - min) / range);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
