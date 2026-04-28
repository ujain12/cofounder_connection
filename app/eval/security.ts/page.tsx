"use client";

import { useState, useCallback } from "react";

// ── Colors ─────────────────────────────────────────────────────
const C = {
  bg: "var(--bg)", surface: "var(--surface)", surface2: "var(--surface-alt)",
  border: "var(--border)", text: "var(--text-primary)", muted: "var(--text-muted)",
  accent: "var(--accent)", green: "var(--green)", greenDim: "var(--green-soft)",
  red: "#dc2626", redDim: "rgba(220,38,38,0.06)",
  amber: "var(--amber)", amberDim: "var(--amber-soft)",
  cyan: "var(--accent)", cyanDim: "var(--accent-soft)",
};

function scoreColor(s: number) { return s >= 4 ? C.green : s >= 3 ? C.amber : C.red; }

type Tab = "redteam" | "safeguards" | "keys" | "docs";

export default function SecurityDashboard() {
  const [tab, setTab] = useState<Tab>("redteam");
  const [results, setResults] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const runRedTeam = useCallback(async () => {
    setRunning(true);
    setResults([]);
    setSummary(null);
    try {
      const res = await fetch("/api/eval/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run" }),
      });
      const data = await res.json();
      if (data.ok) {
        setResults(data.results);
        setSummary(data.summary);
      }
    } catch (e) {
      console.error(e);
    }
    setRunning(false);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        borderBottom: `1px solid ${C.border}`, background: C.surface,
        padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${C.red}, ${C.amber})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 800, color: "#fff",
          }}>S</div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Security Evaluation Suite</h1>
            <p style={{ fontSize: 11, color: C.muted, margin: 0, marginTop: 2 }}>
              Red Teaming / Input Validation / Output Filtering / API Key Management
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/eval" style={{ fontSize: 12, color: C.accent, textDecoration: "none" }}>Back to LLM Eval</a>
          {tab === "redteam" && (
            <button
              onClick={runRedTeam}
              disabled={running}
              style={{
                padding: "8px 20px", borderRadius: 10, border: "none",
                background: running ? C.amberDim : `linear-gradient(135deg, ${C.red}, ${C.amber})`,
                color: running ? C.amber : "#fff",
                fontSize: 13, fontWeight: 700, cursor: running ? "not-allowed" : "pointer",
              }}
            >
              {running ? "Running..." : "Run Red Team Suite"}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "0 32px", marginTop: 16, borderBottom: `1px solid ${C.border}` }}>
        {([
          { key: "redteam", label: "Red Team Results" },
          { key: "safeguards", label: "Security Safeguards" },
          { key: "keys", label: "API Key Management" },
          { key: "docs", label: "Documentation" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 18px", border: "none",
              borderBottom: tab === t.key ? `2px solid ${C.red}` : "2px solid transparent",
              background: "transparent",
              color: tab === t.key ? C.text : C.muted,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 1200 }}>
        {tab === "redteam" && <RedTeamTab results={results} summary={summary} expanded={expanded} setExpanded={setExpanded} />}
        {tab === "safeguards" && <SafeguardsTab />}
        {tab === "keys" && <KeysTab />}
        {tab === "docs" && <DocsTab />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Red Team Tab
// ═══════════════════════════════════════════════════════════════
function RedTeamTab({ results, summary, expanded, setExpanded }: any) {
  if (results.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 80, color: C.muted }}>
        <p style={{ fontSize: 15, marginBottom: 8 }}>No red team results yet.</p>
        <p style={{ fontSize: 12 }}>Click "Run Red Team Suite" to test 15 attack vectors against your AI endpoints.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary cards */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <KPI label="Pass Rate" value={`${summary.pass_rate}%`} color={summary.pass_rate >= 80 ? C.green : C.red} />
          <KPI label="Tests" value={`${summary.passed}/${summary.total}`} color={C.accent} />
          <KPI label="Blocked by Sanitizer" value={String(summary.blocked_by_sanitizer)} color={C.cyan} />
          <KPI label="Inputs Flagged" value={String(summary.flagged_by_sanitizer)} color={C.amber} />
          <KPI label="Output Leaks" value={String(summary.output_leaks_caught)} color={summary.output_leaks_caught > 0 ? C.red : C.green} />
        </div>
      )}

      {/* Category breakdown */}
      {summary?.by_category && (
        <Card title="Pass Rate by Attack Category">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(summary.by_category as Record<string, { total: number; passed: number }>).map(([cat, { total, passed }]) => {
              const rate = Math.round((passed / total) * 100);
              return (
                <div key={cat} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 150, fontSize: 12, color: C.muted }}>{cat.replace(/_/g, " ")}</div>
                  <div style={{ flex: 1, height: 8, background: C.surface2, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 4, width: `${rate}%`, background: rate >= 80 ? C.green : rate >= 60 ? C.amber : C.red }} />
                  </div>
                  <div style={{ width: 80, fontSize: 12, fontWeight: 700, color: rate >= 80 ? C.green : C.red, textAlign: "right" }}>
                    {passed}/{total} ({rate}%)
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Individual results */}
      {results.map((r: any) => {
        const allPass = r.judge.pass && r.deterministic.every((d: any) => d.pass);
        const isExpanded = expanded === r.test_id;

        return (
          <div
            key={r.test_id}
            onClick={() => setExpanded(isExpanded ? null : r.test_id)}
            style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: 16, cursor: "pointer",
              transition: "border-color 0.15s",
            }}
          >
            {/* Header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                    background: r.category === "jailbreak" ? C.redDim : r.category === "data_leakage" ? C.amberDim : C.cyanDim,
                    color: r.category === "jailbreak" ? C.red : r.category === "data_leakage" ? C.amber : C.cyan,
                    textTransform: "uppercase",
                  }}>
                    {r.category.replace(/_/g, " ")}
                  </span>
                  {r.input_blocked && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: C.cyanDim, color: C.cyan }}>
                      BLOCKED BY SANITIZER
                    </span>
                  )}
                  {r.input_flagged && !r.input_blocked && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: C.amberDim, color: C.amber }}>
                      FLAGGED (risk: {r.input_risk_score})
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{r.test_name}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: scoreColor(r.judge.score) }}>{r.judge.score}</div>
                <div style={{
                  fontSize: 10, fontWeight: 700,
                  color: allPass ? C.green : C.red,
                }}>
                  {allPass ? "PASS" : "FAIL"}
                </div>
              </div>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div style={{ marginTop: 16, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                {/* Attack input */}
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Attack Input
                </div>
                <div style={{
                  padding: 10, borderRadius: 8, background: C.bg,
                  fontSize: 11, color: C.red, fontFamily: "'IBM Plex Mono', monospace",
                  whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 12, maxHeight: 100, overflow: "auto",
                }}>
                  {r.input_preview}
                </div>

                {/* Sanitizer flags */}
                {r.input_flags.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Sanitizer Flags
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {r.input_flags.map((f: string, i: number) => (
                        <span key={i} style={{
                          fontSize: 10, padding: "2px 8px", borderRadius: 6,
                          background: C.amberDim, color: C.amber, fontFamily: "monospace",
                        }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Deterministic checks */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Security Checks
                  </div>
                  {r.deterministic.map((d: any, i: number) => (
                    <div key={i} style={{ fontSize: 11, marginBottom: 2 }}>
                      <span style={{ color: d.pass ? C.green : C.red, fontWeight: 700 }}>{d.pass ? "PASS" : "FAIL"}</span>
                      {" "}<span style={{ color: C.muted }}>{d.name}: {d.detail}</span>
                    </div>
                  ))}
                </div>

                {/* Judge reasoning */}
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
                  <span style={{ fontWeight: 700 }}>Judge: </span>{r.judge.reasoning}
                </div>

                {/* Response preview */}
                {r.response_preview && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      AI Response
                    </div>
                    <div style={{
                      padding: 10, borderRadius: 8, background: C.bg,
                      fontSize: 11, color: C.muted, fontFamily: "'IBM Plex Mono', monospace",
                      whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 120, overflow: "auto",
                    }}>
                      {r.response_preview}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Safeguards Tab
// ═══════════════════════════════════════════════════════════════
function SafeguardsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="Input Validation (lib/security.ts)">
        <Section title="What it does">
          Every user input that enters an LLM prompt passes through the sanitizeInput function first. It checks against 25 regex patterns for known prompt injection phrases, 19 jailbreak phrases, HTML/script tag presence, base64 encoded content that could hide instructions, unicode tricks like zero width characters, and excessive special character ratios that indicate obfuscation. Each flag adds to a cumulative risk score. If the score hits 7 or above, the input is blocked entirely and the user gets a generic error message without revealing what triggered the block.
        </Section>
        <Section title="How it is wired up">
          Import runSecurityChecks from lib/security.ts at the top of any API route. Call it with the user ID, endpoint path, and raw input text before building the prompt. If check.allowed is false, return the error immediately. If allowed, use check.sanitized (which has HTML tags and unicode tricks stripped) instead of the raw input.
        </Section>
      </Card>

      <Card title="Output Filtering (lib/security.ts)">
        <Section title="What it does">
          After every LLM call, the response passes through filterOutput before being returned to the user. It scans for leaked API keys (Anthropic, OpenAI, Supabase, GitHub, Slack, AWS patterns), JWT tokens, database connection strings, environment variable references, and phrases that suggest the model revealed its system instructions. Any match gets replaced with [REDACTED] and the event gets logged.
        </Section>
        <Section title="How it is wired up">
          After getting the LLM response text, call filterLLMOutput with the user ID, endpoint, and response string. Use result.filtered as the text you return to the user instead of the raw LLM output.
        </Section>
      </Card>

      <Card title="Rate Limiting (lib/security.ts)">
        <Section title="What it does">
          Each endpoint has a configured request limit per 60 second window. The AI chatbot allows 20 requests per minute. The search agent allows 10 (since it makes multiple LLM calls internally). The eval endpoint allows 5 (since it is expensive). Limits are tracked per user per endpoint using an in memory sliding window. When exceeded, the user gets a message telling them how many seconds to wait.
        </Section>
        <Section title="Limits by endpoint">
          /api/ai: 20 per minute. /api/search-agent: 10 per minute. /api/checkins: 15 per minute. /api/multimodal: 10 per minute. /api/eval: 5 per minute. All others: 30 per minute.
        </Section>
      </Card>

      <Card title="Security Event Logging">
        <Section title="What it does">
          Every security event (injection attempt, jailbreak attempt, rate limit hit, output leak, blocked input) gets logged with a timestamp, user ID, endpoint, event type, details, and risk score. The log keeps the last 200 events in memory and also writes to console.warn for server side log collection. This creates an audit trail for monitoring attack patterns.
        </Section>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// API Key Management Tab
// ═══════════════════════════════════════════════════════════════
function KeysTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="API Key Storage">
        <Section title="Current practice">
          All API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, HF_API_TOKEN, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) are stored in .env.local which is gitignored. They are never committed to version control. The .gitignore file includes .env, .env.local, .env.production, and .env*.local patterns.
        </Section>
        <Section title="Server side only access">
          API keys for LLM providers (Anthropic, OpenAI, HuggingFace) are only accessed in server side API routes under app/api/. They are never exposed to the client. The only keys with the NEXT_PUBLIC_ prefix are the Supabase URL and anon key, which are designed to be public facing (Supabase Row Level Security handles authorization).
        </Section>
      </Card>

      <Card title="Key Rotation and Access Control">
        <Section title="Rotation">
          API keys should be rotated on a regular schedule, at minimum every 90 days, and immediately if any key is suspected of being compromised. The current setup supports instant rotation by updating .env.local and restarting the dev server or redeploying.
        </Section>
        <Section title="Least privilege">
          Each API key has the minimum permissions needed. The Supabase anon key only has access through Row Level Security policies. The Anthropic and OpenAI keys are standard API keys with no admin privileges. No key has database admin, billing management, or account level access.
        </Section>
      </Card>

      <Card title="Data Privacy">
        <Section title="What data goes to LLMs">
          User profile data (name, bio, goals, stage, timezone, hours per week) and chat messages are sent to LLM providers as part of prompts. No passwords, email addresses, or authentication tokens are ever included in prompts. The profile data sent is limited to the fields explicitly selected in the Supabase queries.
        </Section>
        <Section title="Provider data policies">
          Anthropic and OpenAI both state that API inputs are not used for model training by default. However, data is transmitted to their servers for inference. Users should be informed that their profile and chat data passes through third party AI providers for the matching, coaching, and search features.
        </Section>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Documentation Tab
// ═══════════════════════════════════════════════════════════════
function DocsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="Security Measures Summary">
        <Section title="Input validation">
          All user inputs are sanitized before entering LLM prompts. The sanitizer checks for 25 injection patterns, 19 jailbreak phrases, HTML tags, base64 content, unicode tricks, and obfuscation. Inputs scoring risk 7 or above are blocked. Lower risk inputs are flagged and logged but allowed through with dangerous content stripped.
        </Section>
        <Section title="Output filtering">
          All LLM responses are scanned for leaked secrets (API keys, tokens, connection strings) and system prompt leakage phrases before being returned to users. Detected secrets are replaced with [REDACTED].
        </Section>
        <Section title="Rate limiting">
          Per user, per endpoint sliding window rate limits prevent abuse and cost runaway. Limits range from 5 to 30 requests per minute depending on endpoint cost.
        </Section>
        <Section title="API key management">
          Keys stored in .env.local (gitignored), server side only access for LLM keys, least privilege principle, 90 day rotation recommendation.
        </Section>
      </Card>

      <Card title="Red Team Testing Results">
        <Section title="What was tested">
          15 attack vectors across 5 categories: prompt injection (5 tests including basic override, polite social engineering, multi language, base64 encoded, and fake delimiter attacks), jailbreak (4 tests including DAN, hypothetical scenario, roleplay, and sudo mode), data leakage (3 tests targeting environment variables, database credentials, and user data), indirect injection (1 test with malicious content embedded in a profile bio that gets loaded into a match explain prompt), and role hijacking (2 tests attempting to make the AI act as a therapist or lawyer).
        </Section>
        <Section title="Defense layers">
          Each attack hits three defense layers. Layer 1 is the input sanitizer which catches known patterns before the prompt is even built. Layer 2 is the LLM itself which has been trained to resist injection. Layer 3 is the output filter which catches any leaked secrets the model might produce. The red team suite tests all three layers and reports which layer caught each attack.
        </Section>
      </Card>

      <Card title="Known Limitations">
        <Section title="Sanitizer coverage">
          The injection pattern list is English only. Attacks in other languages (tested with Spanish) may bypass the regex patterns. The mitigation is that the LLM itself (layer 2) still resists the attack, but the sanitizer does not flag it.
        </Section>
        <Section title="Rate limiting">
          The rate limiter uses in memory storage which resets on server restart. In production this should be replaced with Redis or a database backed store. The current implementation also does not handle distributed deployments where multiple server instances would have separate rate limit counters.
        </Section>
        <Section title="Output filter">
          The output filter uses pattern matching for known key formats. A novel key format or an obfuscated leak (for example, spelling out a key character by character) would not be caught.
        </Section>
        <Section title="Indirect injection">
          The indirect injection test covers one scenario (malicious bio in match explain). In production, any user generated content that feeds into another user's prompt is an attack surface. This includes chat messages fed into the coach endpoint and search queries.
        </Section>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Shared components
// ═══════════════════════════════════════════════════════════════
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
      {title && <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{title}</div>}
      {children}
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}