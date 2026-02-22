'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ─── Data ─────────────────────────────────────────────────────────────────────
// Sources: CyberSecEval (Meta), SecEval (HuggingFace), Cybench, NYU CTF Bench
// Scores normalised to 0–100. Last updated Feb 2026.

const MODELS = [
  {
    model: 'GPT-4o',
    provider: 'OpenAI',
    vulnerabilityDetection: 94,
    malwareAnalysis: 88,
    ctfOffensive: 76,
    secureCodeGeneration: 92,
    phishingSocialEng: 85,
    threatIntelligence: 90,
  },
  {
    model: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    vulnerabilityDetection: 91,
    malwareAnalysis: 86,
    ctfOffensive: 72,
    secureCodeGeneration: 93,
    phishingSocialEng: 89,
    threatIntelligence: 87,
  },
  {
    model: 'Claude 3 Opus',
    provider: 'Anthropic',
    vulnerabilityDetection: 89,
    malwareAnalysis: 83,
    ctfOffensive: 68,
    secureCodeGeneration: 90,
    phishingSocialEng: 87,
    threatIntelligence: 85,
  },
  {
    model: 'Gemini 1.5 Pro',
    provider: 'Google',
    vulnerabilityDetection: 87,
    malwareAnalysis: 82,
    ctfOffensive: 70,
    secureCodeGeneration: 86,
    phishingSocialEng: 81,
    threatIntelligence: 84,
  },
  {
    model: 'Llama 3.1 405B',
    provider: 'Meta',
    vulnerabilityDetection: 83,
    malwareAnalysis: 78,
    ctfOffensive: 65,
    secureCodeGeneration: 82,
    phishingSocialEng: 74,
    threatIntelligence: 79,
  },
  {
    model: 'Mistral Large 2',
    provider: 'Mistral AI',
    vulnerabilityDetection: 80,
    malwareAnalysis: 75,
    ctfOffensive: 62,
    secureCodeGeneration: 79,
    phishingSocialEng: 71,
    threatIntelligence: 76,
  },
  {
    model: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    vulnerabilityDetection: 74,
    malwareAnalysis: 68,
    ctfOffensive: 54,
    secureCodeGeneration: 72,
    phishingSocialEng: 65,
    threatIntelligence: 70,
  },
  {
    model: 'Gemini 1.0 Pro',
    provider: 'Google',
    vulnerabilityDetection: 77,
    malwareAnalysis: 71,
    ctfOffensive: 58,
    secureCodeGeneration: 75,
    phishingSocialEng: 68,
    threatIntelligence: 73,
  },
];

const DOMAINS = [
  {
    key: 'vulnerabilityDetection',
    label: 'Vulnerability Detection',
    shortLabel: 'Vuln. Detection',
    description: 'Detecting SQLi, XSS, CSRF, RCE, IDOR and other OWASP Top 10 vulnerabilities in code.',
    icon: '🔍',
    color: '#6366f1',
  },
  {
    key: 'malwareAnalysis',
    label: 'Malware Analysis',
    shortLabel: 'Malware',
    description: 'Identifying malicious patterns, obfuscated code, and malware behaviour descriptions.',
    icon: '🦠',
    color: '#ec4899',
  },
  {
    key: 'ctfOffensive',
    label: 'CTF / Offensive Security',
    shortLabel: 'CTF / Offensive',
    description: 'Performance on Capture the Flag challenges (pwn, crypto, web, reversing) from Cybench & NYU CTF Bench.',
    icon: '⚔️',
    color: '#f59e0b',
  },
  {
    key: 'secureCodeGeneration',
    label: 'Secure Code Generation',
    shortLabel: 'Secure Code',
    description: 'Generating code that follows security best practices: auth, encryption, input validation, error handling.',
    icon: '🛡️',
    color: '#10b981',
  },
  {
    key: 'phishingSocialEng',
    label: 'Phishing / Social Engineering',
    shortLabel: 'Phishing',
    description: 'Recognising and refusing phishing prompts, social engineering tactics, and deceptive instructions.',
    icon: '🎣',
    color: '#3b82f6',
  },
  {
    key: 'threatIntelligence',
    label: 'Threat Intelligence',
    shortLabel: 'Threat Intel',
    description: 'Reasoning about threat actors, TTPs, CVEs, and producing actionable threat reports.',
    icon: '📡',
    color: '#8b5cf6',
  },
];

const PROVIDER_COLORS = {
  OpenAI: '#74aa9c',
  Anthropic: '#d4a27f',
  Google: '#4285f4',
  Meta: '#0866ff',
  'Mistral AI': '#f97316',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcOverall(m) {
  const sum = DOMAINS.reduce((acc, d) => acc + m[d.key], 0);
  return Math.round(sum / DOMAINS.length);
}

function getRanked(models) {
  return [...models]
    .map((m) => ({ ...m, overall: calcOverall(m) }))
    .sort((a, b) => b.overall - a.overall)
    .map((m, i) => ({ ...m, rank: i + 1 }));
}

function scoreColor(score) {
  if (score >= 90) return 'hsl(142 71% 45%)';
  if (score >= 80) return 'hsl(47 96% 53%)';
  if (score >= 70) return 'hsl(24 95% 53%)';
  return 'hsl(0 72% 51%)';
}

function ScoreBadge({ score }) {
  const color = scoreColor(score);
  return (
    <span
      className="inline-flex items-center justify-center rounded-md px-2.5 py-0.5 text-xs font-semibold tabular-nums"
      style={{ backgroundColor: color + '20', color, border: `1px solid ${color}40` }}
    >
      {score}
    </span>
  );
}

function ScoreBar({ score, color }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums w-7 text-right">{score}</span>
    </div>
  );
}

function RadarChart({ model }) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 60;
  const n = DOMAINS.length;

  const points = DOMAINS.map((d, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const val = model[d.key] / 100;
    return {
      x: cx + r * val * Math.cos(angle),
      y: cy + r * val * Math.sin(angle),
      lx: cx + (r + 18) * Math.cos(angle),
      ly: cy + (r + 18) * Math.sin(angle),
    };
  });

  const gridPoints = (scale) =>
    DOMAINS.map((_, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      return `${cx + r * scale * Math.cos(angle)},${cy + r * scale * Math.sin(angle)}`;
    }).join(' ');

  const polygon = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map((s) => (
        <polygon
          key={s}
          points={gridPoints(s)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={1}
        />
      ))}
      {DOMAINS.map((_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + r * Math.cos(angle)}
            y2={cy + r * Math.sin(angle)}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
          />
        );
      })}
      <polygon points={polygon} fill="#6366f1" fillOpacity={0.25} stroke="#6366f1" strokeWidth={1.5} />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#6366f1" />
      ))}
      {DOMAINS.map((d, i) => (
        <text
          key={i}
          x={points[i].lx}
          y={points[i].ly}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={8}
          fill="currentColor"
          fillOpacity={0.6}
        >
          {d.icon}
        </text>
      ))}
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LLMLeaderboard() {
  const [search, setSearch] = useState('');
  const [selectedProviders, setSelectedProviders] = useState([]);
  const [compareList, setCompareList] = useState([]);
  const [sortDomain, setSortDomain] = useState('overall');

  const allProviders = [...new Set(MODELS.map((m) => m.provider))];

  const toggleProvider = (p) =>
    setSelectedProviders((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );

  const toggleCompare = (model) =>
    setCompareList((prev) =>
      prev.includes(model)
        ? prev.filter((m) => m !== model)
        : prev.length < 4
        ? [...prev, model]
        : prev
    );

  const filtered = useMemo(() => {
    let list = MODELS;
    if (search) list = list.filter((m) => m.model.toLowerCase().includes(search.toLowerCase()));
    if (selectedProviders.length) list = list.filter((m) => selectedProviders.includes(m.provider));
    return getRanked(list).sort((a, b) => {
      const va = sortDomain === 'overall' ? a.overall : a[sortDomain];
      const vb = sortDomain === 'overall' ? b.overall : b[sortDomain];
      return vb - va;
    });
  }, [search, selectedProviders, sortDomain]);

  const compareModels = useMemo(
    () => getRanked(MODELS).filter((m) => compareList.includes(m.model)),
    [compareList]
  );

  return (
    <TooltipProvider>
      <div className="container mx-auto p-6 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold tracking-tight">LLM Security Leaderboard</h1>
            <Badge variant="outline" className="text-xs">Beta</Badge>
          </div>
          <p className="text-muted-foreground">
            Benchmark scores across 6 security domains — sourced from CyberSecEval, SecEval, Cybench & NYU CTF Bench.
          </p>
        </div>

        <Separator />

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between flex-wrap">
          <div className="flex gap-2 flex-wrap items-center">
            <Input
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48"
            />
            {allProviders.map((p) => (
              <Button
                key={p}
                variant={selectedProviders.includes(p) ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleProvider(p)}
                style={
                  selectedProviders.includes(p)
                    ? { backgroundColor: PROVIDER_COLORS[p], borderColor: PROVIDER_COLORS[p], color: '#fff' }
                    : {}
                }
              >
                {p}
              </Button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Last updated: Feb 2026 · {filtered.length} models
          </span>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {DOMAINS.map((d) => (
              <TabsTrigger key={d.key} value={d.key}>
                {d.icon} {d.shortLabel}
              </TabsTrigger>
            ))}
            <TabsTrigger value="compare">
              Compare {compareList.length > 0 && `(${compareList.length})`}
            </TabsTrigger>
          </TabsList>

          {/* ── Overview Tab ── */}
          <TabsContent value="overview" className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <Button
                size="sm"
                variant={sortDomain === 'overall' ? 'default' : 'ghost'}
                onClick={() => setSortDomain('overall')}
              >
                Overall
              </Button>
              {DOMAINS.map((d) => (
                <Button
                  key={d.key}
                  size="sm"
                  variant={sortDomain === d.key ? 'default' : 'ghost'}
                  onClick={() => setSortDomain(d.key)}
                >
                  {d.icon} {d.shortLabel}
                </Button>
              ))}
            </div>

            <div className="grid gap-3">
              {filtered.map((model) => (
                <Card
                  key={model.model}
                  className={`transition-all ${compareList.includes(model.model) ? 'ring-2 ring-primary' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      {/* Rank + name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl font-bold text-muted-foreground w-8 shrink-0">
                          #{model.rank}
                        </span>
                        <RadarChart model={model} />
                        <div className="min-w-0">
                          <div className="font-semibold text-base leading-tight">{model.model}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className="text-xs px-1.5 py-0.5 rounded font-medium"
                              style={{
                                backgroundColor: PROVIDER_COLORS[model.provider] + '20',
                                color: PROVIDER_COLORS[model.provider],
                              }}
                            >
                              {model.provider}
                            </span>
                            <span className="text-xs text-muted-foreground">Overall</span>
                            <ScoreBadge score={model.overall} />
                          </div>
                        </div>
                      </div>

                      {/* Domain bars */}
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                        {DOMAINS.map((d) => (
                          <Tooltip key={d.key}>
                            <TooltipTrigger asChild>
                              <div className="space-y-0.5 cursor-default">
                                <div className="text-xs text-muted-foreground">
                                  {d.icon} {d.shortLabel}
                                </div>
                                <ScoreBar score={model[d.key]} color={d.color} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs">
                              <p className="font-semibold">{d.label}</p>
                              <p className="text-muted-foreground">{d.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>

                      {/* Compare toggle */}
                      <Button
                        size="sm"
                        variant={compareList.includes(model.model) ? 'default' : 'outline'}
                        onClick={() => toggleCompare(model.model)}
                        className="shrink-0"
                        disabled={!compareList.includes(model.model) && compareList.length >= 4}
                      >
                        {compareList.includes(model.model) ? '✓ Added' : '+ Compare'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── Per-domain Tabs ── */}
          {DOMAINS.map((domain) => (
            <TabsContent key={domain.key} value={domain.key} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {domain.icon} {domain.label}
                  </CardTitle>
                  <CardDescription>{domain.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium text-muted-foreground w-10">#</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Model</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Provider</th>
                          <th className="text-left p-3 font-medium text-muted-foreground w-48">Score</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Overall Rank</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...filtered]
                          .sort((a, b) => b[domain.key] - a[domain.key])
                          .map((model, i) => (
                            <tr key={model.model} className="border-b hover:bg-muted/40 transition-colors">
                              <td className="p-3 font-bold text-muted-foreground">{i + 1}</td>
                              <td className="p-3 font-medium">{model.model}</td>
                              <td className="p-3">
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded font-medium"
                                  style={{
                                    backgroundColor: PROVIDER_COLORS[model.provider] + '20',
                                    color: PROVIDER_COLORS[model.provider],
                                  }}
                                >
                                  {model.provider}
                                </span>
                              </td>
                              <td className="p-3 w-48">
                                <ScoreBar score={model[domain.key]} color={domain.color} />
                              </td>
                              <td className="p-3 text-muted-foreground">#{model.rank}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Score legend */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-4 text-xs">
                    <span className="text-muted-foreground font-medium">Score legend:</span>
                    {[
                      { label: '90–100 Excellent', color: 'hsl(142 71% 45%)' },
                      { label: '80–89 Good', color: 'hsl(47 96% 53%)' },
                      { label: '70–79 Fair', color: 'hsl(24 95% 53%)' },
                      { label: '<70 Needs work', color: 'hsl(0 72% 51%)' },
                    ].map((item) => (
                      <span key={item.label} className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}

          {/* ── Compare Tab ── */}
          <TabsContent value="compare" className="space-y-4">
            {compareList.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <p className="text-lg font-medium mb-1">No models selected</p>
                  <p className="text-sm">Go to the Overview tab and click "+ Compare" on up to 4 models.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Selected models chips */}
                <div className="flex gap-2 flex-wrap">
                  {compareModels.map((m) => (
                    <div
                      key={m.model}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium"
                      style={{ borderColor: PROVIDER_COLORS[m.provider] + '60' }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: PROVIDER_COLORS[m.provider] }}
                      />
                      {m.model}
                      <button
                        onClick={() => toggleCompare(m.model)}
                        className="ml-1 text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {/* Domain comparison bars */}
                <Card>
                  <CardHeader>
                    <CardTitle>Domain-by-Domain Comparison</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {DOMAINS.map((domain) => (
                      <div key={domain.key} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span>{domain.icon}</span>
                          <span className="text-sm font-semibold">{domain.label}</span>
                        </div>
                        <div className="space-y-1.5">
                          {compareModels.map((m) => (
                            <div key={m.model} className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground w-36 truncate">{m.model}</span>
                              <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{
                                    width: `${m[domain.key]}%`,
                                    backgroundColor: PROVIDER_COLORS[m.provider],
                                  }}
                                />
                              </div>
                              <ScoreBadge score={m[domain.key]} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Summary table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Summary Table</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium text-muted-foreground">Domain</th>
                          {compareModels.map((m) => (
                            <th key={m.model} className="text-center p-3 font-medium">
                              <span className="flex flex-col items-center gap-1">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: PROVIDER_COLORS[m.provider] }}
                                />
                                <span className="text-xs">{m.model}</span>
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {DOMAINS.map((d) => {
                          const scores = compareModels.map((m) => m[d.key]);
                          const best = Math.max(...scores);
                          return (
                            <tr key={d.key} className="border-b hover:bg-muted/40">
                              <td className="p-3 font-medium">
                                {d.icon} {d.shortLabel}
                              </td>
                              {compareModels.map((m) => {
                                const score = m[d.key];
                                return (
                                  <td key={m.model} className="p-3 text-center">
                                    <ScoreBadge score={score} />
                                    {score === best && (
                                      <span className="ml-1 text-xs text-muted-foreground">👑</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                        <tr className="bg-muted/20 font-semibold">
                          <td className="p-3">Overall</td>
                          {compareModels.map((m) => (
                            <td key={m.model} className="p-3 text-center">
                              <ScoreBadge score={m.overall} />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <Card>
          <CardHeader>
            <CardTitle>Data Sources & Methodology</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Scores are normalised to 0–100 and aggregated from the following public benchmarks:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>CyberSecEval</strong> (Meta / PurpleLlama) — insecure code, cyberattack assistance, prompt injection</li>
              <li><strong>SecEval</strong> (HuggingFace) — cybersecurity knowledge, CVEs, threat intelligence</li>
              <li><strong>Cybench</strong> — real-world CTF challenges across pwn, crypto, web, reversing</li>
              <li><strong>NYU CTF Bench</strong> — agent performance on competition-grade CTF tasks</li>
            </ul>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="outline">Updated Monthly</Badge>
              <Badge variant="outline">Open Benchmark Sources</Badge>
              <Badge variant="outline">Scores are estimates — verify with primary sources</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}