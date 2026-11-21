interface PlaybackControlsProps {
  playing: boolean;
  onToggle: () => void;
  onReset: () => void;
  speed: number;
  onSpeed: (speed: number) => void;
}

const controlClass = "min-h-10 rounded-lg border border-border px-3 text-sm font-medium text-text transition hover:border-primary/60 hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function PlaybackControls({ playing, onToggle, onReset, speed, onSpeed }: PlaybackControlsProps) {
  return (
    <div className="flex flex-wrap items-end gap-2" aria-label="Replay playback controls">
      <button type="button" className={controlClass} onClick={onToggle} aria-label={playing ? "Pause replay" : "Play replay"}>
        {playing ? "Pause" : "Play"}
      </button>
      <button type="button" className={controlClass} onClick={onReset}>Reset</button>
      <label className="grid gap-1 text-xs text-muted">
        <span>Speed</span>
        <select className={`${controlClass} bg-background`} value={speed} onChange={(event) => onSpeed(Number(event.currentTarget.value))}>
          {[0.5, 1, 2, 4].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
        </select>
      </label>
    </div>
  );
}
