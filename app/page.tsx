"use client";

import Image from "next/image";
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
    alert("Account created ✅ Now click Sign In.");
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
      <div className="relative min-h-screen flex items-center justify-center bg-[#07080f] overflow-hidden">

        {/* Background glows */}
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[120px]" />
          <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-violet-600/8 blur-[120px]" />
        </div>

        <div className="relative z-10 w-full max-w-sm px-4">

          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="flex justify-center mb-4">
              <Image
                src="/images/logo.png"
                alt="CoFounder Connection"
                width={180}
                height={54}
                className="object-contain"
                priority
              />
            </div>
            <p className="text-sm text-slate-500">
              Connect with the right cofounder and build something great.
            </p>
          </div>

          {/* Auth card */}
          <div className="rounded-2xl border border-white/8 bg-[#0d0f1a] p-6 shadow-[0_4px_40px_rgba(0,0,0,0.6)]">

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
                  Email
                </label>
                <Input
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
                  Password
                </label>
                <Input
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="flex gap-2 mt-1">
                <Button
                  onClick={signIn}
                  disabled={busy !== null}
                  className="flex-1 justify-center"
                >
                  {busy === "signin" ? "Signing in…" : "Sign In"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={signUp}
                  disabled={busy !== null}
                  className="flex-1 justify-center"
                >
                  {busy === "signup" ? "Creating…" : "Sign Up"}
                </Button>
              </div>
            </div>

            <p className="mt-4 text-[11px] text-slate-600 text-center">
              Use 2 different emails to test matching end-to-end.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ── LOGGED IN ── */
  return (
    <AppShell title="Home">
      <div className="flex flex-col gap-6">

        {/* Welcome */}
        <Card hover={false}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-slate-100">Welcome back 👋</h1>
              <p className="text-sm text-slate-400 mt-1">{user.email}</p>
            </div>
            <div
              className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm border-2 border-indigo-500/30"
            >
              {user.email?.[0]?.toUpperCase() ?? "U"}
            </div>
          </div>

          {/* Quick nav */}
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              { href: "/profile",   label: "My Profile",  icon: "👤" },
              { href: "/matches",   label: "Find Cofounders", icon: "✨" },
              { href: "/requests",  label: "Requests",    icon: "🔔" },
              { href: "/workspace", label: "Workspace",   icon: "⚡" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/4 px-3.5 py-2 text-xs font-medium text-slate-300 hover:border-indigo-500/30 hover:bg-indigo-500/8 hover:text-slate-100 transition-all"
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </Card>

        {/* Tip card */}
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">Complete your profile first</p>
              <p className="text-xs text-slate-500 mt-0.5">
                A strong bio, clear goals, and your timezone help you get better matches.{" "}
                <Link href="/profile" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                  Update now →
                </Link>
              </p>
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}