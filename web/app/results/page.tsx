"use client";

import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import ResultsOverview from "@/components/results/ResultsOverview";
import DetectorComparison from "@/components/results/DetectorComparison";
import DelayChart from "@/components/results/DelayChart";
import { loadResults, overallRows } from "@/lib/data";
import type { ResultRow } from "@/lib/types";
import { formatPercent } from "@/lib/utils";

export default function ResultsPage() {
  const [split, setSplit] = useState<"test" | "validation">("test");
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { loadResults(split).then((data) => { setRows(data.rows); setError(""); }).catch((e: Error) => setError(e.message)); }, [split]);
  const primaryRows = useMemo(() => overallRows(rows), [rows]);
  const families = useMemo(() => [...new Set(rows.filter((row) => row.scope !== "overall").map((row) => row.scope))].sort(), [rows]);
  return <><Navbar/><main className="flex-1 bg-background text-text"><header className="border-b border-border bg-[radial-gradient(ellipse_at_80%_10%,rgba(56,189,248,0.12),transparent_50%)]"><div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-14"><p className="text-xs font-semibold tracking-[0.18em] text-success">BENCHMARK EVALUATION</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Results you can inspect.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Compare detection rate, delay, false alarms and precision-recall performance across frozen detector configurations.</p></div></header>
    <div className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-6 sm:py-10"><div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-sm text-muted">Choose a split. Validation was used to select thresholds; the test split reports held-out performance.</p><div role="group" aria-label="Evaluation split" className="flex rounded-lg border border-border bg-surface p-1"><button onClick={() => setSplit("test")} aria-pressed={split === "test"} className={`rounded-md px-4 py-2 text-sm ${split === "test" ? "bg-primary text-white" : "text-muted hover:text-text"}`}>Test</button><button onClick={() => setSplit("validation")} aria-pressed={split === "validation"} className={`rounded-md px-4 py-2 text-sm ${split === "validation" ? "bg-primary text-white" : "text-muted hover:text-text"}`}>Validation</button></div></div>
      {error && <div role="status" className="rounded-xl border border-warning/30 bg-warning/5 p-5"><h2 className="font-semibold text-warning">Exported evaluation data is missing</h2><p className="mt-2 text-sm leading-6 text-muted">The result views read the project’s frozen evaluation tables through static JSON. Run <code className="rounded bg-background px-1.5 py-0.5 text-text">python -m ml.export_web</code> once the collected dataset is available.</p><p className="mt-2 break-all text-xs text-muted">{error}</p></div>}
      {rows.length > 0 && <><ResultsOverview rows={primaryRows}/><DetectorComparison rows={primaryRows}/><div className="grid gap-5 xl:grid-cols-2"><DelayChart rows={primaryRows}/><section className="rounded-xl border border-border bg-surface p-5"><h2 className="font-semibold">Per-family detection</h2><p className="mt-1 text-sm text-muted">Shows the observed rate alongside the count of hang runs.</p><div className="mt-5 max-h-[440px] space-y-4 overflow-auto">{families.map((family) => { const fr = rows.filter((r) => r.scope === family && ["B2", "M2", "M3"].includes(r.detector)); return <div key={family} className="border-b border-border/70 pb-3"><h3 className="mb-2 text-sm font-medium capitalize">{family.replaceAll("_", " ")}</h3><div className="grid gap-1.5">{fr.map((r) => <div key={r.detector} className="flex items-center gap-2 text-xs"><span className="w-8 font-mono text-secondary">{r.detector}</span><div className="h-2 flex-1 overflow-hidden rounded bg-background"><div className="h-full rounded bg-success" style={{ width: `${(r.detectionRate ?? 0) * 100}%` }}/></div><span className="w-28 text-right text-muted">{r.detected}/{r.hangRuns} · {formatPercent(r.detectionRate)}</span></div>)}</div></div>; })}</div></section></div><p className="text-xs leading-5 text-muted">Metrics are computed from the project’s benchmark runs. Delays and false alarms use detector-specific evaluation rules; see Method for definitions and limitations.</p></>}
    </div></main><Footer/></>;
}
