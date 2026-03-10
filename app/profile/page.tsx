"use client";

import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useState } from "react";

type Profile = {
  full_name: string;
  bio: string;
  timezone: string;
  hours_per_week: number | null;
  stage: string;
  goals: string;
};

const emptyProfile: Profile = {
  full_name: "",
  bio: "",
  timezone: "",
  hours_per_week: null,
  stage: "",
  goals: "",
};

type Provider = "openai" | "anthropic" | "hf";

const MODELS: Record<Provider, { id: string; label: string }[]> = {
  openai: [
    { id: "gpt-4o-mini", label: "gpt-4o-mini (fast/cheap)" },
    { id: "gpt-4o", label: "gpt-4o (higher quality)" },
  ],
  anthropic: [
    { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
  ],
  hf: [
    { id: "google/gemma-2-2b-it", label: "gemma-2-2b-it" },
    { id: "mistralai/Mistral-7B-Instruct-v0.3", label: "Mistral-7B-Instruct" },
  ],
};

export default function ProfilePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [profile, setProfile] = useState<Profile>(emptyProfile);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // AI state
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState(MODELS.openai[0].id);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiOut, setAiOut] = useState("");
  const [aiMode, setAiMode] = useState<"enhance" | "missing">("enhance");

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

      if (data) {
        setProfile({
          full_name: data.full_name ?? "",
          bio: data.bio ?? "",
          timezone: data.timezone ?? "",
          hours_per_week: data.hours_per_week ?? null,
          stage: data.stage ?? "",
          goals: data.goals ?? "",
        });
      }

      setLoading(false);
    })();
  }, [supabase]);

  async function saveProfile() {
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      alert("Not logged in");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      ...profile,
    });

    setSaving(false);

    if (error) return alert("Error: " + error.message);
    alert("Profile saved ✅");
  }

  function onProviderChange(p: Provider) {
    setProvider(p);
    setModel(MODELS[p][0]?.id ?? "");
  }

  async function runAI(kind: "enhance" | "missing") {
    setAiMode(kind);
    setAiOut("");
    setAiBusy(true);

    const feature = kind === "enhance" ? "profile_enhance" : "profile_missing";

    const r = await fetch("/api/ai/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, model, feature }),
    });

    const j = await r.json();
    setAiBusy(false);

    if (!j.ok) return alert(j.error || "AI failed");
    setAiOut(j.output_text || "");
  }

  function applyBioFromAI() {
    // Very simple: take first “Improved Bio” paragraph if present
    // If not, just apply whole output.
    const text = aiOut.trim();
    if (!text) return;

    // try to extract line after "Improved Bio"
    const idx = text.toLowerCase().indexOf("improved bio");
    if (idx >= 0) {
      const slice = text.slice(idx);
      const lines = slice.split("\n").map((l) => l.trim()).filter(Boolean);
      // pick next non-title line
      const candidate = lines.find((l) => !l.toLowerCase().includes("improved bio") && l.length > 20);
      if (candidate) {
        setProfile((p) => ({ ...p, bio: candidate }));
        return;
      }
    }

    setProfile((p) => ({ ...p, bio: text.slice(0, 500) }));
  }

  if (loading) return <main className="p-10">Loading...</main>;

  return (
    <main className="p-10 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">My Profile</h1>
        <Link className="text-sm text-zinc-400 hover:text-white" href="/">
          ← Home
        </Link>
      </div>

      <div className="grid gap-3">
        <input
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3"
          placeholder="Full Name"
          value={profile.full_name}
          onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
        />

        <textarea
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 h-28"
          placeholder="Bio"
          value={profile.bio}
          onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-3">
          <input
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3"
            placeholder="Timezone"
            value={profile.timezone}
            onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
          />

          <input
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3"
            type="number"
            placeholder="Hours per week"
            value={profile.hours_per_week ?? ""}
            onChange={(e) =>
              setProfile({
                ...profile,
                hours_per_week: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </div>

        <input
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3"
          placeholder="Stage"
          value={profile.stage}
          onChange={(e) => setProfile({ ...profile, stage: e.target.value })}
        />

        <textarea
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 h-24"
          placeholder="Goals"
          value={profile.goals}
          onChange={(e) => setProfile({ ...profile, goals: e.target.value })}
        />

        <button
          onClick={saveProfile}
          disabled={saving}
          className="rounded-xl bg-white text-black py-3 font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>

      {/* AI Profile Tools */}
      <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">AI Profile Tools</h2>

          <div className="flex items-center gap-2">
            <select
              className="rounded-xl border border-zinc-800 bg-black p-2 text-sm"
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as Provider)}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Claude</option>
              <option value="hf">HuggingFace</option>
            </select>

            <select
              className="rounded-xl border border-zinc-800 bg-black p-2 text-sm"
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
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => runAI("enhance")}
            disabled={aiBusy}
            className="rounded-xl border border-zinc-800 px-4 py-2 hover:bg-zinc-900 disabled:opacity-50"
          >
            {aiBusy && aiMode === "enhance" ? "Running..." : "Enhance my profile"}
          </button>

          <button
            onClick={() => runAI("missing")}
            disabled={aiBusy}
            className="rounded-xl border border-zinc-800 px-4 py-2 hover:bg-zinc-900 disabled:opacity-50"
          >
            {aiBusy && aiMode === "missing" ? "Running..." : "What am I missing?"}
          </button>

          <button
            onClick={applyBioFromAI}
            disabled={!aiOut.trim()}
            className="rounded-xl bg-zinc-800 px-4 py-2 hover:bg-zinc-700 disabled:opacity-50"
          >
            Apply Bio
          </button>
        </div>

        <div className="mt-4 whitespace-pre-wrap text-sm text-zinc-200">
          {aiOut ? aiOut : <span className="text-zinc-500">Run a tool to see output here.</span>}
        </div>
      </div>
    </main>
  );
}
