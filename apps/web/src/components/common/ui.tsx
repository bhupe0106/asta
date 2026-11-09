import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Loader2, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui";

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn("animate-spin text-ash", className)} aria-hidden />;
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "crimson" | "success" | "warning" | "danger" | "arcane";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-line bg-white/[0.03] text-ash",
    gold: "border-gold/30 bg-gold/10 text-gold",
    crimson: "border-ember/30 bg-ember/10 text-ember",
    success: "border-success/30 bg-success/10 text-success",
    warning: "border-gold/40 bg-gold/10 text-gold",
    danger: "border-danger/40 bg-danger/10 text-danger",
    arcane: "border-arcane/40 bg-arcane/10 text-[#a68fe0]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-medium tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({ status, className }: { status: string; className?: string }) {
  const tone =
    status === "available" || status === "ok" || status === "completed" || status === "connected" || status === "healthy"
      ? "bg-success shadow-[0_0_8px_rgba(69,167,123,0.7)]"
      : status === "degraded" || status === "running" || status === "pending" || status === "waiting_approval"
        ? "bg-gold shadow-[0_0_8px_rgba(198,166,106,0.6)]"
        : status === "failed" || status === "unavailable" || status === "error"
          ? "bg-danger shadow-[0_0_8px_rgba(214,74,86,0.6)]"
          : "bg-ash/60";
  return <span aria-hidden className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", tone, className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-elevated/60 text-gold">
          {icon}
        </div>
      )}
      <h3 className="font-display text-base text-parchment">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm leading-relaxed text-ash">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="mt-1 font-display text-xl text-parchment">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-ash">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4 py-3", disabled && "cursor-not-allowed opacity-50")}>
      <span>
        <span className="block text-sm text-parchment">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-ash">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors focus-ring",
          checked ? "border-ember/60 bg-ember/80" : "border-line bg-elevated",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-parchment transition-all",
            checked ? "left-[1.35rem]" : "left-0.5",
          )}
          style={{ height: "1.05rem", width: "1.05rem" }}
        />
      </button>
    </label>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !ref.current) return;
      const focusables = ref.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-abyss/80 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "panel grimoire-corners relative max-h-[88vh] w-full overflow-y-auto p-6 outline-none",
              wide ? "max-w-2xl" : "max-w-md",
            )}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.22 }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="font-display text-lg text-parchment">{title}</h2>
              <button onClick={onClose} className="btn-quiet -mr-2 -mt-2 p-2" aria-label="Close dialog">
                <X size={16} />
              </button>
            </div>
            {children}
            {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ToastHost() {
  const toasts = useUIStore((s) => s.toasts);
  const dismiss = useUIStore((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-full max-w-sm flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20 }}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border bg-elevated/95 p-3.5 shadow-grimoire backdrop-blur",
              toast.tone === "error" ? "border-danger/40" : toast.tone === "success" ? "border-success/40" : "border-line",
            )}
          >
            <span className="mt-0.5">
              {toast.tone === "error" ? (
                <AlertTriangle size={16} className="text-danger" />
              ) : (
                <Check size={16} className="text-success" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-parchment">{toast.title}</p>
              {toast.description && <p className="mt-0.5 text-xs leading-relaxed text-ash">{toast.description}</p>}
            </div>
            <button onClick={() => dismiss(toast.id)} className="text-ash hover:text-parchment" aria-label="Dismiss">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.7rem] text-ash transition-colors hover:bg-white/5 hover:text-parchment focus-ring"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

interface BoundaryProps {
  children: ReactNode;
}

interface BoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ASTA UI error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="panel max-w-md p-8 text-center">
            <AlertTriangle className="mx-auto mb-4 text-danger" size={28} />
            <h2 className="font-display text-lg text-parchment">This view failed to render</h2>
            <p className="mt-2 text-sm text-ash">
              The error was contained so the rest of ASTA keeps working. Reload the view or return home.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button className="btn-ghost" onClick={() => this.setState({ error: null })}>
                Try again
              </button>
              <a className="btn-primary" href="/">
                Return home
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
