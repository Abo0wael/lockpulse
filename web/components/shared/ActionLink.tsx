import Link from "next/link";
import type { ReactNode } from "react";

type ActionLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
};

const variants = {
  primary:
    "bg-primary text-white shadow-lg shadow-primary/20 hover:-translate-y-0.5 hover:bg-indigo-500",
  secondary:
    "border border-border bg-surface/70 text-text hover:border-secondary/50 hover:bg-surface",
};

export default function ActionLink({
  href,
  children,
  variant = "primary",
  className = "",
}: ActionLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition duration-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary ${variants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
