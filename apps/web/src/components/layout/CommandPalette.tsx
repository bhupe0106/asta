import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Compass,
  CornerDownLeft,
  LibraryBig,
  ListChecks,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { experienceNav, footerNav, primaryNav } from "@/lib/nav";
import { useUIStore } from "@/stores/ui";
import { cn } from "@/lib/utils";

type Command = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
  group: string;
};

export function CommandPalette() {
  const open = useUIStore((s) => s.paletteOpen);
  const setOpen = useUIStore((s) => s.setPalette);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.conversations(),
    enabled: open,
  });

  const commands = useMemo<Command[]>(() => {
    const close = () => setOpen(false);
    const navItems = [...primaryNav, ...experienceNav, ...footerNav].map((item) => ({
      id: `nav-${item.to}`,
      label: item.key.replace("nav.", "").replace(/([A-Z])/g, " $1"),
      hint: item.to,
      icon: <item.icon size={16} />,
      group: "Navigate",
      run: () => {
        navigate(item.to);
        close();
      },
    }));
    const actions: Command[] = [
      {
        id: "new",
        label: "New conversation",
        icon: <Plus size={16} />,
        group: "Actions",
        run: () => {
          close();
          navigate("/chat");
        },
      },
      {
        id: "tasks",
        label: "Open task board",
        icon: <ListChecks size={16} />,
        group: "Actions",
        run: () => {
          navigate("/tasks");
          close();
        },
      },
      {
        id: "knowledge",
        label: "Ask your knowledge base",
        icon: <LibraryBig size={16} />,
        group: "Actions",
        run: () => {
          navigate("/knowledge");
          close();
        },
      },
      {
        id: "agents",
        label: "Inspect the agent circle",
        icon: <Compass size={16} />,
        group: "Actions",
        run: () => {
          navigate("/agents");
          close();
        },
      },
    ];
    const recent: Command[] = (conversations.data ?? []).slice(0, 8).map((conversation) => ({
      id: `conversation-${conversation.id}`,
      label: conversation.title,
      hint: conversation.experience,
      icon: <MessageSquare size={16} />,
      group: "Conversations",
      run: () => {
        navigate(`/chat/${conversation.id}`);
        close();
      },
    }));
    return [...actions, ...recent, ...navItems];
  }, [conversations.data, navigate, setOpen]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands.slice(0, 10);
    const q = query.toLowerCase();
    return commands.filter((command) => `${command.label} ${command.hint ?? ""} ${command.group}`.toLowerCase().includes(q)).slice(0, 12);
  }, [commands, query]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    window.setTimeout(() => inputRef.current?.focus(), 40);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((index) => Math.min(index + 1, filtered.length - 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((index) => Math.max(index - 1, 0));
      }
      if (event.key === "Enter") {
        event.preventDefault();
        filtered[active]?.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, active, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[75] flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-abyss/85 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="panel grimoire-corners relative w-full max-w-xl overflow-hidden"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <Search size={16} className="text-gold" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search conversations, pages and actions…"
                className="w-full bg-transparent text-sm text-parchment placeholder:text-ash/60 focus:outline-none"
                aria-label="Command search"
              />
              <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[0.6rem] text-ash/60">Esc</kbd>
            </div>
            <div className="max-h-[52vh] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-ash">
                  Nothing matches “{query}”.
                  <button
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-line py-2 text-xs text-parchment hover:border-gold/30"
                    onClick={() => {
                      navigate("/search");
                      setOpen(false);
                    }}
                  >
                    <Sparkles size={14} /> Search everything
                  </button>
                </div>
              )}
              {filtered.map((command, index) => (
                <button
                  key={command.id}
                  onMouseEnter={() => setActive(index)}
                  onClick={command.run}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    index === active ? "bg-ember/15 text-parchment" : "text-ash hover:bg-white/5",
                  )}
                >
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-md border border-line bg-elevated/60", index === active && "text-gold")}>
                    {command.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate capitalize">{command.label}</span>
                    <span className="text-[0.65rem] uppercase tracking-wider text-ash/50">{command.group}</span>
                  </span>
                  {index === active ? <CornerDownLeft size={14} className="text-gold" /> : <ArrowRight size={14} className="opacity-0" />}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[0.62rem] text-ash/60">
              <span>↑ ↓ to move · Enter to open</span>
              <span className="flex items-center gap-1"><Sparkles size={11} /> ASTA</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
