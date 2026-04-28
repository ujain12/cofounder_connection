"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useMemo, useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────
   Navigation config
───────────────────────────────────────────────────────── */
const NAV_GROUPS = [
  {
    label: "Discover",
    items: [
      { href: "/home",     label: "Home",       icon: HomeIcon    },
      { href: "/matches",  label: "Matches",    icon: PeopleIcon  },
      { href: "/requests", label: "Requests",   icon: BellIcon, badge: 2 },
    ],
  },
  {
    label: "Build Together",
    items: [
      { href: "/workspace", label: "Workspace",     icon: GridIcon   },
      { href: "/profile",   label: "My Profile",    icon: UserIcon   },
      { href: "/ai",        label: "Profile Tools", icon: ToolsIcon  },
    ],
  },
];

/* ─────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────── */
interface AppShellProps {
  children: React.ReactNode;
  /** Optional eyebrow text above the page title */
  eyebrow?: string;
  /** Optional large page title rendered above children */
  title?: string;
  /** Optional subtitle below the title */
  subtitle?: string;
}

interface UserProfile {
  full_name: string | null;
  role?: string | null;
  stage?: string | null;
}

/* ─────────────────────────────────────────────────────────
   Shell
───────────────────────────────────────────────────────── */
export default function AppShell({ children, eyebrow, title, subtitle }: AppShellProps) {
  const pathname  = usePathname();
  const router    = useRouter();
  const supabase  = useMemo(() => supabaseBrowser(), []);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initials, setInitials] = useState("··");

  /* Load the current user's name for the sidebar chip */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("full_name, role, stage")
        .eq("id", user.id)
        .maybeSingle();

      if (data) {
        setProfile(data);
        const parts = (data.full_name ?? user.email ?? "").split(" ");
        setInitials(
          parts.length >= 2
            ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
            : parts[0].slice(0, 2).toUpperCase()
        );
      }
    })();
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  /* pathname match — handles nested routes like /workspace/tasks */
  const isActive = (href: string) =>
    href === "/home"
      ? pathname === "/home"
      : pathname.startsWith(href);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      {/* ── Sidebar ── */}
      <nav className="nav-sidebar">

        {/* Logo */}
        <div className="nav-logo-wrap">
          <Link href="/home" style={{ textDecoration: "none" }}>
            <Image
              src="/images/logo.png"
              alt="Cofounder Connections"
              width={140}
              height={42}
              style={{ objectFit: "contain" }}
              priority
            />
          </Link>
          <p className="nav-tagline">Find your perfect cofounder</p>
        </div>

        {/* Nav links */}
        <div className="nav-body">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="nav-section-label">{group.label}</p>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item${isActive(item.href) ? " active" : ""}`}
                >
                  <item.icon className="nav-icon" />
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className="nav-badge">{item.badge}</span>
                  ) : null}
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* Footer — user chip + sign out */}
        <div className="nav-footer">
          {profile && (
            <div className="nav-user-chip">
              <div className="nav-user-avatar">{initials}</div>
              <div style={{ minWidth: 0 }}>
                <p className="nav-user-name">
                  {profile.full_name?.split(" ")[0] ?? "You"}
                </p>
                <p className="nav-user-role">
                  {[profile.role, profile.stage].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
          )}

          <button onClick={signOut} className="nav-item" style={{ border: "none" }}>
            <SignOutIcon className="nav-icon" />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="main-content" style={{ flex: 1 }}>
        {(eyebrow || title || subtitle) && (
          <div style={{ marginBottom: 30 }} className="anim-up">
            {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
            {title    && <h1 className="page-title">{title}</h1>}
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
        )}

        {/* Key on pathname so page transitions fire on route changes */}
        <div className="anim-up" key={pathname} style={{ animationDelay: "0.04s" }}>
          {children}
        </div>
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Icon components — clean line style, strokeWidth 1.6–2
───────────────────────────────────────────────────────── */
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
    </svg>
  );
}

function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zm9.75-9.75A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function ToolsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}
