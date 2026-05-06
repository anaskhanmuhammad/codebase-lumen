export function unwrapSarifPayload(payload) {
  if (!payload) return null;
  if (payload.runs || payload.results) return payload;
  if (payload.analysis) return payload.analysis;
  if (payload.data?.analysis) return payload.data.analysis;
  if (payload.data?.runs || payload.data?.results) return payload.data;
  return payload.data || payload;
}

export function getSarifResults(payload) {
  const sarifPayload = unwrapSarifPayload(payload);
  return sarifPayload?.runs?.[0]?.results || sarifPayload?.results || [];

  //   const results = sarifPayload?.runs?.[0]?.results || sarifPayload?.results || [];
  
  // // Filter out malformed results that lack core properties (ruleId, message, or locations)
  // return results.filter((result) => {
  //   return result && (
  //     result.ruleId || 
  //     result.rule ||
  //     (result.message && typeof result.message === 'object' && result.message.text) ||
  //     (result.locations && Array.isArray(result.locations) && result.locations.length > 0)
  //   );
  // });

}

export function getSarifRules(payload) {
  const sarifPayload = unwrapSarifPayload(payload);
  return sarifPayload?.runs?.[0]?.tool?.driver?.rules || [];
}

export function getSarifRuleMap(payload) {
  return new Map(getSarifRules(payload).map((rule) => [rule.id, rule]));
}

export function normalizeSeverity(severity) {
  return String(severity || "unspecified").trim().toLowerCase();
}

export function getIssueSeverity(issue) {
  return normalizeSeverity(issue?.level || issue?.severity || issue?.properties?.severity);
}

export function collectTags(issue, ruleMap) {
  const tags = [];
  const issueTags = issue?.properties?.tags;
  const ruleTags = ruleMap.get(issue?.ruleId)?.properties?.tags || ruleMap.get(issue?.ruleId)?.tags;

  if (Array.isArray(issueTags)) tags.push(...issueTags);
  if (Array.isArray(ruleTags)) tags.push(...ruleTags);
  if (typeof issue?.properties?.category === "string") tags.push(issue.properties.category);
  if (typeof issue?.properties?.kind === "string") tags.push(issue.properties.kind);

  return tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean);
}

export function isSecurityIssue(issue, analyzerName, ruleMap) {
  if (analyzerName === "bandit") return true;

  const tags = collectTags(issue, ruleMap);
  const securityMarkers = [
    "security",
    "secure",
    "cwe",
    "owasp",
    "vulnerability",
    "vulnerabilities",
    "vuln",
    "injection",
    "xss",
    "csrf",
    "ssrf",
    "rce",
    "auth",
    "crypto",
    "cryptography",
    "sql",
    "sqli",
  ];

  return tags.some((tag) => securityMarkers.some((marker) => tag.includes(marker)));
}

export function getIssueCategory(issue, analyzerName, ruleMap) {
  if (issue?.properties?.category) {
    const category = String(issue.properties.category).trim().toLowerCase();
    if (category.includes("security")) return "security";
    if (category.includes("quality")) return "quality";
  }

  return isSecurityIssue(issue, analyzerName, ruleMap) ? "security" : "quality";
}

export function getSeverityPenalty(severity) {
  const normalized = normalizeSeverity(severity);
  if (normalized === "error") return 10;
  if (normalized === "warning") return 6;
  if (normalized === "note") return 3;
  return 1;
}
