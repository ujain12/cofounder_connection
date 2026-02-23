"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "../../components/AppShell";
import { Button, Card, Input } from "../../components/ui";

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
  } catch {
    return ts;
  }
}

export default function ChatPage() {
  const params = useParams<{ matchId: string }>();
  const router = useRouter();
  const matchId = params.matchId;

  const supabase = useMemo(() => supabaseBrowser(), []);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [me, setMe] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");

  const [other, setOther] = useState<ProfileLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const pollingMs = 1500;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!matchId) return;

    let interval: any = null;
    let cancelled = false;

    (async () => {
      setLoading(true);

      // 0) Get current user
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        alert("Please login first.");
        router.push("/");
        return;
      }
      if (cancelled) return;
      setMe(user.id);

      // 1) Load match row and verify accepted
      const { data: matchRow, error: matchErr } = await supabase
        .from("matches")
        .select("id,user_id,candidate_id,status")
        .eq("id", matchId)
        .maybeSingle();

      if (matchErr) {
        console.error(matchErr);
        alert("Match lookup failed (RLS).");
        setLoading(false);
        return;
      }

      if (!matchRow) {
        alert("Match not found.");
        router.push("/matches");
        return;
      }

      const m = matchRow as MatchRow;

      if (m.status !== "accepted") {
        alert("This chat is only available after you are connected (accepted).");
        router.push("/matches");
        return;
      }

      // 2) Determine other user + load their profile
      const otherId = m.user_id === user.id ? m.candidate_id : m.user_id;

      const { data: otherProf } = await supabase
        .from("profiles")
        .select("id,full_name,bio")
        .eq("id", otherId)
        .maybeSingle();

      if (!cancelled) setOther((otherProf as ProfileLite) ?? null);

      // 3) Find chat row for this match
      const { data: chatRow, error: chatErr } = await supabase
        .from("chats")
        .select("id")
        .eq("match_id", matchId)
        .maybeSingle();

      if (chatErr) {
        console.error(chatErr);
        alert("Chat lookup failed (RLS).");
        setLoading(false);
        return;
      }

      // 3B) If accepted but no chat, create it
      let cId: string | null = chatRow?.id ?? null;

      if (!cId) {
        const { data: created, error: createErr } = await supabase
          .from("chats")
          .insert({ match_id: matchId })
          .select("id")
          .maybeSingle();

        if (createErr) {
          console.error(createErr);
          alert("Chat create failed (RLS/constraint).");
          setLoading(false);
          return;
        }

        cId = created?.id ?? null;
      }

      if (!cId) {
        alert("Chat ID missing.");
        setLoading(false);
        return;
      }

      if (cancelled) return;
      setChatId(cId);

      await loadMessages(cId);

      if (cancelled) return;

      interval = setInterval(async () => {
        await loadMessages(cId!);
      }, pollingMs);

      setLoading(false);
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  async function loadMessages(cId: string) {
    const { data, error } = await supabase
      .from("messages")
      .select("id,sender_id,body,created_at")
      .eq("chat_id", cId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }
    setMessages(((data as any[]) ?? []) as Msg[]);
  }

  async function send() {
    if (!chatId || !me) return;
    if (!body.trim()) return;

    setSending(true);
    const text = body.trim();
    setBody("");

    const { error } = await supabase.from("messages").insert({
      chat_id: chatId,
      sender_id: me,
      body: text,
    });

    setSending(false);

    if (error) {
      console.error(error);
      alert("Send failed (RLS).");
      return;
    }

    await loadMessages(chatId);
  }

  return (
    <AppShell title="Chat">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              Chat{other?.full_name ? ` with ${other.full_name}` : ""}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {other?.bio ? other.bio : "Only available after you accept a request."}
            </p>
          </div>

          <a
            href="/matches"
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm hover:bg-zinc-900"
          >
            Back to Matches
          </a>
        </div>

        <Card className="p-0">
          <div className="h-[420px] overflow-y-auto p-5">
            {loading ? (
              <p className="text-sm text-zinc-300">Loading chat...</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-zinc-300">No messages yet. Say hi 👋</p>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((m) => {
                  const mine = m.sender_id === me;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                          mine
                            ? "bg-white text-black"
                            : "border border-zinc-800 bg-zinc-950 text-zinc-100"
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{m.body}</div>
                        <div
                          className={`mt-1 text-[11px] ${
                            mine ? "text-black/60" : "text-zinc-500"
                          }`}
                        >
                          {fmtTime(m.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="border-t border-zinc-800 p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
              />
              <Button onClick={send} disabled={sending || !body.trim()}>
                {sending ? "Sending..." : "Send"}
              </Button>
            </div>

            <div className="mt-2 text-xs text-zinc-500">
              Tip: Press Enter to send.
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
