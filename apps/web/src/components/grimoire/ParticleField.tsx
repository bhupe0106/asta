import { cn } from "@/lib/utils";

/** Subtle drifting embers. Purely decorative, disabled by reduced-motion CSS. */
export function ParticleField({ className }: { className?: string }) {
  const embers = [
    { left: "8%", top: "18%", delay: "0s", duration: "11s", size: 2 },
    { left: "21%", top: "72%", delay: "2.2s", duration: "13s", size: 1.5 },
    { left: "37%", top: "38%", delay: "4.4s", duration: "10s", size: 1 },
    { left: "52%", top: "84%", delay: "1.1s", duration: "14s", size: 2 },
    { left: "68%", top: "27%", delay: "3.6s", duration: "12s", size: 1.5 },
    { left: "79%", top: "63%", delay: "5.2s", duration: "15s", size: 1 },
    { left: "91%", top: "41%", delay: "2.8s", duration: "11s", size: 2 },
    { left: "13%", top: "48%", delay: "6.4s", duration: "16s", size: 1 },
  ];
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {embers.map((ember, index) => (
        <span
          key={index}
          className="absolute rounded-full bg-ember/70 animate-ember-drift motion-reduce:animate-none"
          style={{
            left: ember.left,
            top: ember.top,
            width: ember.size,
            height: ember.size,
            animationDelay: ember.delay,
            animationDuration: ember.duration,
            boxShadow: "0 0 6px rgba(181,44,67,0.8)",
          }}
        />
      ))}
    </div>
  );
}
