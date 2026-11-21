"use client";

import { motion } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";

export default function PlaybackControls({ playing, onToggle, onReset, speed, onSpeed, disabled = false }: {
  playing: boolean; onToggle: () => void; onReset: () => void; speed: number; onSpeed: (speed: number) => void; disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
      <motion.button whileTap={{ scale: 0.96 }} disabled={disabled} onClick={onToggle} aria-label={playing ? "Pause replay" : "Play replay"} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-md shadow-primary/20 transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:cursor-not-allowed disabled:opacity-40">
        {playing ? <Pause size={16}/> : <Play size={16}/>} {playing ? "Pause" : "Play"}
      </motion.button>
      <motion.button whileTap={{ scale: 0.96 }} disabled={disabled} onClick={onReset} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background/60 px-3 text-sm text-text transition hover:border-secondary/30 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:cursor-not-allowed disabled:opacity-40"><RotateCcw size={15}/> Reset</motion.button>
      <label className="ml-auto flex items-center gap-2 text-xs text-muted">Speed <select value={speed} onChange={(event) => onSpeed(Number(event.target.value))} className="rounded-lg border border-border bg-background px-2.5 py-2 text-text outline-none transition focus:border-secondary/50 focus:ring-2 focus:ring-secondary/15"><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label>
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border/70 pt-2.5 font-mono text-[10px] text-muted">
        <span><kbd className="rounded border border-border bg-background px-1 py-0.5 text-text">Space</kbd> play / pause</span>
        <span><kbd className="rounded border border-border bg-background px-1 py-0.5 text-text">←</kbd> <kbd className="rounded border border-border bg-background px-1 py-0.5 text-text">→</kbd> step</span>
        <span><kbd className="rounded border border-border bg-background px-1 py-0.5 text-text">R</kbd> reset</span>
      </p>
    </div>
  );
}
