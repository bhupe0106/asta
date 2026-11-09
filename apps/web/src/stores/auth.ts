import { create } from "zustand";
import { api, getToken, setToken, type User } from "@/lib/api";

interface AuthState {
  user: User | null;
  status: "idle" | "loading" | "authenticated" | "anonymous";
  setSession: (token: string, user: User) => void;
  clear: () => void;
  hydrate: () => Promise<void>;
  setUser: (user: User) => void;
}

const CACHED_USER = "asta.user";

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(CACHED_USER);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: readCachedUser(),
  status: getToken() ? "loading" : "anonymous",
  setSession: (token, user) => {
    setToken(token);
    localStorage.setItem(CACHED_USER, JSON.stringify(user));
    set({ user, status: "authenticated" });
  },
  setUser: (user) => {
    localStorage.setItem(CACHED_USER, JSON.stringify(user));
    set({ user });
  },
  clear: () => {
    setToken(null);
    localStorage.removeItem(CACHED_USER);
    set({ user: null, status: "anonymous" });
  },
  hydrate: async () => {
    if (!getToken()) {
      set({ status: "anonymous", user: null });
      return;
    }
    set({ status: "loading" });
    try {
      const user = await api.me();
      localStorage.setItem(CACHED_USER, JSON.stringify(user));
      set({ user, status: "authenticated" });
    } catch {
      setToken(null);
      localStorage.removeItem(CACHED_USER);
      set({ user: null, status: "anonymous" });
    }
  },
}));
