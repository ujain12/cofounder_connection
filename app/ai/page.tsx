"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Provider = "openai" | "anthropic";
type Task = "chatbot" | "rewrite_profile" | "match_explain" | "opener" | "coach" | "multimodal";
type ProfileLite = { id: string; full_name: string | null; bio: string | null };
type MatchRow = { id: string; user_id: string; candidate_id: string; status: string };
type Connection = { match_id: string; other_id: string; other?: ProfileLite | null };

const PROVIDERS = [
  { id: "openai" as Provider, label: "OpenAI" },
  { id: "anthropic" as Provider, label: "Claude (Anthropic)" },
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
    { id: "gpt-4o-mini", label: "gpt-4o-mini (fast)" },
    { id: "gpt-4o", label: "gpt-4o (higher quality)" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fast)" },
  ],
};

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: 24,
  marginBottom: 16,
  boxShadow: "var(--shadow-sm)",
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-muted)",
  marginBottom: 7,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "11px 14px",
  color: "var(--text-primary)",
  fontSize: 13,
  outline: "none",
  fontFamily: "inherit",
};

const selectStyle: React.CSSProperties = { ...inputStyle };
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: "vertical" };

export default function AIPlayground() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [provider, setProvider] = useState<Provider>("openai");
  const [task, setTask] = useState<Task>("chatbot");
  const [model, setModel] = useState(MODELS.openai[0].id);
  const [useAppData, setUseAppData] = useState(true);
  const [useRecentChat, setUseRecentChat] = useState(false);
  const [messagesLimit] = useState(20);
  const [question, setQuestion] = useState("Give me 5 questions founders should ask before splitting equity.");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [billingNoticeOpen, setBillingNoticeOpen] = useState(true);

  const [image, setImage] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageQuestion, setImageQuestion] = useState("Analyze this image carefully and summarize the important information.");
  const [imageAnswer, setImageAnswer] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function showBillingMessage() {
    alert(
      "AI features are currently under construction. Soon, users will be able to add a credit card and pay based on actual AI usage. For now, access is restricted."
    );
  }

  useEffect(() => {
    (async () => {
      const { data: ud } = await supabase.auth.getUser();
      const user = ud.user;
      if (!user) return;

      const { data: acc } = await supabase
        .from("matches")
        .select("id,user_id,candidate_id,status")
        .eq("status", "accepted");

      const mine = ((acc as any) ?? []).filter(
        (m: MatchRow) => m.user_id === user.id || m.candidate_id === user.id
      );

      const base: Connection[] = mine.map((m: MatchRow) => ({
        match_id: m.id,
        other_id: m.user_id === user.id ? m.candidate_id : m.user_id,
      }));

      const otherIds = Array.from(new Set(base.map((c) => c.other_id)));
      let profs: ProfileLite[] = [];

      if (otherIds.length > 0) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id,full_name,bio")
          .in("id", otherIds);

        profs = (p as ProfileLite[]) ?? [];
      }

      const merged = base.map((c) => ({
        ...c,
        other: profs.find((p) => p.id === c.other_id) ?? null,
      }));

      setConnections(merged);
      if (merged.length > 0) setSelectedMatchId(merged[0].match_id);
    })();
  }, [supabase]);

  function processImageFile(file: File) {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be under 10MB.");
      return;
    }

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

    const { data: me } = await supabase
      .from("profiles")
      .select("id,full_name,bio,stage,goals,hours_per_week,timezone")
      .eq("id", ud.user.id)
      .maybeSingle();

    return me ?? { id: ud.user.id };
  }

  async function run() {
    if (task === "multimodal") {
      await handleAskImage();
      return;
    }

    setBusy(true);
    setOut("");

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
        const { data: chatRow } = await supabase
          .from("chats")
          .select("id")
          .eq("match_id", selectedMatchId)
          .maybeSingle();

        let transcript = "";

        if (chatRow?.id) {
          const { data: msgs } = await supabase
            .from("messages")
            .select("sender_id,body,created_at")
            .eq("chat_id", chatRow.id)
            .order("created_at", { ascending: true })
            .limit(messagesLimit);

          transcript = ((msgs as any[]) ?? [])
            .map((m) => `${m.sender_id}: ${m.body}`)
            .join("\n");
        }

        payload = { transcript };
      }

      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, task, payload }),
      });

      const j = await r.json();

      if (!j.ok) {
        if (j.needsCredits || j.billingUnderConstruction) {
          showBillingMessage();
          return;
        }

        throw new Error(j.error || "AI request failed");
      }

      setOut(j.output_text || "");
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleAskImage() {
    if (!image) {
      alert("Please upload an image first.");
      return;
    }

    setImageLoading(true);
    setImageAnswer("");

    try {
      const res = await fetch("/api/multimodal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, question: imageQuestion }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.needsCredits || data.billingUnderConstruction) {
          showBillingMessage();
          return;
        }

        throw new Error(data.error || "Multimodal request failed");
      }

      setImageAnswer(data.answer || "No answer returned.");
      setOut(data.answer || "");
    } catch (e: any) {
      alert(e?.message);
    } finally {
      setImageLoading(false);
    }
  }

  const isMultimodal = task === "multimodal";
  const isBusy = busy || imageLoading;
  const outputText = isMultimodal ? imageAnswer : out;

  return (
    <AppShell eyebrow="Tools" title="AI Playground">
      <div style={{ maxWidth: 800 }}>
        {billingNoticeOpen && (
          <div
            style={{
              background: "var(--accent-soft)",
              border: "1px solid var(--accent-border)",
              borderRadius: "var(--radius-lg)",
              padding: "16px 18px",
              marginBottom: 16,
              color: "var(--text-primary)",
              boxShadow: "var(--shadow-sm)",
              position: "relative",
            }}
          >
            <button
              onClick={() => setBillingNoticeOpen(false)}
              style={{
                position: "absolute",
                top: 10,
                right: 12,
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                fontSize: 18,
                cursor: "pointer",
              }}
              aria-label="Close billing notice"
            >
              ×
            </button>

            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
              AI features are temporarily restricted
            </p>

            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              We are setting up a consumption-based billing model. Users will be able to add a credit card
              and pay only for the AI usage they consume. This feature is currently under construction.
            </p>
          </div>
        )}

        <div style={card}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={fieldLabel}>Provider</label>
                <select
                  style={{ ...selectStyle, opacity: isMultimodal ? 0.45 : 1 }}
                  value={provider}
                  disabled={isMultimodal}
                  onChange={(e) => {
                    const p = e.target.value as Provider;
                    setProvider(p);
                    setModel(MODELS[p][0]?.id ?? "");
                  }}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={fieldLabel}>Model</label>
                <select
                  style={{ ...selectStyle, opacity: isMultimodal ? 0.45 : 1 }}
                  value={model}
                  disabled={isMultimodal}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {MODELS[provider].map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>

                {isMultimodal && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                    Multimodal uses the vision route. Provider is ignored.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label style={fieldLabel}>Task</label>
              <select style={selectStyle} value={task} onChange={(e) => setTask(e.target.value as Task)}>
                {TASKS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {!isMultimodal && (
              <div>
                <label style={fieldLabel}>Context</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    {
                      checked: useAppData,
                      set: setUseAppData,
                      label: "Use my app data (profile, matches, connections)",
                    },
                    {
                      checked: useRecentChat,
                      set: setUseRecentChat,
                      label: "Include recent chat messages (for coaching / summaries)",
                    },
                  ].map((item, i) => (
                    <label
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        color: "var(--text-secondary)",
                        fontSize: 13,
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => item.set(e.target.checked)}
                        style={{
                          accentColor: "var(--accent)",
                          width: 15,
                          height: 15,
                          flexShrink: 0,
                        }}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!isMultimodal && (task === "coach" || task === "match_explain" || task === "opener") && (
              <div>
                <label style={fieldLabel}>Connected Founder</label>
                <select style={selectStyle} value={selectedMatchId} onChange={(e) => setSelectedMatchId(e.target.value)}>
                  {connections.length === 0 ? (
                    <option value="">No connections yet. Accept a request first.</option>
                  ) : (
                    connections.map((c) => (
                      <option key={c.match_id} value={c.match_id}>
                        {c.other?.full_name ?? c.other_id}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {task === "chatbot" && (
              <div>
                <label style={fieldLabel}>Question</label>
                <input
                  style={inputStyle}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && run()}
                  placeholder="Ask anything about startups, cofounders, equity..."
                />
              </div>
            )}

            {task === "rewrite_profile" && (
              <div
                style={{
                  background: "var(--accent-soft)",
                  border: "1px solid var(--accent-border)",
                  borderRadius: "var(--radius)",
                  padding: "12px 16px",
                }}
              >
                <p style={{ fontSize: 13, color: "var(--accent)", lineHeight: 1.6 }}>
                  Uses your saved profile data automatically. Make sure your profile is saved first.
                </p>
              </div>
            )}

            {isMultimodal && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={fieldLabel}>Upload Image</label>

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => !imagePreviewUrl && document.getElementById("img-input")?.click()}
                    style={{
                      border: `2px dashed ${
                        dragOver ? "var(--accent)" : imagePreviewUrl ? "var(--accent-border)" : "var(--border)"
                      }`,
                      borderRadius: "var(--radius-lg)",
                      background: dragOver
                        ? "var(--accent-soft)"
                        : imagePreviewUrl
                          ? "transparent"
                          : "var(--bg-deep, #f4f0e8)",
                      padding: imagePreviewUrl ? 0 : "36px 20px",
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
                          style={{
                            width: "100%",
                            maxHeight: 280,
                            objectFit: "contain",
                            display: "block",
                            borderRadius: "var(--radius-lg)",
                          }}
                        />

                        <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 8 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              document.getElementById("img-input")?.click();
                            }}
                            style={{
                              background: "rgba(255,255,255,0.92)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              padding: "6px 12px",
                              color: "var(--accent)",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Change
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearImage();
                            }}
                            style={{
                              background: "rgba(255,255,255,0.92)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              padding: "6px 12px",
                              color: "#c0394a",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 14,
                            background: "var(--accent-soft)",
                            border: "1px solid var(--accent-border)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth={1.8}>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                            />
                          </svg>
                        </div>

                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                            Drop image here or click to browse
                          </p>

                          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            JPG, PNG, WebP. Max 10MB. Charts, slides, resumes, screenshots.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <input id="img-input" type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                </div>

                <div>
                  <label style={fieldLabel}>Question about image</label>
                  <textarea
                    value={imageQuestion}
                    onChange={(e) => setImageQuestion(e.target.value)}
                    rows={3}
                    style={textareaStyle}
                    placeholder="What would you like to know about this image?"
                  />
                </div>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button
                onClick={run}
                disabled={isBusy}
                style={{
                  padding: "11px 28px",
                  background: isBusy ? "var(--accent-soft)" : "var(--accent)",
                  border: isBusy ? "1px solid var(--accent-border)" : "none",
                  borderRadius: "var(--radius)",
                  color: isBusy ? "var(--accent)" : "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: isBusy ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                }}
              >
                {isMultimodal ? (imageLoading ? "Analyzing..." : "Analyze Image") : busy ? "Running..." : "Run"}
              </button>

              {!isMultimodal && (
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                  {provider === "openai" ? "OpenAI" : "Anthropic"} · {model}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={card}>
          <label style={fieldLabel}>Output</label>

          {outputText ? (
            <div
              style={{
                background: "var(--bg-deep, #f4f0e8)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: 20,
              }}
            >
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  color: "var(--text-primary)",
                  lineHeight: 1.8,
                  fontFamily: "inherit",
                  margin: 0,
                }}
              >
                {outputText}
              </pre>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
              {isMultimodal ? "Upload an image and click Analyze Image." : "Configure and click Run to see output."}
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}