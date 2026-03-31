"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "../components/AppShell";
import {
  ALL_TAGS, CATEGORIES, CATEGORY_COLORS,
  getTagsByCategory, type TagCategory
} from "@/lib/tags";

type Profile = {
  full_name: string; bio: string; timezone: string;
  hours_per_week: number | null; stage: string; goals: string; avatar_url: string | null;
};
type Provider = "openai" | "anthropic" | "hf";

const emptyProfile: Profile = {
  full_name: "", bio: "", timezone: "", hours_per_week: null,
  stage: "", goals: "", avatar_url: null,
};

const MODELS: Record<Provider, { id: string; label: string }[]> = {
  openai: [{ id: "gpt-4o-mini", label: "gpt-4o-mini (fast)" }, { id: "gpt-4o", label: "gpt-4o (quality)" }],
  anthropic: [{ id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" }, { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" }],
  hf: [{ id: "google/gemma-2-2b-it", label: "gemma-2-2b-it" }, { id: "mistralai/Mistral-7B-Instruct-v0.3", label: "Mistral-7B" }],
};

const S = {
  card: { background: "#111827", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 16, padding: 24, marginBottom: 20 } as React.CSSProperties,
  label: { display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8", marginBottom: 6 } as React.CSSProperties,
  input: { width: "100%", background: "#1e2235", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 10, padding: "11px 14px", color: "#f0f2fc", fontSize: 13, outline: "none", fontFamily: "inherit", WebkitTextFillColor: "#f0f2fc" } as React.CSSProperties,
  btnPrimary: { background: "linear-gradient(135deg, #4f46e5, #7c3aed)", border: "none", borderRadius: 12, padding: "11px 24px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
  btnGhost: { background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "11px 24px", color: "#cbd5e1", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
  sectionTitle: { fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: "#f0f2fc", marginBottom: 4 } as React.CSSProperties,
};

function initials(name: string) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

const MAX_TAGS = 8;

export default function ProfilePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Tags state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const [activeCategory, setActiveCategory] = useState<TagCategory>("Domain Expertise");

  // AI state
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState(MODELS.openai[0].id);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiOut, setAiOut] = useState("");
  const [aiMode, setAiMode] = useState<"enhance" | "missing">("enhance");
  const [enhanceData, setEnhanceData] = useState<any>(null);
  const [missingData, setMissingData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const [profileRes, tagsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("profile_tags").select("tag").eq("user_id", user.id),
      ]);

      if (profileRes.data) {
        setProfile({
          full_name: profileRes.data.full_name ?? "",
          bio: profileRes.data.bio ?? "",
          timezone: profileRes.data.timezone ?? "",
          hours_per_week: profileRes.data.hours_per_week ?? null,
          stage: profileRes.data.stage ?? "",
          goals: profileRes.data.goals ?? "",
          avatar_url: profileRes.data.avatar_url ?? null,
        });
        if (profileRes.data.avatar_url) setAvatarPreview(profileRes.data.avatar_url);
      }

      setSelectedTags((tagsRes.data ?? []).map((t: any) => t.tag));
      setLoading(false);
    })();
  }, [supabase]);

  // ── Tag toggle ─────────────────────────────────────────────
  async function toggleTag(tagLabel: string) {
    if (!userId) return;
    const isSelected = selectedTags.includes(tagLabel);

    if (!isSelected && selectedTags.length >= MAX_TAGS) {
      alert(`Maximum ${MAX_TAGS} tags allowed.`);
      return;
    }

    setSavingTags(true);

    if (isSelected) {
      // Remove tag
      await supabase.from("profile_tags").delete()
        .eq("user_id", userId).eq("tag", tagLabel);
      setSelectedTags(prev => prev.filter(t => t !== tagLabel));
    } else {
      // Add tag
      const tag = ALL_TAGS.find(t => t.label === tagLabel);
      await supabase.from("profile_tags").insert({
        user_id: userId,
        tag: tagLabel,
        category: tag?.category ?? "Domain Expertise",
      });
      setSelectedTags(prev => [...prev, tagLabel]);
    }

    setSavingTags(false);
  }

  // ── Avatar ─────────────────────────────────────────────────
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (!file.type.startsWith("image/")) { alert("Please upload an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB."); return; }
    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    const ext = file.name.split(".").pop() ?? "jpg";
    const { error: uploadError } = await supabase.storage.from("avatars").upload(`${userId}/avatar.${ext}`, file, { upsert: true, contentType: file.type });
    if (uploadError) { alert("Upload failed: " + uploadError.message); setUploadingAvatar(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(`${userId}/avatar.${ext}`);
    await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", userId);
    setProfile(prev => ({ ...prev, avatar_url: urlData.publicUrl }));
    setAvatarPreview(urlData.publicUrl);
    setUploadingAvatar(false);
  }

  async function removeAvatar() {
    if (!userId) return;
    setUploadingAvatar(true);
    await supabase.storage.from("avatars").remove([`${userId}/avatar.jpg`, `${userId}/avatar.png`, `${userId}/avatar.webp`]);
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
    setProfile(prev => ({ ...prev, avatar_url: null }));
    setAvatarPreview(null);
    setUploadingAvatar(false);
  }

  // ── Profile save ───────────────────────────────────────────
  async function saveProfile() {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { alert("Not logged in"); setSaving(false); return; }
    const { error } = await supabase.from("profiles").upsert({ id: user.id, ...profile });
    setSaving(false);
    if (error) { alert("Error: " + error.message); return; }
    alert("Profile saved!");
  }

  // ── AI ─────────────────────────────────────────────────────
  async function runAI(kind: "enhance" | "missing") {
    setAiMode(kind); setAiOut(""); setEnhanceData(null); setMissingData(null); setAiBusy(true);
    const task = kind === "enhance" ? "rewrite_profile" : "profile_missing";
    try {
      const r = await fetch("/api/ai/context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, model, task, payload: profile }) });
      const j = await r.json();
      setAiBusy(false);
      if (!j.ok) { alert(j.error || "AI failed"); return; }
      setAiOut(j.output_text || "");
      if (kind === "enhance") setEnhanceData(j.parsed ?? null);
      else setMissingData(j.parsed ?? null);
    } catch { setAiBusy(false); alert("AI request failed."); }
  }

  function applyField(field: keyof Profile, value: any) {
    if (value === undefined) return;
    setProfile(prev => ({ ...prev, [field]: value }));
  }

  if (loading) return <AppShell title="My Profile"><div style={{ color: "#94a3b8", padding: 40 }}>Loading...</div></AppShell>;

  return (
    <AppShell title="My Profile">
      <div style={{ maxWidth: 720 }}>

        {/* ── Photo card ── */}
        <div style={S.card}>
          <h2 style={S.sectionTitle}>Profile Photo</h2>
          <p style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>Shown to other founders when they browse profiles.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{ width: 88, height: 88, borderRadius: "50%", border: "2px solid rgba(99,102,241,0.4)", overflow: "hidden", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 24px rgba(99,102,241,0.2)" }}>
                {avatarPreview ? <img src={avatarPreview} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>{initials(profile.full_name)}</span>}
              </div>
              {uploadingAvatar && (
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(6,8,16,0.75)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 18, height: 18, border: "2px solid #818cf8", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                </div>
              )}
            </div>
            <div>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>JPG, PNG or WebP. Max 5MB.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar} style={{ ...S.btnPrimary, padding: "8px 16px", fontSize: 12, opacity: uploadingAvatar ? 0.5 : 1 }}>
                  {uploadingAvatar ? "Uploading..." : avatarPreview ? "Change" : "Upload Photo"}
                </button>
                {avatarPreview && <button onClick={removeAvatar} disabled={uploadingAvatar} style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 12, padding: "8px 16px", color: "#fb7185", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: uploadingAvatar ? 0.5 : 1 }}>Remove</button>}
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} style={{ display: "none" }} />
            </div>
          </div>
        </div>

        {/* ── Tags card ── */}
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
            <div>
              <h2 style={S.sectionTitle}>Your Tags</h2>
              <p style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>
                Select up to {MAX_TAGS} tags. These help the AI search agent find the right matches for you.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {savingTags && <span style={{ fontSize: 11, color: "#475569" }}>Saving...</span>}
              <span style={{
                fontSize: 11, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
                color: selectedTags.length >= MAX_TAGS ? "#f43f5e" : "#6366f1",
                background: selectedTags.length >= MAX_TAGS ? "rgba(244,63,94,0.1)" : "rgba(99,102,241,0.1)",
                border: `1px solid ${selectedTags.length >= MAX_TAGS ? "rgba(244,63,94,0.2)" : "rgba(99,102,241,0.2)"}`,
                borderRadius: 20, padding: "3px 10px",
              }}>
                {selectedTags.length}/{MAX_TAGS}
              </span>
            </div>
          </div>

          {/* Category tabs */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {CATEGORIES.map(cat => {
              const colors = CATEGORY_COLORS[cat];
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    background: isActive ? colors.activeBg : "transparent",
                    border: `1px solid ${isActive ? colors.activeBorder : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 20, padding: "6px 14px",
                    color: isActive ? colors.activeText : "#64748b",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "inherit", transition: "all 0.15s",
                  userSelect: "none",
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Tags grid for active category */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {getTagsByCategory(activeCategory).map(tag => {
              const isSelected = selectedTags.includes(tag.label);
              const colors = CATEGORY_COLORS[tag.category];
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.label)}
                  style={{
                    background: isSelected ? colors.activeBg : colors.bg,
                    border: `1px solid ${isSelected ? colors.activeBorder : colors.border}`,
                    borderRadius: 20, padding: "7px 16px",
                    color: isSelected ? colors.activeText : colors.text,
                    fontSize: 13, fontWeight: isSelected ? 700 : 500,
                    cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.15s",
                    transform: isSelected ? "scale(1.02)" : "scale(1)",
                    userSelect: "none",
                  }}
                >
                  {isSelected && <span style={{ marginRight: 6 }}>✓</span>}
                  {tag.label}
                </button>
              );
            })}
          </div>

          {/* Selected tags summary */}
          {selectedTags.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: 10 }}>
                Your selected tags
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {selectedTags.map(tagLabel => {
                  const tag = ALL_TAGS.find(t => t.label === tagLabel);
                  const colors = tag ? CATEGORY_COLORS[tag.category] : CATEGORY_COLORS["Domain Expertise"];
                  return (
                    <span key={tagLabel} style={{
                      background: colors.activeBg, border: `1px solid ${colors.activeBorder}`,
                      borderRadius: 20, padding: "4px 12px",
                      color: colors.activeText, fontSize: 12, fontWeight: 600,
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      {tagLabel}
                      <button
                        onClick={() => toggleTag(tagLabel)}
                        style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1, opacity: 0.7, userSelect: "none" }}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Profile details ── */}
        <div style={S.card}>
          <h2 style={S.sectionTitle}>Profile Details</h2>
          <p style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>Used by the AI agent to match you with compatible founders.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={S.label}>Full Name</label>
              <input style={S.input} placeholder="Your full name" value={profile.full_name} onChange={e => setProfile({ ...profile, full_name: e.target.value })} />
            </div>
            <div>
              <label style={S.label}>Bio</label>
              <textarea style={{ ...S.input, resize: "vertical" }} rows={4} placeholder="Describe your background and what you're building..." value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={S.label}>Timezone</label>
                <input style={S.input} placeholder="e.g. EST, PST" value={profile.timezone} onChange={e => setProfile({ ...profile, timezone: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Hours / Week</label>
                <input style={S.input} type="number" placeholder="e.g. 20" value={profile.hours_per_week ?? ""} onChange={e => setProfile({ ...profile, hours_per_week: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div>
              <label style={S.label}>Startup Stage</label>
              <input style={S.input} placeholder="Idea / MVP / Early Revenue" value={profile.stage} onChange={e => setProfile({ ...profile, stage: e.target.value })} />
            </div>
            <div>
              <label style={S.label}>Goals</label>
              <textarea style={{ ...S.input, resize: "vertical" }} rows={3} placeholder="What are you trying to build?" value={profile.goals} onChange={e => setProfile({ ...profile, goals: e.target.value })} />
            </div>
            <div>
              <button onClick={saveProfile} disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.5 : 1 }}>
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        </div>

        {/* ── AI Tools ── */}
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ ...S.sectionTitle, marginBottom: 0 }}>AI Profile Tools</h2>
              <p style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Uses GPT-4o for rewrites, GPT-4o-mini for gap analysis.</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <select style={{ ...S.input, width: "auto", padding: "8px 12px" }} value={provider} onChange={e => { setProvider(e.target.value as Provider); setModel(MODELS[e.target.value as Provider][0].id); }}>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Claude</option>
                <option value="hf">HuggingFace</option>
              </select>
              <select style={{ ...S.input, width: "auto", padding: "8px 12px" }} value={model} onChange={e => setModel(e.target.value)}>
                {MODELS[provider].map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button onClick={() => runAI("enhance")} disabled={aiBusy} style={{ ...S.btnPrimary, opacity: aiBusy ? 0.5 : 1 }}>
              {aiBusy && aiMode === "enhance" ? "Running..." : "Enhance My Profile"}
            </button>
            <button onClick={() => runAI("missing")} disabled={aiBusy} style={{ ...S.btnGhost, opacity: aiBusy ? 0.5 : 1 }}>
              {aiBusy && aiMode === "missing" ? "Running..." : "What Am I Missing?"}
            </button>
          </div>
          {enhanceData && (
            <div style={{ background: "#0d1117", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#a5b4fc", marginBottom: 12 }}>Enhanced Suggestions</p>
              {enhanceData.summary?.map((s: string, i: number) => <p key={i} style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>• {s}</p>)}
              {["bio", "goals", "stage", "timezone"].map(field => enhanceData[field] ? (
                <div key={field} style={{ background: "#1a2035", borderRadius: 10, padding: "12px 16px", marginTop: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6366f1", marginBottom: 6 }}>{field}</p>
                  <p style={{ fontSize: 13, color: "#f0f2fc", marginBottom: 10 }}>{enhanceData[field]}</p>
                  <button onClick={() => applyField(field as any, enhanceData[field])} style={{ background: "#4f46e5", border: "none", borderRadius: 8, padding: "6px 14px", color: "#fff", fontSize: 12, cursor: "pointer" }}>Apply</button>
                </div>
              ) : null)}
            </div>
          )}
          {missingData && (
            <div style={{ background: "#0d1117", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#a5b4fc", marginBottom: 12 }}>Missing or Weak Areas</p>
              {missingData.overall_feedback?.map((f: string, i: number) => <p key={i} style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>• {f}</p>)}
              {missingData.missing?.map((item: any, i: number) => (
                <div key={i} style={{ background: "#1a2035", borderRadius: 10, padding: "12px 16px", marginTop: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#f43f5e", marginBottom: 4 }}>{item.field}</p>
                  <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>{item.reason}</p>
                  <p style={{ fontSize: 13, color: "#f0f2fc", marginBottom: 10 }}>{item.suggestion}</p>
                  <button onClick={() => applyField(item.field, item.suggestion)} style={{ background: "#4f46e5", border: "none", borderRadius: 8, padding: "6px 14px", color: "#fff", fontSize: 12, cursor: "pointer" }}>Apply</button>
                </div>
              ))}
            </div>
          )}
          {!aiOut && !enhanceData && !missingData && (
            <p style={{ fontSize: 13, color: "#475569" }}>Run a tool to see AI output here.</p>
          )}
        </div>

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  );
}