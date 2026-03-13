import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

/* ─────────────────────────────────────────────────
   BUTTON  — no inline SVGs, no giant icon blowup
───────────────────────────────────────────────── */
export function Button({
  children,
  variant = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "success" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer outline-none border disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap";

  const styles: Record<string, string> = {
    default:
      "bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-transparent shadow-[0_0_16px_rgba(99,102,241,0.3)] hover:shadow-[0_0_24px_rgba(99,102,241,0.5)] hover:-translate-y-px",
    ghost:
      "bg-transparent text-slate-400 border-white/10 hover:border-indigo-500/40 hover:bg-indigo-500/8 hover:text-white",
    success:
      "bg-emerald-500/12 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20",
    danger:
      "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/18",
  };

  return (
    <button {...props} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────────
   CARD
───────────────────────────────────────────────── */
export function Card({
  children,
  className = "",
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={[
        "relative rounded-2xl border border-white/8 bg-[#0d0f1a] p-5",
        "shadow-[0_2px_20px_rgba(0,0,0,0.5),0_1px_0_rgba(255,255,255,0.04)_inset]",
        "overflow-hidden",
        hover
          ? "transition-all duration-200 hover:border-indigo-500/25 hover:shadow-[0_4px_24px_rgba(0,0,0,0.5),0_0_32px_rgba(99,102,241,0.1)] hover:-translate-y-px"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* top shimmer */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   INPUT
───────────────────────────────────────────────── */
export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-xl border border-white/10 bg-[#0a0c16]",
        "px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600",
        "outline-none transition-all duration-200",
        "focus:border-indigo-500/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]",
        // force text visible in all browsers
        "[color:#f1f5f9] [-webkit-text-fill-color:#f1f5f9]",
        className,
      ].join(" ")}
    />
  );
}

/* ─────────────────────────────────────────────────
   TEXTAREA
───────────────────────────────────────────────── */
export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        "w-full rounded-xl border border-white/10 bg-[#0a0c16]",
        "px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600",
        "outline-none transition-all duration-200 resize-vertical",
        "focus:border-indigo-500/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]",
        "[color:#f1f5f9] [-webkit-text-fill-color:#f1f5f9]",
        className,
      ].join(" ")}
    />
  );
}

/* ─────────────────────────────────────────────────
   BADGE
───────────────────────────────────────────────── */
export function Badge({
  children,
  color = "indigo",
}: {
  children: ReactNode;
  color?: "indigo" | "emerald" | "cyan" | "rose" | "amber" | "zinc";
}) {
  const colors: Record<string, string> = {
    indigo:  "bg-indigo-500/12 text-indigo-300 border-indigo-500/20",
    emerald: "bg-emerald-500/12 text-emerald-400 border-emerald-500/20",
    cyan:    "bg-cyan-500/12 text-cyan-400 border-cyan-500/20",
    rose:    "bg-rose-500/12 text-rose-400 border-rose-500/20",
    amber:   "bg-amber-500/12 text-amber-400 border-amber-500/20",
    zinc:    "bg-white/6 text-slate-400 border-white/8",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors[color]}`}
    >
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────────
   AVATAR  — explicit pixel sizes, no SVG blowup
───────────────────────────────────────────────── */
export function Avatar({
  name,
  size = "md",
}: {
  name?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const initials = (name ?? "?")
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // explicit pixel dimensions so Tailwind can't purge them
  const dim: Record<string, { wh: string; fs: string }> = {
    sm: { wh: "w-8 h-8",   fs: "text-xs" },
    md: { wh: "w-10 h-10", fs: "text-sm" },
    lg: { wh: "w-14 h-14", fs: "text-lg" },
    xl: { wh: "w-20 h-20", fs: "text-2xl" },
  };

  const { wh, fs } = dim[size];

  return (
    <div
      className={`flex-shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white border-2 border-indigo-500/30 ${wh} ${fs}`}
      style={{ minWidth: size === "md" ? 40 : size === "lg" ? 56 : size === "xl" ? 80 : 32 }}
    >
      {initials}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   LABEL
───────────────────────────────────────────────── */
export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5"
    >
      {children}
    </label>
  );
}

/* ─────────────────────────────────────────────────
   SECTION HEADING
───────────────────────────────────────────────── */
export function SectionHeading({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-4 gap-3">
      <div>
        <h2 className="text-[15px] font-bold text-slate-100 tracking-tight leading-snug">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   DIVIDER
───────────────────────────────────────────────── */
export function Divider() {
  return (
    <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent my-4" />
  );
}