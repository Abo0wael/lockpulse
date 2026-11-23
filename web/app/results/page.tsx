"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import PageHeader from "@/components/shared/PageHeader";
import Reveal from "@/components/landing/Reveal";
import ResultsOverview from "@/components/results/ResultsOverview";
import DetectorComparison from "@/components/results/DetectorComparison";
import DelayChart from "@/components/results/DelayChart";
import { loadResults, overallRows } from "@/lib/data";
import type { ResultRow } from "@/lib/types";
import { familyLabel, formatPercent } from "@/lib/utils";

export default function ResultsPage() {
  const reduceMotion = useReducedMotion();
  const [split, setSplit] = useState<"test" | "validation">("test");
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadResults(split)
      .then((data) => {
        setRows(data.rows);
        setError("");
      })
      .catch((e: Error) => setError(e.message));
  }, [split]);

  const primaryRows = useMemo(() => overallRows(rows), [rows]);
  const families = useMemo(
    () => [...new Set(rows.filter((row) => row.scope !== "overall").map((row) => row.scope))].sort(),
    [rows],
  );

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-background text-text">
        <PageHeader
          eyebrow="Benchmark evaluation"
          title="Performance you can inspect."
          description="Compare detection rate, alert delay, false alarms, and precision–recall performance across frozen detector configurations."
          tone="green"
        />

        <div className="lp-container space-y-8 py-10 sm:py-12 lg:py-14">
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface/55 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <p className="text-sm font-semibold">Choose an evaluation split</p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
                Validation selects thresholds; the test split reports held-out performance.
              </p>
            </div>
            <div role="group" aria-label="Evaluation split" className="flex shrink-0 rounded-xl border border-border bg-background/80 p-1">
              {(["test", "validation"] as const).map((value) => {
                const active = split === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSplit(value)}
                    aria-pressed={active}
                    className={`relative min-w-28 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${active ? "text-text" : "text-muted hover:text-text"}`}
                  >
                    {active && <motion.span layoutId="split-tab" className="absolute inset-0 rounded-lg bg-primary/10 shadow-sm" transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }} />}
                    <span className="relative z-10 capitalize">{value}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div role="status" className="rounded-2xl border border-warning/30 bg-warning/5 p-5">
              <h2 className="font-semibold text-warning">Exported evaluation data is missing</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                The result views read the project’s frozen evaluation tables through static JSON. Run{" "}
                <code className="rounded bg-background px-1.5 py-0.5 text-text">python -m ml.export_web</code> once the collected dataset is available.
              </p>
              <p className="mt-2 break-all text-xs text-muted">{error}</p>
            </div>
          )}

          {rows.length > 0 && (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={split}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
                className="space-y-6"
              >
                <Reveal><ResultsOverview rows={primaryRows} /></Reveal>
                <Reveal delay={0.04}><DetectorComparison rows={primaryRows} /></Reveal>
                <div className="grid gap-5 xl:grid-cols-2">
                  <Reveal><DelayChart rows={primaryRows} /></Reveal>
                  <Reveal delay={0.06}>
                    <section className="lp-panel-interactive h-full rounded-2xl border border-border bg-surface/80 p-5 shadow-lg shadow-black/10">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="font-semibold">Per-family detection</h2>
                          <p className="mt-1 text-sm text-muted">Detection rate on hang runs (B2, M2, M3); false alarms for the healthy-only family.</p>
                        </div>
                        <span className="rounded-lg border border-border bg-background p-2 font-mono text-xs text-secondary">{families.length} FAMILIES</span>
                      </div>
                      <div className="mt-5 max-h-[440px] space-y-4 overflow-auto pr-1">
                        {families.map((family) => {
                          const allRows = rows.filter((row) => row.scope === family);
                          const healthyOnly = allRows.every((row) => row.hangRuns === 0);
                          // a healthy-only family (blocked_on_io) has no hangs to detect: show false alarms per detector instead
                          const familyRows = healthyOnly ? allRows : allRows.filter((row) => ["B2", "M2", "M3"].includes(row.detector));
                          return (
                            <div key={family} className="border-b border-border/70 pb-4 last:border-0">
                              <h3 className="mb-3 text-sm font-medium">{familyLabel(family)}{healthyOnly && " "}{healthyOnly && <span className="ml-2 text-xs font-normal text-muted">healthy runs only · false alarms per detector ({allRows[0]?.runs ?? 0} runs)</span>}</h3>
                              <div className="grid gap-2.5">
                                {familyRows.map((row) => {
                                  const value = healthyOnly ? (row.runs ? row.faHealthy / row.runs : 0) : row.detectionRate ?? 0;
                                  return (
                                  <div key={row.detector} className="flex items-center gap-2 text-xs">
                                    <span className="w-8 font-mono font-semibold text-secondary">{row.detector}</span>
                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                                      <motion.div
                                        className={`h-full rounded-full bg-gradient-to-r ${healthyOnly ? "from-danger/70 to-danger" : "from-success/70 to-success"}`}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${value * 100}%` }}
                                        transition={{ duration: 0.65, ease: "easeOut" }}
                                      />
                                    </div>
                                    <span className="w-32 text-right tabular-nums text-muted">
                                      {healthyOnly ? `${row.faHealthy} false alarm${row.faHealthy === 1 ? "" : "s"}` : `${row.detected}/${row.hangRuns} · ${formatPercent(row.detectionRate)}`}
                                    </span>
                                  </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </Reveal>
                </div>
                <p className="text-xs leading-5 text-muted">
                  Metrics are computed from the project’s benchmark runs. Delays and false alarms use detector-specific evaluation rules; see Method for definitions and limitations.
                </p>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
