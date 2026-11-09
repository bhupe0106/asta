import { cn } from "@/lib/utils";
import { Emblem } from "./Emblem";

export function Wordmark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Emblem size={compact ? 28 : 34} glow />
      {!compact && (
        <div className="min-w-0">
          <div className="font-display text-lg font-semibold tracking-[0.28em] text-parchment">ASTA</div>
          <div className="text-[0.58rem] uppercase tracking-[0.24em] text-ash/80">Intelligence grimoire</div>
        </div>
      )}
    </div>
  );
}
