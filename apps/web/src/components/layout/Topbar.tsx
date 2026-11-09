import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu, Search, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { pageTitles, experienceNav } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { Badge, StatusDot } from "@/components/common/ui";

export function Topbar() {
  const { t } = useTranslation();
  const location = useLocation();
  const setMobileNav = useUIStore((s) => s.setMobileNav);
  const setPalette = useUIStore((s) => s.setPalette);
  const user = useAuthStore((s) => s.user);

  const models = useQuery({ queryKey: ["models"], queryFn: api.models, refetchInterval: 60_000, staleTime: 30_000 });
  const ollama = models.data?.providers.find((p) => p.key === "ollama");
  const demo = models.data?.providers.find((p) => p.key === "demo");

  const experience = experienceNav.find((item) => location.pathname.startsWith(item.to));
  const title = location.pathname.startsWith("/chat")
    ? "Conversation"
    : (experience && t(experience.key)) || pageTitles[location.pathname] || "ASTA";

  const modelLabel = ollama?.healthy
    ? `Ollama · ${ollama.model ?? "local"}`
    : demo?.healthy
      ? "Demo composer"
      : "No model";

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-abyss/70 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setMobileNav(true)}
            className="btn-quiet p-2 md:hidden"
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.2em] text-ash/70">
              <span className="hidden sm:inline">ASTA</span>
              <span className="hidden sm:inline text-gold/40">/</span>
              <span className="text-ash">Grimoire</span>
            </div>
            <h1 className="truncate font-display text-sm tracking-wide text-parchment">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPalette(true)}
            className="hidden items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-3 py-1.5 text-xs text-ash transition-colors hover:border-gold/30 hover:text-parchment sm:flex focus-ring"
            aria-label="Search ASTA"
          >
            <Search size={13} />
            <span>Search</span>
            <kbd className="ml-2 rounded border border-line bg-elevated px-1.5 py-0.5 font-mono text-[0.6rem] text-ash/70">
              Ctrl K
            </kbd>
          </button>

          <Link
            to="/settings"
            className="hidden sm:block"
            aria-label={`Intelligence status: ${modelLabel}`}
            title={modelLabel}
          >
            <Badge tone={ollama?.healthy ? "success" : demo?.healthy ? "warning" : "danger"} className="whitespace-nowrap">
              <StatusDot status={ollama?.healthy ? "available" : demo?.healthy ? "degraded" : "failed"} />
              {modelLabel}
            </Badge>
          </Link>

          <Link
            to="/profile"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-gradient-to-br from-crimson/80 to-arcane/70 text-[0.68rem] font-semibold text-parchment focus-ring"
            aria-label="Your profile"
            title={user?.display_name}
          >
            {user?.is_guest ? <Sparkles size={14} /> : (user?.display_name ?? "A").slice(0, 1).toUpperCase()}
          </Link>
        </div>
      </div>
      <div className={cn("h-px w-full bg-gradient-to-r from-transparent via-gold/15 to-transparent")} />
    </header>
  );
}
