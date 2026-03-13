"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useMemo } from "react";
import Image from "next/image";

const NAV_GROUPS = [
  {
    label: "Discover",
    items: [
      { href: "/",         label: "Home",       icon: HomeIcon },
      { href: "/matches",  label: "Matches",    icon: SparkIcon },
      { href: "/requests", label: "Requests",   icon: BellIcon },
    ],
  },
  {
    label: "You",
    items: [
      { href: "/profile",   label: "My Profile", icon: UserIcon },
      { href: "/ai",        label: "AI Tools",   icon: AiIcon },
      { href: "/workspace", label: "Workspace",  icon: GridIcon },
    ],
  },
];

export default function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname();
  const supabase = useMemo(() => supabaseBrowser(), []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* ── Sidebar ──────────────────────────────── */}
      <nav className="nav-sidebar">

        {/* Logo — fixed size, no overflow */}
        <div className="nav-logo-wrap">
          <Image
            src="/images/logo.png"
            alt="CoFounder Connection"
            width={148}
            height={44}
            className="nav-logo-img"
            priority
          />
          <p className="nav-tagline">Find your perfect cofounder</p>
        </div>

        {/* Nav links */}
        <div className="nav-body">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="nav-section-label">{group.label}</p>
              {group.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item${active ? " active" : ""}`}
                  >
                    <item.icon className="nav-icon" />
                    <span>{item.label}</span>
                    {active && <span className="nav-dot" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer: sign out */}
        <div className="nav-footer">
          <button
            onClick={signOut}
            className="nav-item"
            style={{ width: "100%", background: "none", cursor: "pointer" }}
          >
            <SignOutIcon className="nav-icon" />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      {/* ── Main content ─────────────────────────── */}
      <main className="main-content" style={{ flex: 1 }}>
        {title && (
          <div className="page-header anim-up">
            <h1 className="page-title">{title}</h1>
          </div>
        )}
        <div className="anim-up" style={{ animationDelay: "0.06s" }}>
          {children}
        </div>
      </main>
    </div>
  );
}

/* ── SVG Icons ───────────────────────────────────── */
function HomeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>;
}
function SparkIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>;
}
function BellIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>;
}
function UserIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>;
}
function AiIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>;
}
function GridIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zm9.75-9.75A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>;
}
function SignOutIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>;
}