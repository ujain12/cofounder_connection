"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Provider = "openai" | "anthropic" | "hf";
type Task = "chatbot" | "rewrite_profile" | "match_explain" | "opener" | "coach" | "multimodal";
type ProfileLite = { id: string; full_name: string | null; bio: string | null };
type MatchRow = { id: string; user_id: string; candidate_id: string; status: string };
type Connection = { match_id: string; other_id: string; other?: ProfileLite | null };

const PROVIDERS = [
  { id: "openai" as Provider, label: "OpenAI" },
  { id: "anthropic" as Provider, label: "Claude (Anthropic)" },
  { id: "hf" as Provider, label: "Hugging Face" },
];
const TASKS = [
  { id: "chatbot" as Task, label: "Chatbot (Q&A)" },
  { id: "rewrite_profile" as Task, label: "Profile Enhancer" },
  { id: "match_explain" as Task, label: "Explain Match" },
  { id: "opener" as Task, label: "Message Opener" },
  { id: "coach" as Task, label: "Conversation Coach" },
  { id: "multimodal" as Task, label: "Multimodal Image Analyzer" },
];
const MODELS: Record<Provider, { id: string; label: string }[]> = {
  openai: [
    { id: "gpt-4o-mini", label: "gpt-4o-mini (fast/cheap)" },
    { id: "gpt-4o", label: "gpt-4o (higher quality)" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fast)" },
  ],
  hf: [
    { id: "google/gemma-2-2b-it", label: "gemma-2-2b-it" },
    { id: "mistralai/Mistral-7B-Instruct-v0.3", label: "Mistral 7B Instruct" },
    { id: "HuggingFaceH4/zephyr-7b-beta", label: "Zephyr 7B Beta" },
  ],
};

const S = {
  card: { background: "#111827", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 16, padding: 24, marginBottom: 16 } as React.CSSProperties,
  label: { display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8", marginBottom: 8 } as React.CSSProperties,
  select: { width: "100%", background: "#1e2235", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 10, padding: "11px 14px", color: "#f0f2fc", fontSize: 13, outline: "none", fontFamily: "inherit" } as React.CSSProperties,
  input: { width: "100%", background: "#1e2235", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 10, padding: "11px 14px", color: "#f0f2fc", fontSize: 13, outline: "none", fontFamily: "inherit", WebkitTextFillColor: "#f0f2fc" } as React.CSSProperties,
  textarea: { width: "100%", background: "#1e2235", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 10, padding: "11px 14px", color: "#f0f2fc", fontSize: 13, outline: "none", fontFamily: "inherit", WebkitTextFillColor: "#f0f2fc", resize: "vertical" } as React.CSSProperties,
  btnPrimary: { background: "linear-gradient(135deg, #4f46e5, #7c3aed)", border: "none", borderRadius: 12, padding: "11px 28px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(79,70,229,0.3)" } as React.CSSProperties,
  btnDisabled: { background: "rgba(79,70,229,0.3)", border: "none", borderRadius: 12, padding: "11px 28px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "not-allowed", fontFamily: "inherit" } as React.CSSProperties,
};

export default function AIPlayground() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [provider, setProvider] = useState<Provider>("openai");
  const [task, setTask] = useState<Task>("chatbot");
  const [model, setModel] = useState(MODELS.openai[0].id);
  const [useAppData, setUseAppData] = useState(true);
  const [useRecentChat, setUseRecentChat] = useState(false);
  const [messagesLimit, setMessagesLimit] = useState(20);
  const [question, setQuestion] = useState("Give me 5 questions founders should ask before splitting equity.");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageQuestion, setImageQuestion] = useState("Analyze this image carefully and summarize the important information.");
  const [imageAnswer, setImageAnswer] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: ud } = await supabase.auth.getUser();
      const user = ud.user;
      if (!user) return;
      const { data: acc } = await supabase.from("matches").select("id,user_id,candidate_id,status").eq("status", "accepted");
      const mine = ((acc as any) ?? []).filter((m: MatchRow) => m.user_id === user.id || m.candidate_id === user.id);
      const base: Connection[] = mine.map((m: MatchRow) => ({ match_id: m.id, other_id: m.user_id === user.id ? m.candidate_id : m.user_id }));
      const otherIds = Array.from(new Set(base.map((c) => c.other_id)));
      let profs: ProfileLite[] = [];
      if (otherIds.length > 0) {
        const { data: p } = await supabase.from("profiles").select("id,full_name,bio").in("id", otherIds);
        profs = (p as ProfileLite[]) ?? [];
      }
      const merged = base.map((c) => ({ ...c, other: profs.find((p) => p.id === c.other_id) ?? null }));
      setConnections(merged);
      if (merged.length > 0) setSelectedMatchId(merged[0].match_id);
    })();
  }, [supabase]);

  function processImageFile(file: File) {
    if (!file.type.startsWith("image/")) { alert("Please upload an image file."); return; }
    if (file.size > 10 * 1024 * 1024) { alert("Image must be under 10MB."); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImage(result);
      setImagePreviewUrl(result);
    };
    reader.readAsDataURL(file);
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  }

  function clearImage() {
    setImage("");
    setImagePreviewUrl(null);
    setImageAnswer("");
  }

  async function fetchMyProfile() {
    const { data: ud } = await supabase.auth.getUser();
    if (!ud.user) throw new Error("Not logged in.");
    const { data: me } = await supabase.from("profiles").select("id,full_name,bio,stage,goals,hours_per_week,timezone").eq("id", ud.user.id).maybeSingle();
    return me ?? { id: ud.user.id };
  }

  async function run() {
    if (task === "multimodal") { await handleAskImage(); return; }
    setBusy(true); setOut("");
    try {
      let payload: any = {};
      if (task === "chatbot") payload = { question };
      if (task === "rewrite_profile") payload = await fetchMyProfile();
      if (task === "match_explain" || task === "opener") {
        const me = await fetchMyProfile();
        const conn = connections.find((c) => c.match_id === selectedMatchId);
        payload = { me, other: conn?.other ?? { id: conn?.other_id } };
      }
      if (task === "coach") {
        const { data: chatRow } = await supabase.from("chats").select("id").eq("match_id", selectedMatchId).maybeSingle();
        let transcript = "";
        if (chatRow?.id) {
          const { data: msgs } = await supabase.from("messages").select("sender_id,body,created_at").eq("chat_id", chatRow.id).order("created_at", { ascending: true }).limit(messagesLimit);
          transcript = ((msgs as any[]) ?? []).map((m) => `${m.sender_id}: ${m.body}`).join("\n");
        }
        payload = { transcript };
      }
      const r = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, model, task, payload }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "AI failed");
      setOut(j.output_text || "");
    } catch (e: any) { alert(e?.message ?? String(e)); }
    finally { setBusy(false); }
  }

  async function handleAskImage() {
    if (!image) { alert("Please upload an image first."); return; }
    setImageLoading(true); setImageAnswer("");
    try {
      const res = await fetch("/api/multimodal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, question: imageQuestion }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Multimodal request failed");
      setImageAnswer(data.answer || "No answer returned.");
      setOut(data.answer || "");
    } catch (e: any) { alert(e?.message); }
    finally { setImageLoading(false); }
  }

  const isMultimodal = task === "multimodal";
  const isBusy = busy || imageLoading;

  return (
    <AppShell title="AI Playground">
      <div style={{ maxWidth: 800, display: "flex", flexDirection: "column", gap: 0 }}>

        {/* Config card */}
        <div style={S.card}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Provider + Model */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={S.label}>Provider</label>
                <select
                  style={{ ...S.select, opacity: isMultimodal ? 0.4 : 1 }}
                  value={provider}
                  disabled={isMultimodal}
                  onChange={(e) => { const p = e.target.value as Provider; setProvider(p); setModel(MODELS[p][0]?.id ?? ""); }}
                >
                  {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Model</label>
                <select
                  style={{ ...S.select, opacity: isMultimodal ? 0.4 : 1 }}
                  value={model}
                  disabled={isMultimodal}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {MODELS[provider].map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                {isMultimodal && (
                  <p style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>
                    Multimodal uses the vision route — provider ignored.
                  </p>
                )}
              </div>
            </div>

            {/* Task */}
            <div>
              <label style={S.label}>Task</label>
              <select style={S.select} value={task} onChange={(e) => setTask(e.target.value as Task)}>
                {TASKS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            {/* Context checkboxes — hidden for multimodal */}
            {!isMultimodal && (
              <div>
                <label style={S.label}>Context</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, color: "#cbd5e1", fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" checked={useAppData} onChange={(e) => setUseAppData(e.target.checked)}
                      style={{ accentColor: "#6366f1", width: 15, height: 15 }} />
                    Use my app data (profile, matches, requests, connections)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, color: "#cbd5e1", fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" checked={useRecentChat} onChange={(e) => setUseRecentChat(e.target.checked)}
                      style={{ accentColor: "#6366f1", width: 15, height: 15 }} />
                    Include recent chat messages (for coaching / summaries)
                  </label>
                </div>
              </div>
            )}

            {/* Connection selector for relevant tasks */}
            {!isMultimodal && (task === "coach" || task === "match_explain" || task === "opener") && (
              <div>
                <label style={S.label}>Connected Founder</label>
                <select style={S.select} value={selectedMatchId} onChange={(e) => setSelectedMatchId(e.target.value)}>
                  {connections.length === 0
                    ? <option value="">No connections yet — accept a request first</option>
                    : connections.map((c) => <option key={c.match_id} value={c.match_id}>{c.other?.full_name ?? c.other_id}</option>)
                  }
                </select>
              </div>
            )}

            {/* Chatbot question */}
            {task === "chatbot" && (
              <div>
                <label style={S.label}>Question</label>
                <input
                  style={S.input}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && run()}
                  placeholder="Ask anything about startups, cofounders, equity..."
                />
              </div>
            )}

            {/* Profile enhancer hint */}
            {task === "rewrite_profile" && (
              <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: "12px 16px" }}>
                <p style={{ fontSize: 13, color: "#a5b4fc" }}>
                  Uses your saved profile data automatically. Make sure your profile is saved first.
                </p>
              </div>
            )}

            {/* Multimodal section */}
            {isMultimodal && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Drop zone */}
                <div>
                  <label style={S.label}>Upload Image</label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => !imagePreviewUrl && document.getElementById("img-input")?.click()}
                    style={{
                      border: `2px dashed ${dragOver ? "#818cf8" : imagePreviewUrl ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.25)"}`,
                      borderRadius: 14,
                      background: dragOver ? "rgba(99,102,241,0.08)" : imagePreviewUrl ? "transparent" : "rgba(99,102,241,0.04)",
                      padding: imagePreviewUrl ? 0 : "32px 20px",
                      cursor: imagePreviewUrl ? "default" : "pointer",
                      textAlign: "center",
                      transition: "all 0.15s",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    {imagePreviewUrl ? (
                      <div style={{ position: "relative" }}>
                        <img
                          src={imagePreviewUrl}
                          alt="Preview"
                          style={{ width: "100%", maxHeight: 280, objectFit: "contain", display: "block", borderRadius: 12 }}
                        />
                        {/* Overlay controls */}
                        <div style={{
                          position: "absolute", top: 10, right: 10,
                          display: "flex", gap: 8,
                        }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); document.getElementById("img-input")?.click(); }}
                            style={{
                              background: "rgba(6,8,16,0.85)", border: "1px solid rgba(99,102,241,0.4)",
                              borderRadius: 8, padding: "6px 12px", color: "#a5b4fc",
                              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                            }}
                          >
                            Change
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); clearImage(); }}
                            style={{
                              background: "rgba(6,8,16,0.85)", border: "1px solid rgba(244,63,94,0.3)",
                              borderRadius: 8, padding: "6px 12px", color: "#fb7185",
                              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: 12,
                          background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#818cf8" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                          </svg>
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: "#f0f2fc", marginBottom: 4 }}>
                            Drop image here or click to browse
                          </p>
                          <p style={{ fontSize: 12, color: "#475569" }}>
                            JPG, PNG, WebP — max 10MB. Charts, slides, resumes, screenshots.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    id="img-input"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: "none" }}
                  />
                </div>

                {/* Question about image */}
                <div>
                  <label style={S.label}>Question About Image</label>
                  <textarea
                    value={imageQuestion}
                    onChange={(e) => setImageQuestion(e.target.value)}
                    rows={3}
                    style={S.textarea}
                    placeholder="What would you like to know about this image?"
                  />
                </div>
              </div>
            )}

            {/* Run button */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button
                onClick={run}
                disabled={isBusy}
                style={isBusy ? S.btnDisabled : S.btnPrimary}
              >
                {isMultimodal
                  ? imageLoading ? "Analyzing..." : "Analyze Image"
                  : busy ? "Running..." : "Run"}
              </button>
              <span style={{ fontSize: 12, color: "#334155", fontFamily: "'IBM Plex Mono', monospace" }}>
                {isMultimodal ? "Route: /api/multimodal" : `${provider} · ${model}`}
              </span>
            </div>
          </div>
        </div>

        {/* Output card */}
        <div style={S.card}>
          <label style={S.label}>Output</label>
          {(isMultimodal ? imageAnswer : out) ? (
            <div style={{
              background: "#0d1117", border: "1px solid rgba(99,102,241,0.15)",
              borderRadius: 12, padding: 20,
            }}>
              <pre style={{
                whiteSpace: "pre-wrap", fontSize: 13, color: "#f0f2fc",
                lineHeight: 1.8, fontFamily: "'IBM Plex Mono', monospace", margin: 0,
              }}>
                {isMultimodal ? imageAnswer : out}
              </pre>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "#334155" }}>
              {isMultimodal ? "Upload an image and click Analyze Image." : "Run to see output."}
            </p>
          )}
        </div>

      </div>
    </AppShell>
  );
}