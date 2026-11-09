import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Emblem } from "@/components/brand/Emblem";
import { useUIStore } from "@/stores/ui";

export function GrimoireIntro({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const markIntroSeen = useUIStore((s) => s.markIntroSeen);
  const [opening, setOpening] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") complete();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function complete() {
    if (opening) return;
    setOpening(true);
    markIntroSeen();
    window.setTimeout(() => {
      setVisible(false);
      onComplete();
    }, reducedMotion ? 80 : 1150);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-abyss"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to ASTA"
        >
          {/* Grimoire covers */}
          <motion.div
            aria-hidden
            className="absolute inset-y-0 left-0 w-1/2 origin-left border-r border-gold/20"
            style={{
              background:
                "radial-gradient(ellipse at 100% 40%, rgba(139,30,45,0.35), transparent 60%), linear-gradient(135deg, #0d0e14, #15090d 60%, #08090d)",
            }}
            animate={opening ? { rotateY: -102 } : { rotateY: 0 }}
            transition={{ duration: reducedMotion ? 0.05 : 1.05, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.div
            aria-hidden
            className="absolute inset-y-0 right-0 w-1/2 origin-right border-l border-gold/20"
            style={{
              background:
                "radial-gradient(ellipse at 0% 40%, rgba(139,30,45,0.35), transparent 60%), linear-gradient(225deg, #0d0e14, #15090d 60%, #08090d)",
            }}
            animate={opening ? { rotateY: 102 } : { rotateY: 0 }}
            transition={{ duration: reducedMotion ? 0.05 : 1.05, ease: [0.22, 1, 0.36, 1] }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-rune-grid bg-rune-grid opacity-40"
            style={{ maskImage: "radial-gradient(ellipse at center, black, transparent 70%)" }}
          />

          <motion.div
            className="relative z-10 mx-6 flex max-w-lg flex-col items-center text-center"
            animate={opening ? { opacity: 0, scale: 0.96, filter: "blur(6px)" } : { opacity: 1 }}
            transition={{ duration: reducedMotion ? 0.05 : 0.5 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.1, ease: "easeOut" }}
            >
              <Emblem size={132} glow animated={!reducedMotion} />
            </motion.div>

            <motion.p
              className="eyebrow mt-8 text-gold/80"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              Autonomous System for Task Automation
            </motion.p>
            <motion.h1
              className="mt-3 font-display text-5xl font-semibold tracking-[0.32em] text-parchment sm:text-6xl"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              ASTA
            </motion.h1>
            <motion.p
              className="mt-4 max-w-md text-balance text-sm leading-relaxed text-ash"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {t("dashboard.tagline")} One intelligence for learning, work, creation and everyday life.
            </motion.p>

            <motion.button
              onClick={complete}
              className="btn-primary mt-9 px-6 py-3 text-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75 }}
              autoFocus
            >
              <Sparkles size={16} aria-hidden />
              {t("auth.welcome")}
              <ArrowRight size={16} aria-hidden />
            </motion.button>
            <p className="mt-4 text-[0.68rem] text-ash/60">Press Esc to skip · No account required to look around</p>
          </motion.div>

          <div className="pointer-events-none absolute bottom-6 left-0 right-0 text-center text-[0.62rem] uppercase tracking-[0.3em] text-ash/40">
            The magic is in the experience · The engineering is real
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
