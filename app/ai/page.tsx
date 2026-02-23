"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { Button, Card, Input } from "../components/ui";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Provider = "openai" | "anthropic" | "hf";
type Task = "chatbot" | "rewrite_profile" | "match_explain" | "opener" | "coach";

type ProfileLite = { id: string; full_name: string | null; bio: string | null };

type MatchRow = {
  id: string; // match_id
  user_id: string;
  candidate_id: string;
  status: string;
};

type Connection = {
  match_id: string;
  other_id: string;
  other?: ProfileLite | null;
};

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Claude (Anthropic)" },
  { id: "hf", label: "Hugging Face" },
];

const TASKS: { id: Task; label: string }[] = [
  { id: "chatbot", label: "Chatbot (Q&A)" },
  { id: "rewrite_profile", label: "Profile Enhancer" },
  { id: "match_explain", label: "Explain Match" },
  { id: "opener", label: "Message Opener" },
  { id: "coach", label: "Conversation Coach" },
];

const MODELS: Record<Provider, { id: string; label: string }[]> = {
  openai: [
    { id: "gpt-4o-mini", label: "gpt-4o-mini (fast/cheap)" },
    { id: "gpt-4o", label: "gpt-4o (higher quality)" },
  ],
  anthropic: [
    { id: "claude-3-5-sonnet-20240620", label: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-20240307", label: "Claude 3.5 Haiku" },
  ],
  hf: [
    { id: "google/gemma-2-2b-it", label: "google/gemma-2-2b-it" },
    { id: "mistralai/Mistral-7B-Instruct-v0.3", label: "Mistral 7B Instruct v0.3" },
    { id: "HuggingFaceH4/zephyr-7b-beta", label: "Zephyr 7B Beta" },
  ],
};

export default function AIPlayground() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [provider, setProvider] = useState<Provider>("openai");
  const [task, setTask] = useState<Task>("chatbot");
  const [model, setModel] = useState(MODELS.openai[0].id);

  // Context toggles
  const [useAppData, setUseAppData] = useState(true);
  const [useRecentChat, setUseRecentChat] = useState(false);
  const [messagesLimit, setMessagesLimit] = useState(20);

  // Task inputs
  const [question, setQuestion] = useState(
    "Give me 5 questions founders should ask before splitting equity."
  );

  // ✅ Instead of asking for match_id / user_id, we load real connections
  const [meId, setMeId] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>(""); // auto from dropdown

  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  // -----------------------------
  // Load current user + accepted connections for dropdown
  // -----------------------------
  useEffect(() => {
    (async () => {
      const { data: ud } = await supabase.auth.getUser();
      const user = ud.user;
      if (!user) {
        setMeId(null);
        setConnections([]);
        return;
      }
      setMeId(user.id);

      // Load ALL accepted matches (RLS should allow rows where I'm user_id OR candidate_id)
      const { data: acc, error: accErr } = await supabase
        .from("matches")
        .select("id,user_id,candidate_id,status")
        .eq("status", "accepted");

      if (accErr) {
        console.error(accErr);
        // If you see this, it's RLS on matches select
        return;
      }

      const accepted = ((acc as any) ?? []) as MatchRow[];
      const mine = accepted.filter(
        (m) => m.user_id === user.id || m.candidate_id === user.id
      );

      const baseConnections: Connection[] = mine.map((m) => {
        const otherId = m.user_id === user.id ? m.candidate_id : m.user_id;
        return { match_id: m.id, other_id: otherId };
      });

      const otherIds = Array.from(new Set(baseConnections.map((c) => c.other_id)));

      let otherProfiles: ProfileLite[] = [];
      if (otherIds.length > 0) {
        const { data: profs, error: profErr } = await supabase
          .from("profiles")
          .select("id,full_name,bio")
          .in("id", otherIds);

        if (!profErr) otherProfiles = (profs as ProfileLite[]) ?? [];
      }

      const merged = baseConnections.map((c) => ({
        ...c,
        other: otherProfiles.find((p) => p.id === c.other_id) ?? null,
      }));

      setConnections(merged);

      // If none selected yet, select first
      if (!selectedMatchId && merged.length > 0) {
        setSelectedMatchId(merged[0].match_id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------
  // Helper data fetchers
  // -----------------------------
  async function fetchMyProfile() {
    const { data: ud } = await supabase.auth.getUser();
    const user = ud.user;
    if (!user) throw new Error("Not logged in.");

    const { data: me, error } = await supabase
      .from("profiles")
      .select("id,full_name,bio,stage,goals,hours_per_week,timezone")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw new Error("Failed to load your profile (RLS).");
    return me ?? { id: user.id };
  }

  async function fetchOtherProfileByMatch(matchId: string) {
    const conn = connections.find((c) => c.match_id === matchId);
    if (!conn) throw new Error("No connection selected.");
    return conn.other ?? { id: conn.other_id };
  }

  async function fetchTranscriptFromMatch(matchId: string, limit: number) {
    const { data: chatRow, error: chatErr } = await supabase
      .from("chats")
      .select("id")
      .eq("match_id", matchId)
      .maybeSingle();

    if (chatErr) throw new Error("Chat lookup failed (RLS).");
    if (!chatRow?.id) return "";

    const { data: msgs, error: msgErr } = await supabase
      .from("messages")
      .select("sender_id,body,created_at")
      .eq("chat_id", chatRow.id)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (msgErr) throw new Error("Messages load failed (RLS).");

    const arr = (msgs as any[]) ?? [];
    return arr.map((m) => `${m.sender_id}: ${m.body}`).join("\n");
  }

  // -----------------------------
  // Run AI
  // -----------------------------
  async function run() {
    setBusy(true);
    setOut("");

    try {
      let payload: any = {};

      if (task === "chatbot") {
        payload = { question };
      }

      if (task === "rewrite_profile") {
        if (!useAppData) throw new Error("Turn ON 'Use my app data' for Profile Enhancer.");
        payload = await fetchMyProfile();
      }

      if (task === "match_explain" || task === "opener") {
        if (!useAppData) throw new Error("Turn ON 'Use my app data' for Match features.");
        if (!selectedMatchId) throw new Error("No connection selected.");
        const me = await fetchMyProfile();
        const other = await fetchOtherProfileByMatch(selectedMatchId);
        payload = { me, other };
      }

      if (task === "coach") {
        if (!useRecentChat) throw new Error("Turn ON 'Include recent chat messages' for Coach.");
        if (!selectedMatchId) throw new Error("Pick a connected user.");
        const transcript = await fetchTranscriptFromMatch(selectedMatchId, messagesLimit);
        payload = { transcript };
      }

      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, task, payload }),
      });

      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "AI failed");
      setOut(j.output_text || "");
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <AppShell title="AI Playground">
      <div className="grid gap-4">
        <Card>
          <div className="grid gap-4">
            {/* Provider */}
            <div>
              <div className="mb-1 text-xs text-zinc-400">Provider</div>
              <select
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2"
                value={provider}
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

            {/* Model */}
            <div>
              <div className="mb-1 text-xs text-zinc-400">Model</div>
              <select
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {MODELS[provider].map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Context */}
            <div className="grid gap-2">
              <div className="text-xs text-zinc-400">Context</div>

              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={useAppData}
                  onChange={(e) => setUseAppData(e.target.checked)}
                />
                Use my app data (profile, matches, requests, connections)
              </label>

              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={useRecentChat}
                  onChange={(e) => setUseRecentChat(e.target.checked)}
                />
                Include recent chat messages (for coaching / summaries)
              </label>

              {/* ✅ Connection dropdown instead of match_id input */}
              {(task === "coach" || task === "match_explain" || task === "opener") && (
                <div className="grid gap-2">
                  <div className="text-xs text-zinc-400">Connected user</div>

                  <select
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2"
                    value={selectedMatchId}
                    onChange={(e) => setSelectedMatchId(e.target.value)}
                  >
                    {connections.length === 0 ? (
                      <option value="">
                        No connections yet (accept a request first)
                      </option>
                    ) : (
                      connections.map((c) => (
                        <option key={c.match_id} value={c.match_id}>
                          {c.other?.full_name ?? c.other_id}
                        </option>
                      ))
                    )}
                  </select>

                  {task === "coach" && useRecentChat && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="mb-1 text-xs text-zinc-400">Messages limit</div>
                        <Input
                          value={String(messagesLimit)}
                          onChange={(e) => setMessagesLimit(Number(e.target.value || 20))}
                          placeholder="20"
                        />
                      </div>
                      <div className="text-xs text-zinc-500 self-end">
                        We pull messages automatically for the selected user.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Task */}
            <div>
              <div className="mb-1 text-xs text-zinc-400">Task</div>
              <select
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2"
                value={task}
                onChange={(e) => setTask(e.target.value as Task)}
              >
                {TASKS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Task inputs */}
            {task === "chatbot" && (
              <div className="grid gap-2">
                <div className="text-xs text-zinc-400">Question</div>
                <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
              </div>
            )}

            {task === "rewrite_profile" && (
              <div className="text-xs text-zinc-500">
                This uses your saved Profile data automatically.
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={run} disabled={busy}>
                {busy ? "Running..." : "Run"}
              </Button>

              <div className="text-xs text-zinc-500">
                Provider: <b>{provider}</b> • Model: <b>{model}</b>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="text-sm text-zinc-400">Output</div>
          <pre className="mt-3 whitespace-pre-wrap text-sm">{out || "Run to see output."}</pre>
        </Card>
      </div>
    </AppShell>
  );
}
