"use client";

import { useState, useCallback, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────
type TestCase = {
  id: string;
  name: string;
  category: string;
  task: string;
  provider: string;
  model: string;
  metrics: string[];
};

type TestResult = {
  test_id: string;
  test_name: string;
  category: string;
  task: string;
  provider: string;
  model: string;
  latency_ms: number;
  response_length: number;
  json_valid: boolean | null;
  deterministic: { name: string; pass: boolean; detail: string }[];
  judge: {
    scores?: Record<string, number>;
    overall?: number;
    pass?: boolean;
    strengths?: string;
    weaknesses?: string;
    failure_mode?: string;
    error?: string;
  } | null;
  error: string | null;
  response_preview: string;
};

type Stats = {
  total_tests: number;
  completed: number;
  errors: number;
  pass_rate: number;
  metric_averages: Record<string, number>;
  category_breakdown: Record<string, { total: number; passed: number }>;
  failure_modes: Record<string, number>;
  avg_latency_ms: number;
  json_valid_rate: number | null;
};

type Tab = "overview" | "results" | "ab" | "edge";

// ── Colors ─────────────────────────────────────────────────────
const C = {
  bg: "var(--bg)",
  surface: "var(--surface)",
  surface2: "var(--surface-alt)",
  border: "var(--border)",
  text: "var(--text-primary)",
  muted: "var(--text-muted)",
  accent: "var(--accent)",
  accentDim: "var(--accent-soft)",
  green: "var(--green)",
  greenDim: "var(--green-soft)",
  red: "#dc2626",
  redDim: "rgba(220,38,38,0.06)",
  amber: "var(--amber)",
  amberDim: "var(--amber-soft)",
  cyan: "var(--accent)",
};

// ── Helpers ────────────────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 4) return C.green;
  if (score >= 3) return C.amber;
  return C.red;
}
function scoreBg(score: number) {
  if (score >= 4) return C.greenDim;
  if (score >= 3) return C.amberDim;
  return C.redDim;
}

// ── Main component ─────────────────────────────────────────────
export default function EvalDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [tests, setTests] = useState<TestCase[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const abortRef = useRef(false);

  // Load test suite
  const loadTests = useCallback(async () => {
    const res = await fetch("/api/eval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list" }),
    });
    const data = await res.json();
    if (data.ok) {
      setTests(data.tests);
      setSelectedIds(new Set(data.tests.map((t: TestCase) => t.id)));
    }
  }, []);

  // Run tests one by one for live progress
  const runTests = useCallback(async () => {
    if (tests.length === 0) await loadTests();

    const idsToRun = Array.from(selectedIds);
    if (idsToRun.length === 0) return;

    setRunning(true);
    setResults([]);
    setStats(null);
    setProgress({ done: 0, total: idsToRun.length });
    abortRef.current = false;

    const allResults: TestResult[] = [];

    // Run in batches of 2 to avoid overloading
    for (let i = 0; i < idsToRun.length; i += 2) {
      if (abortRef.current) break;
      const batch = idsToRun.slice(i, i + 2);
      const res = await fetch("/api/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", ids: batch }),
      });
      const data = await res.json();
      if (data.ok) {
        allResults.push(...data.results);
        setResults([...allResults]);
        setProgress({ done: allResults.length, total: idsToRun.length });
      }
    }

    // Compute final stats from all results
    if (!abortRef.current) {
      const res = await fetch("/api/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", ids: idsToRun }),
      });
      // We already have results, just recompute stats client-side
      setStats(computeClientStats(allResults));
    }

    setRunning(false);
  }, [tests, selectedIds, loadTests]);

  // Client-side stats computation (mirrors server)
  function computeClientStats(res: TestResult[]): Stats {
    const completed = res.filter((r) => !r.error);
    const withJudge = completed.filter((r) => r.judge?.scores);

    const metricTotals: Record<string, { sum: number; count: number }> = {};
    for (const r of withJudge) {
      for (const [m, s] of Object.entries(r.judge!.scores!)) {
        if (!metricTotals[m]) metricTotals[m] = { sum: 0, count: 0 };
        metricTotals[m].sum += s;
        metricTotals[m].count += 1;
      }
    }
    const metricAverages: Record<string, number> = {};
    for (const [m, t] of Object.entries(metricTotals)) {
      metricAverages[m] = Math.round((t.sum / t.count) * 100) / 100;
    }

    const categories: Record<string, { total: number; passed: number }> = {};
    for (const r of withJudge) {
      if (!categories[r.category]) categories[r.category] = { total: 0, passed: 0 };
      categories[r.category].total += 1;
      if (r.judge!.pass) categories[r.category].passed += 1;
    }

    const failureModes: Record<string, number> = {};
    for (const r of withJudge) {
      const fm = r.judge!.failure_mode ?? "none";
      failureModes[fm] = (failureModes[fm] ?? 0) + 1;
    }

    const latencies = completed.map((r) => r.latency_ms);
    const jsonTests = res.filter((r) => r.json_valid !== null);

    return {
      total_tests: res.length,
      completed: completed.length,
      errors: res.length - completed.length,
      pass_rate: withJudge.length
        ? Math.round((withJudge.filter((r) => r.judge!.pass).length / withJudge.length) * 100)
        : 0,
      metric_averages: metricAverages,
      category_breakdown: categories,
      failure_modes: failureModes,
      avg_latency_ms: latencies.length
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0,
      json_valid_rate: jsonTests.length
        ? jsonTests.filter((r) => r.json_valid).length / jsonTests.length
        : null,
    };
  }

  // Load tests on first render
  if (tests.length === 0 && !running) {
    loadTests();
  }

  // ── Render ────────────────────────────────────────────────────
  const abResults = results.filter((r) => r.category === "ab_compare");
  const edgeResults = results.filter(
    (r) => r.category === "edge_case" || r.category === "adversarial"
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        borderBottom: `1px solid ${C.border}`,
        background: C.surface,
        padding: "20px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${C.accent}, #7c3aed)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 800, color: "#fff",
          }}>E</div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
              CoFounder Connection — LLM Evaluation Suite
            </h1>
            <p style={{ fontSize: 11, color: C.muted, margin: 0, marginTop: 2 }}>
              Accuracy · Relevance · Coherence · Faithfulness · A/B Testing
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {running && (
            <span style={{ fontSize: 12, color: C.cyan }}>
              Running {progress.done}/{progress.total}...
            </span>
          )}
          <button
            onClick={() => { if (running) { abortRef.current = true; setRunning(false); } else runTests(); }}
            style={{
              padding: "8px 20px", borderRadius: 10, border: "none",
              background: running ? C.redDim : `linear-gradient(135deg, ${C.accent}, #7c3aed)`,
              color: running ? C.red : "#fff",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: running ? "none" : `0 2px 16px rgba(99,102,241,0.3)`,
            }}
          >
            {running ? "Stop" : "Run Evaluation Suite"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 2, padding: "0 32px", marginTop: 16,
        borderBottom: `1px solid ${C.border}`,
      }}>
        {([
          { key: "overview", label: "Overview" },
          { key: "results", label: `All Results (${results.length})` },
          { key: "ab", label: "A/B Comparison" },
          { key: "edge", label: "Edge Cases & Adversarial" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 18px",
              border: "none",
              borderBottom: tab === t.key ? `2px solid ${C.accent}` : "2px solid transparent",
              background: "transparent",
              color: tab === t.key ? C.text : C.muted,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "24px 32px", maxWidth: 1200 }}>
        {tab === "overview" && <OverviewTab stats={stats} results={results} running={running} progress={progress} />}
        {tab === "results" && <ResultsTab results={results} selected={selectedResult} onSelect={setSelectedResult} />}
        {tab === "ab" && <ABTab results={abResults} />}
        {tab === "edge" && <EdgeTab results={edgeResults} />}
      </div>

      {/* Detail modal */}
      {selectedResult && (
        <DetailModal result={selectedResult} onClose={() => setSelectedResult(null)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Overview Tab
// ═══════════════════════════════════════════════════════════════
function OverviewTab({ stats, results, running, progress }: {
  stats: Stats | null;
  results: TestResult[];
  running: boolean;
  progress: { done: number; total: number };
}) {
  if (!stats && results.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 80, color: C.muted }}>
        <p style={{ fontSize: 15, marginBottom: 8 }}>No evaluation data yet.</p>
        <p style={{ fontSize: 12 }}>Click "Run Evaluation Suite" to test all AI endpoints with LLM-as-a-judge scoring.</p>
      </div>
    );
  }

  // Build live stats from results if final stats not ready
  const s = stats ?? buildLiveStats(results);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Progress bar */}
      {running && (
        <div style={{ background: C.surface, borderRadius: 8, overflow: "hidden", height: 4 }}>
          <div style={{
            height: "100%",
            width: `${(progress.done / Math.max(progress.total, 1)) * 100}%`,
            background: `linear-gradient(90deg, ${C.accent}, ${C.cyan})`,
            transition: "width 0.3s ease",
          }} />
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <KPICard label="Pass Rate" value={`${s.pass_rate}%`} color={s.pass_rate >= 80 ? C.green : s.pass_rate >= 60 ? C.amber : C.red} />
        <KPICard label="Tests Run" value={`${s.completed}/${s.total_tests}`} color={C.accent} />
        <KPICard label="Avg Latency" value={`${s.avg_latency_ms}ms`} color={C.cyan} />
        <KPICard label="Errors" value={String(s.errors)} color={s.errors > 0 ? C.red : C.green} />
        {s.json_valid_rate !== null && (
          <KPICard label="JSON Valid Rate" value={`${Math.round(s.json_valid_rate * 100)}%`} color={s.json_valid_rate >= 0.9 ? C.green : C.red} />
        )}
      </div>

      {/* Metric averages */}
      {Object.keys(s.metric_averages).length > 0 && (
        <Card title="Metric Averages (LLM-as-Judge, 1-5 scale)">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {Object.entries(s.metric_averages).map(([metric, avg]) => (
              <div key={metric} style={{
                flex: "1 1 140px",
                background: scoreBg(avg),
                border: `1px solid ${scoreColor(avg)}33`,
                borderRadius: 10, padding: "12px 16px",
              }}>
                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                  {metric.replace(/_/g, " ")}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(avg) }}>
                  {avg.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Category breakdown */}
      {Object.keys(s.category_breakdown).length > 0 && (
        <Card title="Pass Rate by Category">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(s.category_breakdown).map(([cat, { total, passed }]) => {
              const rate = Math.round((passed / total) * 100);
              return (
                <div key={cat} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 120, fontSize: 12, color: C.muted }}>{cat}</div>
                  <div style={{ flex: 1, height: 8, background: C.surface2, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 4,
                      width: `${rate}%`,
                      background: rate >= 80 ? C.green : rate >= 60 ? C.amber : C.red,
                    }} />
                  </div>
                  <div style={{ width: 60, fontSize: 12, fontWeight: 700, color: scoreColor(rate / 20), textAlign: "right" }}>
                    {passed}/{total} ({rate}%)
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Failure modes */}
      {Object.keys(s.failure_modes).length > 0 && (
        <Card title="Failure Mode Distribution">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(s.failure_modes).map(([mode, count]) => (
              <div key={mode} style={{
                padding: "6px 14px", borderRadius: 8,
                background: mode === "none" ? C.greenDim : C.redDim,
                border: `1px solid ${mode === "none" ? C.green : C.red}33`,
                fontSize: 12, fontWeight: 600,
                color: mode === "none" ? C.green : C.red,
              }}>
                {mode}: {count}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Results Tab
// ═══════════════════════════════════════════════════════════════
function ResultsTab({ results, selected, onSelect }: {
  results: TestResult[];
  selected: TestResult | null;
  onSelect: (r: TestResult) => void;
}) {
  if (results.length === 0) {
    return <div style={{ color: C.muted, padding: 40, textAlign: "center" }}>Run the evaluation suite to see results here.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Header row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr 1fr 80px 60px 60px",
        gap: 8, padding: "8px 16px",
        fontSize: 10, fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: C.muted,
      }}>
        <span>Test</span>
        <span>Provider / Model</span>
        <span>Task</span>
        <span>Latency</span>
        <span>Score</span>
        <span>Pass</span>
      </div>

      {results.map((r) => (
        <div
          key={r.test_id}
          onClick={() => onSelect(r)}
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 80px 60px 60px",
            gap: 8, padding: "12px 16px",
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            cursor: "pointer",
            transition: "border-color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.accent + "66")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{r.test_name}</div>
            <div style={{ fontSize: 10, color: C.muted }}>{r.category}</div>
          </div>
          <div style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center" }}>
            {r.provider} / {r.model.split("-").slice(-2).join("-")}
          </div>
          <div style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center" }}>
            {r.task}
          </div>
          <div style={{ fontSize: 12, display: "flex", alignItems: "center", color: C.cyan }}>
            {r.latency_ms}ms
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            {r.judge?.overall != null ? (
              <span style={{
                fontSize: 14, fontWeight: 800,
                color: scoreColor(r.judge.overall),
              }}>
                {r.judge.overall}
              </span>
            ) : r.error ? (
              <span style={{ fontSize: 10, color: C.red }}>ERR</span>
            ) : (
              <span style={{ fontSize: 10, color: C.muted }}>---</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            {r.judge?.pass != null ? (
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: "2px 8px", borderRadius: 6,
                background: r.judge.pass ? C.greenDim : C.redDim,
                color: r.judge.pass ? C.green : C.red,
              }}>
                {r.judge.pass ? "PASS" : "FAIL"}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// A/B Comparison Tab
// ═══════════════════════════════════════════════════════════════
function ABTab({ results }: { results: TestResult[] }) {
  if (results.length === 0) {
    return <div style={{ color: C.muted, padding: 40, textAlign: "center" }}>Run the suite to see A/B comparison data.</div>;
  }

  // Group by task
  const groups: Record<string, TestResult[]> = {};
  for (const r of results) {
    if (!groups[r.task]) groups[r.task] = [];
    groups[r.task].push(r);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {Object.entries(groups).map(([task, pair]) => (
        <Card key={task} title={`A/B: ${task}`}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {pair.map((r) => (
              <div key={r.test_id} style={{
                background: C.surface2, borderRadius: 10, padding: 16,
                border: `1px solid ${C.border}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>{r.provider}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{r.model}</div>
                  </div>
                  {r.judge?.overall != null && (
                    <div style={{
                      fontSize: 24, fontWeight: 800,
                      color: scoreColor(r.judge.overall),
                    }}>
                      {r.judge.overall}
                    </div>
                  )}
                </div>

                {/* Per-metric bars */}
                {r.judge?.scores && Object.entries(r.judge.scores).map(([metric, score]) => (
                  <div key={metric} style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted, marginBottom: 2 }}>
                      <span>{metric.replace(/_/g, " ")}</span>
                      <span style={{ color: scoreColor(score), fontWeight: 700 }}>{score}/5</span>
                    </div>
                    <div style={{ height: 4, background: C.bg, borderRadius: 2 }}>
                      <div style={{
                        height: "100%", borderRadius: 2,
                        width: `${(score / 5) * 100}%`,
                        background: scoreColor(score),
                      }} />
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 10, fontSize: 11, color: C.muted }}>
                  <div>Latency: <span style={{ color: C.cyan }}>{r.latency_ms}ms</span></div>
                  {r.judge?.strengths && <div style={{ marginTop: 4, color: C.green }}>+ {r.judge.strengths}</div>}
                  {r.judge?.weaknesses && <div style={{ marginTop: 2, color: C.red }}>- {r.judge.weaknesses}</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Edge Cases & Adversarial Tab
// ═══════════════════════════════════════════════════════════════
function EdgeTab({ results }: { results: TestResult[] }) {
  if (results.length === 0) {
    return <div style={{ color: C.muted, padding: 40, textAlign: "center" }}>Run the suite to see edge case and adversarial results.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {results.map((r) => (
        <Card key={r.test_id} title="">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                  background: r.category === "adversarial" ? C.redDim : C.amberDim,
                  color: r.category === "adversarial" ? C.red : C.amber,
                  textTransform: "uppercase",
                }}>
                  {r.category}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{r.test_name}</span>
              </div>

              {/* Deterministic checks */}
              {r.deterministic.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {r.deterministic.map((ch, i) => (
                    <span key={i} style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 6,
                      background: ch.pass ? C.greenDim : C.redDim,
                      color: ch.pass ? C.green : C.red,
                      fontWeight: 600,
                    }}>
                      {ch.pass ? "✓" : "✗"} {ch.name} — {ch.detail}
                    </span>
                  ))}
                </div>
              )}

              {/* Judge feedback */}
              {r.judge?.failure_mode && r.judge.failure_mode !== "none" && (
                <div style={{ fontSize: 11, color: C.red, marginBottom: 4 }}>
                  Failure mode: {r.judge.failure_mode}
                </div>
              )}
              {r.judge?.weaknesses && (
                <div style={{ fontSize: 11, color: C.muted }}>{r.judge.weaknesses}</div>
              )}

              {/* Response preview */}
              <div style={{
                marginTop: 8, padding: 10, borderRadius: 8,
                background: C.bg, fontSize: 11, color: C.muted,
                maxHeight: 80, overflow: "auto",
                fontFamily: "'IBM Plex Mono', monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
                {r.response_preview || "(no response)"}
              </div>
            </div>

            {/* Score badge */}
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              {r.judge?.overall != null ? (
                <>
                  <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(r.judge.overall) }}>
                    {r.judge.overall}
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 700,
                    color: r.judge.pass ? C.green : C.red,
                  }}>
                    {r.judge.pass ? "PASS" : "FAIL"}
                  </div>
                </>
              ) : r.error ? (
                <div style={{ fontSize: 10, color: C.red }}>ERROR</div>
              ) : null}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Detail Modal
// ═══════════════════════════════════════════════════════════════
function DetailModal({ result: r, onClose }: { result: TestResult; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surface, borderRadius: 16,
          border: `1px solid ${C.border}`,
          padding: 28, maxWidth: 640, width: "100%",
          maxHeight: "80vh", overflow: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{r.test_name}</h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18 }}
          >
            ✕
          </button>
        </div>

        {/* Meta */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {[
            { l: "Task", v: r.task },
            { l: "Provider", v: r.provider },
            { l: "Model", v: r.model },
            { l: "Latency", v: `${r.latency_ms}ms` },
            { l: "Response Length", v: `${r.response_length} chars` },
            { l: "Category", v: r.category },
          ].map((item) => (
            <div key={item.l} style={{
              fontSize: 11, padding: "4px 10px",
              background: C.surface2, borderRadius: 6,
              border: `1px solid ${C.border}`,
            }}>
              <span style={{ color: C.muted }}>{item.l}: </span>
              <span style={{ color: C.text, fontWeight: 600 }}>{item.v}</span>
            </div>
          ))}
        </div>

        {/* Judge scores */}
        {r.judge?.scores && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              LLM-as-Judge Scores
            </div>
            {Object.entries(r.judge.scores).map(([metric, score]) => (
              <div key={metric} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 120, fontSize: 12, color: C.muted }}>{metric.replace(/_/g, " ")}</div>
                <div style={{ flex: 1, height: 6, background: C.bg, borderRadius: 3 }}>
                  <div style={{
                    height: "100%", borderRadius: 3,
                    width: `${(score / 5) * 100}%`,
                    background: scoreColor(score),
                  }} />
                </div>
                <div style={{ width: 30, fontSize: 13, fontWeight: 800, color: scoreColor(score), textAlign: "right" }}>
                  {score}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Judge commentary */}
        {r.judge?.strengths && (
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: C.green, fontWeight: 600 }}>Strengths: </span>
            <span style={{ color: C.muted }}>{r.judge.strengths}</span>
          </div>
        )}
        {r.judge?.weaknesses && (
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: C.red, fontWeight: 600 }}>Weaknesses: </span>
            <span style={{ color: C.muted }}>{r.judge.weaknesses}</span>
          </div>
        )}
        {r.judge?.failure_mode && r.judge.failure_mode !== "none" && (
          <div style={{ fontSize: 12, marginBottom: 12 }}>
            <span style={{ color: C.amber, fontWeight: 600 }}>Failure Mode: </span>
            <span style={{ color: C.muted }}>{r.judge.failure_mode}</span>
          </div>
        )}

        {/* Deterministic checks */}
        {r.deterministic.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Deterministic Checks
            </div>
            {r.deterministic.map((ch, i) => (
              <div key={i} style={{ fontSize: 12, marginBottom: 2 }}>
                <span style={{ color: ch.pass ? C.green : C.red, fontWeight: 700 }}>
                  {ch.pass ? "✓" : "✗"}
                </span>{" "}
                <span style={{ color: C.muted }}>{ch.name}: {ch.detail}</span>
              </div>
            ))}
          </div>
        )}

        {/* Full response */}
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          LLM Response Preview
        </div>
        <div style={{
          padding: 12, borderRadius: 8,
          background: C.bg, fontSize: 11, color: C.muted,
          fontFamily: "'IBM Plex Mono', monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: 200, overflow: "auto",
        }}>
          {r.response_preview || "(empty)"}
        </div>

        {r.error && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: C.redDim, fontSize: 12, color: C.red }}>
            Error: {r.error}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Shared UI components
// ═══════════════════════════════════════════════════════════════
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 14, padding: 20,
    }}>
      {title && (
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: C.text }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function KPICard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 12, padding: "16px 18px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

// ── Build live stats from incomplete results ───────────────────
function buildLiveStats(results: TestResult[]): Stats {
  const completed = results.filter((r) => !r.error);
  const withJudge = completed.filter((r) => r.judge?.scores);

  const metricTotals: Record<string, { sum: number; count: number }> = {};
  for (const r of withJudge) {
    for (const [m, s] of Object.entries(r.judge!.scores!)) {
      if (!metricTotals[m]) metricTotals[m] = { sum: 0, count: 0 };
      metricTotals[m].sum += s;
      metricTotals[m].count += 1;
    }
  }
  const metricAverages: Record<string, number> = {};
  for (const [m, t] of Object.entries(metricTotals)) {
    metricAverages[m] = Math.round((t.sum / t.count) * 100) / 100;
  }

  const categories: Record<string, { total: number; passed: number }> = {};
  for (const r of withJudge) {
    if (!categories[r.category]) categories[r.category] = { total: 0, passed: 0 };
    categories[r.category].total += 1;
    if (r.judge!.pass) categories[r.category].passed += 1;
  }

  const failureModes: Record<string, number> = {};
  for (const r of withJudge) {
    const fm = r.judge!.failure_mode ?? "none";
    failureModes[fm] = (failureModes[fm] ?? 0) + 1;
  }

  const latencies = completed.map((r) => r.latency_ms);
  const jsonTests = results.filter((r) => r.json_valid !== null);

  return {
    total_tests: results.length,
    completed: completed.length,
    errors: results.length - completed.length,
    pass_rate: withJudge.length
      ? Math.round((withJudge.filter((r) => r.judge!.pass).length / withJudge.length) * 100)
      : 0,
    metric_averages: metricAverages,
    category_breakdown: categories,
    failure_modes: failureModes,
    avg_latency_ms: latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0,
    json_valid_rate: jsonTests.length
      ? jsonTests.filter((r) => r.json_valid).length / jsonTests.length
      : null,
  };
}