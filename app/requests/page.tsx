"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import AppShell from "../components/AppShell";
import { Button, Card } from "../components/ui";

type ProfileLite = { id: string; full_name: string | null; bio: string | null };

type Incoming = {
  id: string; // match id
  user_id: string; // liker
  candidate_id: string; // me
  status: "pending" | "accepted" | "declined";
  created_at: string;
  liker?: ProfileLite | null;
};

export default function RequestsPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [me, setMe] = useState<string | null>(null);
  const [rows, setRows] = useState<Incoming[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setMe(null);
      setRows([]);
      setLoading(false);
      return;
    }

    setMe(user.id);

    // 1) Incoming pending requests only (who liked me)
    const { data: reqs, error } = await supabase
      .from("matches")
      .select("id,user_id,candidate_id,status,created_at")
      .eq("candidate_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Failed to load requests (RLS).");
      setLoading(false);
      return;
    }

    const base = (reqs as Incoming[]) ?? [];
    const likerIds = Array.from(new Set(base.map((r) => r.user_id)));

    // 2) Load liker profiles for display
    let profiles: ProfileLite[] = [];
    if (likerIds.length > 0) {
      const { data: profs, error: profErr } = await supabase
        .from("profiles")
        .select("id,full_name,bio")
        .in("id", likerIds);

      if (profErr) {
        console.error(profErr);
        profiles = [];
      } else {
        profiles = (profs as ProfileLite[]) ?? [];
      }
    }

    const merged = base.map((r) => ({
      ...r,
      liker: profiles.find((p) => p.id === r.user_id) ?? null,
    }));

    setRows(merged);
    setLoading(false);
  }

  async function accept(matchId: string) {
    if (!me) return;
    setWorkingId(matchId);

    // A) Candidate accepts -> set status accepted
    const { error: updErr } = await supabase
      .from("matches")
      .update({ status: "accepted" })
      .eq("id", matchId)
      .eq("candidate_id", me)
      .eq("status", "pending");

    if (updErr) {
      console.error(updErr);
      alert("Accept failed (RLS).");
      setWorkingId(null);
      return;
    }

    // B) Ensure chat exists (requires chats.match_id UNIQUE)
    const { error: chatErr } = await supabase
      .from("chats")
      .upsert({ match_id: matchId }, { onConflict: "match_id" });

    if (chatErr) {
      console.error(chatErr);
      alert("Accepted, but chat creation failed (RLS/constraint).");
      setWorkingId(null);
      return;
    }

    router.push(`/chat/${matchId}`);
  }

  async function decline(matchId: string) {
    if (!me) return;
    setWorkingId(matchId);

    const { error } = await supabase
      .from("matches")
      .update({ status: "declined" })
      .eq("id", matchId)
      .eq("candidate_id", me)
      .eq("status", "pending");

    if (error) {
      console.error(error);
      alert("Decline failed (RLS).");
      setWorkingId(null);
      return;
    }

    await load();
    setWorkingId(null);
  }

  return (
    <AppShell title="Requests">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Requests</h1>
            <p className="text-sm text-zinc-400">
              These are people who liked you. Accept to connect and start chatting.
            </p>
          </div>

          <Button variant="ghost" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <Card>
            <p className="text-sm text-zinc-300">Loading...</p>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-300">No pending requests.</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((r) => (
              <Card key={r.id}>
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="text-base font-semibold">
                      {r.liker?.full_name ?? "Unnamed"}
                    </div>
                    <div className="mt-1 text-sm text-zinc-400">{r.liker?.bio ?? ""}</div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => accept(r.id)}
                      disabled={workingId === r.id}
                    >
                      {workingId === r.id ? "Accepting..." : "Accept"}
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={() => decline(r.id)}
                      disabled={workingId === r.id}
                    >
                      {workingId === r.id ? "Declining..." : "Decline"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
