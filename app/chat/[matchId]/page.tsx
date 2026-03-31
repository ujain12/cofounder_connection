"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "../../components/AppShell";

type MatchRow = {
  id: string;
  user_id: string;
  candidate_id: string;
  status: "pending" | "accepted" | "declined";
};

type ProfileLite = {
  id: string;
  full_name: string | null;
  bio: string | null;
};

type Msg = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function fmtTime(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ts; }
}

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

export default function ChatPage() {
  const params = useParams<{ matchId: string }>();
  const router = useRouter();
  const matchId = params.matchId;

  const supabase = useMemo(() => supabaseBrowser(), []);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [me, setMe] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [other, setOther] = useState<ProfileLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const pollingMs = 1500;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!matchId) return;
    let interval: any = null;
    let cancelled = false;

    (async () => {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) { alert("Please login first."); router.push("/"); return; }
      if (cancelled) return;
      setMe(user.id);

      // Load my name
      const { data: myProf } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (myProf?.full_name) setMyName(myProf.full_name);

      const { data: matchRow, error: matchErr } = await supabase
        .from("matches").select("id,user_id,candidate_id,status").eq("id", matchId).maybeSingle();

      if (matchErr || !matchRow) { router.push("/matches"); return; }
      const m = matchRow as MatchRow;
      if (m.status !== "accepted") { alert("Chat is only available after accepting."); router.push("/matches"); return; }

      const otherId = m.user_id === user.id ? m.candidate_id : m.user_id;
      const { data: otherProf } = await supabase.from("profiles").select("id,full_name,bio").eq("id", otherId).maybeSingle();
      if (!cancelled) setOther((otherProf as ProfileLite) ?? null);

      const { data: chatRow } = await supabase.from("chats").select("id").eq("match_id", matchId).maybeSingle();
      let cId: string | null = chatRow?.id ?? null;

      if (!cId) {
        const { data: created, error: createErr } = await supabase.from("chats").insert({ match_id: matchId }).select("id").maybeSingle();
        if (createErr) { alert("Chat create failed."); setLoading(false); return; }
        cId = created?.id ?? null;
      }

      if (!cId) { alert("Chat ID missing."); setLoading(false); return; }
      if (cancelled) return;
      setChatId(cId);
      await loadMessages(cId);
      if (cancelled) return;
      interval = setInterval(async () => { await loadMessages(cId!); }, pollingMs);
      setLoading(false);
    })();

    return () => { cancelled = true; if (interval) clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  async function loadMessages(cId: string) {
    const { data, error } = await supabase.from("messages").select("id,sender_id,body,created_at").eq("chat_id", cId).order("created_at", { ascending: true });
    if (error) { console.error(error); return; }
    setMessages(((data as any[]) ?? []) as Msg[]);
  }

  async function send() {
    if (!chatId || !me || !body.trim()) return;
    setSending(true);
    const text = body.trim();
    setBody("");
    const { error } = await supabase.from("messages").insert({ chat_id: chatId, sender_id: me, body: text });
    setSending(false);
    if (error) { console.error(error); alert("Send failed."); return; }
    await loadMessages(chatId);
  }

  return (
    <AppShell title="Chat">
      <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 0 }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 16, marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Avatar */}
            <div style={{
              width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              border: "2px solid rgba(99,102,241,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 17, fontWeight: 700, color: "#fff",
            }}>
              {initials(other?.full_name ?? null)}
            </div>
            <div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: "#f0f2fc", marginBottom: 3 }}>
                {other?.full_name ? `${other.full_name}` : "Loading..."}
              </h2>
              <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, maxWidth: 480 }}>
                {other?.bio ?? "Connected cofounder"}
              </p>
            </div>
          </div>

          <a href="/matches" style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, padding: "8px 16px",
            color: "#94a3b8", fontSize: 13, fontWeight: 600,
            textDecoration: "none", flexShrink: 0,
            transition: "all 0.15s",
          }}>
            Back to Matches
          </a>
        </div>

        {/* Chat window */}
        <div style={{
          background: "#111827",
          border: "1px solid rgba(99,102,241,0.18)",
          borderRadius: 16,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}>

          {/* Messages area */}
          <div style={{
            height: 460,
            overflowY: "auto",
            padding: "20px 20px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#475569", fontSize: 14 }}>
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#818cf8" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                </div>
                <p style={{ fontSize: 14, color: "#475569" }}>No messages yet — say hello!</p>
              </div>
            ) : (
              <>
                {messages.map((msg) => {
                  const mine = msg.sender_id === me;
                  return (
                    <div key={msg.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>
                      {/* Other person avatar */}
                      {!mine && (
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                          background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 700, color: "#fff",
                        }}>
                          {initials(other?.full_name ?? null)}
                        </div>
                      )}

                      {/* Bubble */}
                      <div style={{ maxWidth: "72%" }}>
                        <div style={{
                          padding: "10px 14px",
                          borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          background: mine
                            ? "linear-gradient(135deg, #4f46e5, #7c3aed)"
                            : "#1e2235",
                          border: mine ? "none" : "1px solid rgba(99,102,241,0.15)",
                          color: "#f0f2fc",
                          fontSize: 13,
                          lineHeight: 1.6,
                          wordBreak: "break-word",
                          boxShadow: mine ? "0 4px 16px rgba(79,70,229,0.25)" : "none",
                        }}>
                          {msg.body}
                        </div>
                        <p style={{
                          fontSize: 10, marginTop: 4,
                          color: "#334155",
                          textAlign: mine ? "right" : "left",
                          fontFamily: "'IBM Plex Mono', monospace",
                        }}>
                          {fmtTime(msg.created_at)}
                        </p>
                      </div>

                      {/* My avatar */}
                      {mine && (
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                          background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 700, color: "#fff",
                        }}>
                          {initials(myName)}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(99,102,241,0.12)" }} />

          {/* Input area */}
          <div style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  background: "#1e2235",
                  border: "1px solid rgba(99,102,241,0.25)",
                  borderRadius: 12,
                  padding: "11px 16px",
                  color: "#f0f2fc",
                  fontSize: 13,
                  outline: "none",
                  fontFamily: "inherit",
                  WebkitTextFillColor: "#f0f2fc",
                }}
              />
              <button
                onClick={send}
                disabled={sending || !body.trim()}
                style={{
                  background: sending || !body.trim()
                    ? "rgba(79,70,229,0.3)"
                    : "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  border: "none",
                  borderRadius: 12,
                  padding: "11px 20px",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: sending || !body.trim() ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexShrink: 0,
                  boxShadow: !body.trim() ? "none" : "0 4px 16px rgba(79,70,229,0.3)",
                }}
              >
                {sending ? "Sending..." : "Send"}
                {!sending && (
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                )}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#334155", marginTop: 8, fontFamily: "'IBM Plex Mono', monospace" }}>
              Press Enter to send
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}