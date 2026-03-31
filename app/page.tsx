"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useState } from "react";
import AppShell from "./components/AppShell";
import { Button, Card, Input } from "./components/ui";
import Link from "next/link";

export default function Home() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"signin" | "signup" | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function signUp() {
    if (!email || !password) return alert("Enter email + password");
    setBusy("signup");
    const { error } = await supabase.auth.signUp({ email, password });
    setBusy(null);
    if (error) return alert(error.message);
    alert("Account created ✅ Now sign in.");
    setMode("signin");
  }

  async function signIn() {
    if (!email || !password) return alert("Enter email + password");
    setBusy("signin");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(null);
    if (error) return alert(error.message);
  }

  /* ── LOGGED OUT ── */
  if (!user) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#060810",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Glows */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
          <div style={{
            position: "absolute", top: -200, left: -200,
            width: 600, height: 600, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.15), transparent 70%)",
            filter: "blur(40px)",
          }} />
          <div style={{
            position: "absolute", bottom: -200, right: -200,
            width: 600, height: 600, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,58,237,0.12), transparent 70%)",
            filter: "blur(40px)",
          }} />
        </div>

        <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 400, padding: "0 20px" }}>

          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div className="logo-mark">
                <span className="logo-c">C</span>
                <div className="logo-bond">
                  <div className="logo-bond-line" />
                  <div className="logo-bond-line" />
                  <div className="logo-bond-line" />
                </div>
                <span className="logo-c">C</span>
              </div>
            </div>
            <h1 style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 22, fontWeight: 800,
              color: "#f0f2fc", marginBottom: 8,
              letterSpacing: "-0.02em",
            }}>
              Cofounder Connections
            </h1>
            <p style={{ fontSize: 13, color: "#64748b" }}>
              Connect with the right cofounder and build something great.
            </p>
          </div>

          {/* Auth card */}
          <div style={{
            background: "#0c0e1a",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            padding: 28,
            boxShadow: "0 8px 48px rgba(0,0,0,0.6), 0 0 80px rgba(99,102,241,0.06)",
          }}>
            {/* Mode toggle */}
            <div style={{
              display: "flex", gap: 4,
              background: "rgba(255,255,255,0.04)",
              borderRadius: 12, padding: 4,
              marginBottom: 24,
            }}>
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    flex: 1, padding: "8px 0",
                    borderRadius: 9, border: "none",
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: 13, fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    background: mode === m
                      ? "linear-gradient(135deg, #4f46e5, #7c3aed)"
                      : "transparent",
                    color: mode === m ? "#fff" : "#64748b",
                    boxShadow: mode === m ? "0 2px 12px rgba(99,102,241,0.3)" : "none",
                  }}
                >
                  {m === "signin" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{
                  display: "block", fontSize: 10, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.1em",
                  color: "#94a3b8", marginBottom: 6,
                }}>
                  Email
                </label>
                <input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (mode === "signin" ? signIn() : signUp())}
                  style={{
                    width: "100%", padding: "11px 14px",
                    background: "#080a14",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    color: "#f0f2fc", fontSize: 13,
                    fontFamily: "'Manrope', sans-serif",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: "block", fontSize: 10, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.1em",
                  color: "#94a3b8", marginBottom: 6,
                }}>
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (mode === "signin" ? signIn() : signUp())}
                  style={{
                    width: "100%", padding: "11px 14px",
                    background: "#080a14",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    color: "#f0f2fc", fontSize: 13,
                    fontFamily: "'Manrope', sans-serif",
                    outline: "none",
                  }}
                />
              </div>

              <button
                onClick={mode === "signin" ? signIn : signUp}
                disabled={busy !== null}
                style={{
                  width: "100%", padding: "12px 0",
                  background: busy !== null
                    ? "rgba(99,102,241,0.5)"
                    : "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  border: "none", borderRadius: 12,
                  color: "#fff",
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: 14, fontWeight: 700,
                  cursor: busy !== null ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 24px rgba(99,102,241,0.35)",
                  transition: "all 0.2s ease",
                  marginTop: 4,
                }}
              >
                {busy !== null
                  ? (busy === "signin" ? "Signing in..." : "Creating account...")
                  : (mode === "signin" ? "Sign In" : "Create Account")}
              </button>
            </div>

            <p style={{ marginTop: 20, fontSize: 11, color: "#334155", textAlign: "center" }}>
              
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ── LOGGED IN ── */
  return (
    <AppShell title="Home">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Welcome */}
        <Card hover={false}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: "#f0f2fc" }}>Welcome back</h1>
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{user.email}</p>
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "linear-gradient(135deg, #4f46e5, #bba6df)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: 14,
              border: "2px solid rgba(99,102,241,0.3)",
              flexShrink: 0,
            }}>
              {user.email?.[0]?.toUpperCase() ?? "U"}
            </div>
          </div>

          <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              { href: "/profile",   label: "My Profile" },
              { href: "/matches",   label: "Find Cofounders" },
              { href: "/requests",  label: "Requests" },
              { href: "/workspace", label: "Workspace" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "inline-flex", alignItems: "center",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                  padding: "7px 14px",
                  fontSize: 12, fontWeight: 600,
                  color: "#94a3b8",
                  textDecoration: "none",
                  transition: "all 0.18s ease",
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </Card>

        {/* Tip */}
        <div style={{
          borderRadius: 16,
          border: "1px solid rgba(99,102,241,0.2)",
          background: "rgba(99,102,241,0.06)",
          padding: "16px 20px",
          display: "flex", alignItems: "flex-start", gap: 14,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#818cf8" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>Complete your profile first</p>
            <p style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
              A strong bio, clear goals, and your timezone help you get better matches.{" "}
              <Link href="/profile" style={{ color: "#818cf8" }}>Update now →</Link>
            </p>
          </div>
        </div>

      </div>
    </AppShell>
  );
}