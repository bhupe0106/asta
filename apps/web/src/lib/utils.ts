import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function relativeTime(iso: string): string {
  const date = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "The night is still young";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Welcome back";
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function experienceLabel(experience: string): string {
  return (
    { learn: "ASTA Learn", work: "ASTA Work", create: "ASTA Create", companion: "ASTA Companion" } as Record<
      string,
      string
    >
  )[experience] ?? "ASTA Companion";
}

export const EXPERIENCES = [
  {
    key: "learn",
    name: "Learn",
    tagline: "Understand deeply",
    description: "A tutor that adapts to your level, builds reasoning and never hands over answers without understanding.",
    icon: "GraduationCap",
    accent: "#C6A66A",
    prompts: [
      "Explain photosynthesis as if I am 12, step by step",
      "Quiz me on the causes of World War I",
      "Help me understand integration by parts",
    ],
  },
  {
    key: "work",
    name: "Work",
    tagline: "Move work forward",
    description: "Documents, data, reports and plans — with separation between personal and organisational knowledge.",
    icon: "BriefcaseBusiness",
    accent: "#7957C8",
    prompts: [
      "Summarise a report I attach and list the decisions it implies",
      "Turn my goal into a dependency-aware project plan",
      "Analyse my CSV and describe the key trends",
    ],
  },
  {
    key: "create",
    name: "Create",
    tagline: "Shape the idea",
    description: "Writing, storytelling, content and design direction with originality and rights respected.",
    icon: "PenLine",
    accent: "#B52C43",
    prompts: [
      "Draft a short brand story for a coffee roastery",
      "Brainstorm five original names for a study app",
      "Outline a presentation about dark matter",
    ],
  },
  {
    key: "companion",
    name: "Companion",
    tagline: "Think out loud",
    description: "Everyday conversation, organisation and planning with approved memory and a clear AI identity.",
    icon: "Sparkles",
    accent: "#45A77B",
    prompts: [
      "Help me plan my week around three priorities",
      "Explain compound interest in simple terms",
      "Remember that I prefer concise answers",
    ],
  },
] as const;

export function suggestionForExperience(experience: string): string[] {
  return [...(EXPERIENCES.find((e) => e.key === experience)?.prompts ?? EXPERIENCES[3].prompts)];
}
