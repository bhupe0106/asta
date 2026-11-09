import { create } from "zustand";

export type Toast = { id: string; title: string; description?: string; tone: "info" | "success" | "error" };

interface UIState {
  introSeen: boolean;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  paletteOpen: boolean;
  toasts: Toast[];
  markIntroSeen: () => void;
  toggleSidebar: () => void;
  setMobileNav: (open: boolean) => void;
  setPalette: (open: boolean) => void;
  toast: (title: string, options?: { description?: string; tone?: Toast["tone"] }) => void;
  dismiss: (id: string) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  introSeen: localStorage.getItem("asta.intro") === "seen",
  sidebarCollapsed: localStorage.getItem("asta.sidebar") === "collapsed",
  mobileNavOpen: false,
  paletteOpen: false,
  toasts: [],
  markIntroSeen: () => {
    localStorage.setItem("asta.intro", "seen");
    set({ introSeen: true });
  },
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    localStorage.setItem("asta.sidebar", next ? "collapsed" : "open");
    set({ sidebarCollapsed: next });
  },
  setMobileNav: (open) => set({ mobileNavOpen: open }),
  setPalette: (open) => set({ paletteOpen: open }),
  toast: (title, options) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { id, title, description: options?.description, tone: options?.tone ?? "info" }],
    }));
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 5200);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
