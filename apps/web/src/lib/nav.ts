import {
  BookOpenText,
  Bot,
  BriefcaseBusiness,
  Cog,
  GraduationCap,
  Home,
  LibraryBig,
  ListChecks,
  MessageSquarePlus,
  PenLine,
  Plug,
  Search,
  Sparkles,
  UserRound,
  BrainCircuit,
} from "lucide-react";

export type NavItem = {
  to: string;
  key: string;
  icon: typeof Home;
  end?: boolean;
  accent?: string;
};

export const primaryNav: NavItem[] = [
  { to: "/", key: "nav.home", icon: Home, end: true },
  { to: "/search", key: "nav.search", icon: Search },
  { to: "/agents", key: "nav.agents", icon: BrainCircuit },
  { to: "/tasks", key: "nav.tasks", icon: ListChecks },
  { to: "/knowledge", key: "nav.knowledge", icon: LibraryBig },
  { to: "/memory", key: "nav.memory", icon: Bot },
];

export const experienceNav: NavItem[] = [
  { to: "/learn", key: "nav.learn", icon: GraduationCap, accent: "#C6A66A" },
  { to: "/work", key: "nav.work", icon: BriefcaseBusiness, accent: "#7957C8" },
  { to: "/create", key: "nav.create", icon: PenLine, accent: "#B52C43" },
  { to: "/companion", key: "nav.companion", icon: Sparkles, accent: "#45A77B" },
];

export const footerNav: NavItem[] = [
  { to: "/integrations", key: "nav.integrations", icon: Plug },
  { to: "/settings", key: "nav.settings", icon: Cog },
  { to: "/profile", key: "nav.profile", icon: UserRound },
];

export const pageTitles: Record<string, string> = {
  "/": "Home",
  "/search": "Search",
  "/agents": "Agent workspace",
  "/tasks": "Tasks",
  "/knowledge": "Knowledge",
  "/memory": "Memory",
  "/integrations": "Integrations",
  "/settings": "Settings",
  "/profile": "Profile",
  "/learn": "ASTA Learn",
  "/work": "ASTA Work",
  "/create": "ASTA Create",
  "/companion": "ASTA Companion",
};

export const icons = {
  BookOpenText,
  MessageSquarePlus,
};
