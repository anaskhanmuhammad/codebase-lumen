// This is some jugar will implement real analysis soon
"use server";

import { v4 as uuidv4 } from "uuid";
const DANGEROUS_PATTERNS = [
  { name: "eval", re: /\beval\s*\(/i, severity: 30 },
  { name: "Function constructor", re: /\bnew\s+Function\s*\(/i, severity: 30 },
  {
    name: "exec/system",
    re: /\b(exec|system|popen|spawn|proc\.open)\b/i,
    severity: 35,
  },
  { name: "child_process", re: /\bchild_process\b/i, severity: 30 },
  {
    name: "sql string concat",
    re: /["'`]\s*\+\s*.*\b\+.*["'`]/i,
    severity: 10,
  }, // heuristic
  { name: "dangerous import os", re: /\bos\.system\b/i, severity: 30 },
  { name: "dangerous shell", re: /`.*\$\{?.*\}?.*`/, severity: 20 },
];

const SECRET_PATTERNS = [
  {
    name: "api_key",
    re: /\b(api[_-]?key|access[_-]?token|secret|passwd|password)\b\s*[:=]\s*["'`][^"'`]{4,}["'`]/i,
  },
  { name: "bearer", re: /\bBearer\s+[A-Za-z0-9\-_.=+/]+/i },
  { name: "private_key_block", re: /-----BEGIN (RSA|PRIVATE) KEY-----/i },
];

function countMatches(re, text) {
  const m = text.match(new RegExp(re, "gi")) || [];
  return m.length;
}

function analyzeSample(code) {
  const lines = code.split(/\r?\n/);
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0).length;
  const chars = code.length;
  const avgLineLength = lines.length ? Math.round(chars / lines.length) : 0;

  // Functions heuristics
  const functionPatterns = [
    /\bfunction\s+\w+\s*\(/gi, // JS function declaration
    /\bfunction\s*\(/gi, // anonymous function
    /\bdef\s+\w+\s*\(/gi, // python
    /\bclass\s+\w+/gi, // classes (count as functions/structures)
  ];
  let functions = 0;
  for (const p of functionPatterns) {
    functions += (code.match(p) || []).length;
  }

  // Comments & TODOs
  const commentMatches = code.match(/\/\/.*|\/\*[\s\S]*?\*\/|#[^\n]*/g) || [];
  const commentCount = commentMatches.length;
  const todoCount = (code.match(/\bTODO\b/i) || []).length;

  // Rough complexity: count branching keywords
  const complexityKeywords =
    /\b(if|else if|elif|for|while|case|switch|\?|&&|\|\|)\b/gi;
  const complexity =
    (code.match(complexityKeywords) || []).length + Math.ceil(functions / 2);

  // Dangerous patterns
  const foundDangerous = [];
  let dangerScore = 0;
  for (const patt of DANGEROUS_PATTERNS) {
    if (patt.re.test(code)) {
      foundDangerous.push(patt.name);
      dangerScore += patt.severity;
    }
  }

  // Secrets
  const foundSecrets = [];
  for (const s of SECRET_PATTERNS) {
    if (s.re.test(code)) {
      foundSecrets.push(s.name);
    }
  }

  // Long lines
  const longLines = lines.filter((l) => l.length > 120).length;

  // Heuristics to create scores 0-100 (higher is better)
  // Security score starts at 100; penalties for dangers, secrets, TODOs
  let securityScore = 100;
  securityScore -= Math.min(60, dangerScore); // cap penalty
  securityScore -= Math.min(25, foundSecrets.length * 15);
  securityScore -= Math.min(10, todoCount * 2);
  securityScore -= Math.min(15, longLines > 10 ? 10 : longLines); // long lines penalty

  // Quality score: encourage comments, smaller complexity, fewer long lines
  let qualityScore = 100;
  const commentRatio = nonEmptyLines === 0 ? 0 : commentCount / nonEmptyLines;
  qualityScore += Math.min(10, Math.round(commentRatio * 100) / 10); // up to +10 if many comments
  qualityScore -= Math.min(50, complexity * 2); // complexity penalty
  qualityScore -= Math.min(20, longLines * 1.5);
  qualityScore -= Math.min(20, todoCount * 3);

  // Clamp scores 0-100
  securityScore = Math.max(0, Math.min(100, Math.round(securityScore)));
  qualityScore = Math.max(0, Math.min(100, Math.round(qualityScore)));

  const metrics = {
    lines: lines.length,
    nonEmptyLines,
    characters: chars,
    functions,
    comments: commentCount,
    todoCount,
    complexity,
    longLines,
    avgLineLength,
    foundDangerous,
    foundSecrets,
    securityScore,
    qualityScore,
  };

  return metrics;
}

function compareMetrics(human, llm) {
  const compare = {
    securityBetter:
      human.securityScore > llm.securityScore
        ? "human"
        : human.securityScore < llm.securityScore
        ? "llm"
        : "equal",
    qualityBetter:
      human.qualityScore > llm.qualityScore
        ? "human"
        : human.qualityScore < llm.qualityScore
        ? "llm"
        : "equal",
    diffs: {
      securityScore: human.securityScore - llm.securityScore,
      qualityScore: human.qualityScore - llm.qualityScore,
      lines: human.lines - llm.lines,
      functions: human.functions - llm.functions,
      todoCount: human.todoCount - llm.todoCount,
    },
  };

  // A short summary text
  const summaryParts = [];
  if (compare.securityBetter === "human")
    summaryParts.push("Human code is more secure.");
  else if (compare.securityBetter === "llm")
    summaryParts.push("LLM code is more secure.");
  else summaryParts.push("Security scores are equal.");

  if (compare.qualityBetter === "human")
    summaryParts.push("Human code has better quality.");
  else if (compare.qualityBetter === "llm")
    summaryParts.push("LLM code has better quality.");
  else summaryParts.push("Quality scores are equal.");

  compare.summary = summaryParts.join(" ");

  return compare;
}

export async function analyzeCode(humanCode, llmCode) {
  try {
    if (typeof humanCode !== "string" || typeof llmCode !== "string") {
      throw new Error("humanCode and llmCode must be strings");
    }

    const id = uuidv4();
    const ts = new Date().toISOString();

    const humanMetrics = analyzeSample(humanCode);
    const llmMetrics = analyzeSample(llmCode);

    const comparison = compareMetrics(humanMetrics, llmMetrics);

    return {
      success: true,
      id,
      timestamp: ts,
      human: humanMetrics,
      llm: llmMetrics,
      comparison,
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}
