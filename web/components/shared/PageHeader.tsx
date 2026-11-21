"use client";

import { motion, useReducedMotion } from "framer-motion";

const tones = {
  cyan: { eyebrow: "text-secondary", glow: "rgba(56,189,248,0.15)", orbit: "border-secondary/15" },
  violet: { eyebrow: "text-primary", glow: "rgba(99,102,241,0.19)", orbit: "border-primary/20" },
  green: { eyebrow: "text-success", glow: "rgba(52,211,153,0.13)", orbit: "border-success/15" },
} as const;

export default function PageHeader({
  eyebrow,
  title,
  description,
  tone = "cyan",
}: {
  eyebrow: string;
  title: string;
  description: string;
  tone?: keyof typeof tones;
}) {
  const palette = tones[tone];
  const reduceMotion = useReducedMotion();

  return (
    <header className="relative isolate overflow-hidden border-b border-border bg-[var(--header-background)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: `radial-gradient(ellipse at 82% 18%, ${palette.glow}, transparent 45%)` }}
      />
      <motion.div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-28 -top-44 -z-10 h-[27rem] w-[27rem] rounded-full border ${palette.orbit}`}
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={reduceMotion ? undefined : { duration: 80, repeat: Infinity, ease: "linear" }}
      >
        <span className="absolute left-[18%] top-[17%] h-2 w-2 rounded-full bg-secondary shadow-[0_0_18px_rgba(56,189,248,0.9)]" />
      </motion.div>
      <motion.div
        className="mx-auto max-w-7xl px-5 py-11 sm:px-6 sm:py-16 lg:py-20"
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.5, ease: "easeOut" }}
      >
        <p className={`flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] sm:text-xs ${palette.eyebrow}`}>
          <span aria-hidden="true" className="h-px w-7 bg-current" />
          {eyebrow}
        </p>
        <h1 className="mt-4 max-w-4xl text-3xl font-bold leading-[1.08] tracking-[-0.035em] text-text sm:text-5xl lg:text-[3.4rem]">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted sm:text-base sm:leading-7">
          {description}
        </p>
      </motion.div>
    </header>
  );
}
