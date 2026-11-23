"use client";

import { motion, useReducedMotion } from "framer-motion";

const tones = {
  cyan: { eyebrow: "text-secondary", glow: "rgba(66,220,232,0.09)" },
  violet: { eyebrow: "text-primary", glow: "rgba(140,124,255,0.1)" },
  green: { eyebrow: "text-success", glow: "rgba(69,212,131,0.08)" },
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
      <div aria-hidden="true" className="lp-grid-field pointer-events-none absolute inset-0 -z-10 opacity-25" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-[40%]" style={{ background: `radial-gradient(ellipse at 100% 0%, ${palette.glow}, transparent 68%)` }} />
      <motion.div
        className="lp-container relative py-14 sm:py-18 lg:py-24"
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.5, ease: "easeOut" }}
      >
        <p className={`lp-kicker ${palette.eyebrow}`}>{eyebrow}</p>
        <h1 className="lp-page-title mt-5 text-text">
          {title}
        </h1>
        <p className="lp-page-lead mt-5">
          {description}
        </p>
      </motion.div>
    </header>
  );
}
