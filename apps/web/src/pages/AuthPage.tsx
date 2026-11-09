import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { Badge } from "@/components/common/ui";
import { Emblem } from "@/components/brand/Emblem";
import { ParticleField } from "@/components/grimoire/ParticleField";

type Mode = "signin" | "register" | "guest";

const TABS: Array<{ key: Mode; label: string }> = [
  { key: "signin", label: "Sign in" },
  { key: "register", label: "Create account" },
  { key: "guest", label: "Continue as guest" },
];

const AGE_BANDS = [
  { value: "adult", label: "Adult" },
  { value: "teen", label: "Teen" },
  { value: "child", label: "Child" },
] as const;

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [ageBand, setAgeBand] = useState<(typeof AGE_BANDS)[number]["value"]>("adult");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    const state = location.state as { from?: string } | null;
    return state?.from && state.from !== "/auth" ? state.from : "/";
  }, [location.state]);

  const passwordIssue = useMemo(() => {
    if (mode !== "register" || !password) return null;
    if (password.length < 8) return "Use at least 8 characters.";
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return "Mix letters and numbers.";
    return null;
  }, [mode, password]);

  const auth = useMutation({
    mutationFn: async () => {
      if (mode === "signin") return api.login(email.trim(), password);
      if (mode === "guest") {
        return api.guest(displayName.trim() || "Guest Traveler", ageBand === "child" ? "adult" : ageBand);
      }
      return api.register({
        email: email.trim(),
        password,
        display_name: displayName.trim(),
        age_band: ageBand,
        guardian_email: ageBand === "child" ? guardianEmail.trim() : undefined,
      });
    },
    onSuccess: (response) => {
      queryClient.clear();
      setSession(response.access_token, response.user);
      navigate(redirectTo, { replace: true });
    },
    onError: (err: Error) => {
      setError(err instanceof ApiError ? err.detail : err.message);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (mode === "register") {
      if (password !== confirmPassword) {
        setError("The passwords do not match.");
        return;
      }
      if (passwordIssue) {
        setError(passwordIssue);
        return;
      }
      if (ageBand === "child" && !guardianEmail.trim()) {
        setError("A parent or guardian email is required for a child account.");
        return;
      }
    }
    if (mode !== "guest" && (!email.trim() || !password)) {
      setError("Enter your email and password.");
      return;
    }
    auth.mutate();
  }

  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row">
      {/* Invocation side */}
      <div className="relative flex flex-1 flex-col justify-between overflow-hidden border-b border-line/60 px-6 py-8 lg:border-b-0 lg:border-e lg:px-12 lg:py-12">
        <ParticleField />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.05]">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Emblem size={620} />
          </div>
        </div>
        <div className="relative">
          <div className="flex items-center gap-3">
            <Emblem size={42} glow />
            <div>
              <p className="font-display text-lg tracking-[0.34em] text-parchment">ASTA</p>
              <p className="text-[0.56rem] uppercase tracking-[0.24em] text-ash/70">Intelligence grimoire</p>
            </div>
          </div>
        </div>

        <div className="relative mx-auto max-w-lg py-10 text-center lg:py-0 lg:text-start">
          <Badge tone="gold">
            <Sparkles size={11} /> Autonomous System for Task Automation
          </Badge>
          <h1 className="mt-5 font-display text-3xl leading-tight text-balance text-parchment sm:text-4xl">
            Your intelligence.
            <br />
            <span className="bg-gradient-to-r from-gold via-parchment to-ember bg-clip-text text-transparent">
              Your possibilities.
            </span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-ash">
            One intelligence for learning, work, creation and everyday life. Twelve specialist agents, one Brain, and a
            Guardian that keeps consequential actions behind your approval.
          </p>
          <div className="mt-6 grid gap-2 text-start sm:grid-cols-2">
            {[
              "Local-first model routing",
              "Approval-gated actions",
              "Inspectable agent activity",
              "Memory you control",
            ].map((item) => (
              <p key={item} className="flex items-center gap-2 rounded-lg border border-line/60 bg-white/[0.02] px-2.5 py-2 text-[0.68rem] text-ash">
                <Check size={12} className="shrink-0 text-success" /> {item}
              </p>
            ))}
          </div>
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-2 text-[0.6rem] uppercase tracking-[0.18em] text-ash/40">
          <span>The magic is in the experience</span>
          <span>The engineering is real</span>
        </div>
      </div>

      {/* Form side */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="panel grimoire-corners p-6 sm:p-7">
            <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-coal/60 p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setMode(tab.key);
                    setError(null);
                    if (tab.key === "guest" && ageBand === "child") setAgeBand("adult");
                  }}
                  aria-pressed={mode === tab.key}
                  className={cn(
                    "flex-1 rounded-md px-2 py-2 text-[0.68rem] transition-colors",
                    mode === tab.key
                      ? "bg-gradient-to-b from-elevated to-coal text-parchment shadow-sm"
                      : "text-ash hover:text-parchment",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-5">
              <h2 className="font-display text-xl text-parchment">
                {mode === "signin" ? "Open your grimoire" : mode === "register" ? "Inscribe a new account" : "Walk in as a guest"}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ash">
                {mode === "signin"
                  ? "Your conversations, documents and approved memory wait on the other side."
                  : mode === "register"
                    ? "A permanent identity for your conversations, tasks and knowledge."
                    : "Try the full workspace immediately. Guest data is temporary and cannot be upgraded in place."}
              </p>
            </div>

            <form className="mt-5 space-y-3" onSubmit={submit}>
              {(mode === "register" || mode === "guest") && (
                <div>
                  <label htmlFor="display-name" className="eyebrow">
                    Display name
                  </label>
                  <div className="relative mt-1.5">
                    <UserRound size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ash/60" />
                    <input
                      id="display-name"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder={mode === "guest" ? "Guest Traveler" : "How should ASTA address you?"}
                      className="input ps-9"
                      autoComplete="name"
                      maxLength={80}
                    />
                  </div>
                </div>
              )}

              {mode !== "guest" && (
                <>
                  <div>
                    <label htmlFor="email" className="eyebrow">
                      Email
                    </label>
                    <div className="relative mt-1.5">
                      <Mail size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ash/60" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        className="input ps-9"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="eyebrow">
                      Password
                    </label>
                    <div className="relative mt-1.5">
                      <KeyRound size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ash/60" />
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder={mode === "register" ? "At least 8 characters, letters and numbers" : "Your password"}
                        className="input px-9"
                        autoComplete={mode === "register" ? "new-password" : "current-password"}
                        required
                        minLength={mode === "register" ? 8 : undefined}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-ash hover:text-parchment"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {passwordIssue && <p className="mt-1 text-[0.62rem] text-gold/80">{passwordIssue}</p>}
                  </div>
                </>
              )}

              {mode === "register" && (
                <div>
                  <label htmlFor="confirm-password" className="eyebrow">
                    Confirm password
                  </label>
                  <input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repeat your password"
                    className="input mt-1.5"
                    autoComplete="new-password"
                  />
                </div>
              )}

              {mode !== "signin" && (
                <div>
                  <span className="eyebrow">Age group</span>
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    {AGE_BANDS.map((band) => {
                      const disabled = mode === "guest" && band.value === "child";
                      return (
                        <button
                          key={band.value}
                          type="button"
                          disabled={disabled}
                          onClick={() => setAgeBand(band.value)}
                          aria-pressed={ageBand === band.value}
                          className={cn(
                            "rounded-lg border px-2 py-2 text-[0.68rem] transition-colors",
                            ageBand === band.value
                              ? "border-gold/40 bg-gold/10 text-gold"
                              : "border-line text-ash hover:text-parchment",
                            disabled && "cursor-not-allowed opacity-40",
                          )}
                        >
                          {band.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {mode === "register" && ageBand === "child" && (
                <div className="rounded-lg border border-gold/25 bg-gold/[0.04] p-3">
                  <label htmlFor="guardian-email" className="eyebrow">
                    Parent or guardian email
                  </label>
                  <input
                    id="guardian-email"
                    type="email"
                    value={guardianEmail}
                    onChange={(event) => setGuardianEmail(event.target.value)}
                    placeholder="guardian@example.com"
                    className="input mt-1.5"
                    required
                  />
                  <p className="mt-1.5 flex items-start gap-1.5 text-[0.62rem] leading-relaxed text-gold/80">
                    <TriangleAlert size={11} className="mt-0.5 shrink-0" />
                    Child accounts are not safety-certified in this release. Guardian consent and an independent safety
                    review are required before child-facing use.
                  </p>
                </div>
              )}

              {error && (
                <div
                  className="flex items-start gap-2 rounded-lg border border-danger/35 bg-danger/[0.08] px-3 py-2.5 text-xs text-danger"
                  role="alert"
                >
                  <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="btn-primary w-full" disabled={auth.isPending}>
                {auth.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : mode === "guest" ? (
                  <Sparkles size={15} />
                ) : (
                  <ArrowRight size={15} />
                )}
                {mode === "signin" ? "Sign in" : mode === "register" ? "Create account" : "Enter as guest"}
              </button>
            </form>

            <p className="mt-4 flex items-start gap-1.5 text-[0.62rem] leading-relaxed text-ash/60">
              <ShieldCheck size={11} className="mt-0.5 shrink-0 text-gold/70" />
              Your conversations stay attached to your account. Memory is opt-in and editable. ASTA is an AI and can be
              wrong — verify anything important.
            </p>
          </div>

          <p className="mt-4 text-center text-[0.65rem] text-ash/50">
            By continuing you accept that this is a local-first deployment with honest limitations. Demo responses are
            always labelled; no fact is invented to fill the screen.
          </p>
        </div>
      </div>
    </div>
  );
}
