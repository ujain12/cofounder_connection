import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from "react";

export function Button({
  children,
  variant = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost";
}) {
  const base =
    "rounded-xl px-4 py-2 text-sm font-medium transition";

  const styles =
    variant === "ghost"
      ? "border border-zinc-800 bg-transparent hover:bg-zinc-900"
      : "bg-white text-black hover:bg-zinc-200";

  return (
    <button
      {...props}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white ${className}`}
    />
  );
}
