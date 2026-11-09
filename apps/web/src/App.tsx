import { lazy, Suspense, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary, Spinner } from "@/components/common/ui";
import { Emblem } from "@/components/brand/Emblem";
import { ParticleField } from "@/components/grimoire/ParticleField";
import { GrimoireIntro } from "@/components/grimoire/GrimoireIntro";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { AuthPage } from "@/pages/AuthPage";

const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ExperiencePage = lazy(() =>
  import("@/pages/ExperiencePage").then((module) => ({ default: module.ExperiencePage })),
);
const ChatPage = lazy(() => import("@/pages/ChatPage").then((module) => ({ default: module.ChatPage })));
const AgentsPage = lazy(() => import("@/pages/AgentsPage").then((module) => ({ default: module.AgentsPage })));
const TasksPage = lazy(() => import("@/pages/TasksPage").then((module) => ({ default: module.TasksPage })));
const KnowledgePage = lazy(() => import("@/pages/KnowledgePage").then((module) => ({ default: module.KnowledgePage })));
const MemoryPage = lazy(() => import("@/pages/MemoryPage").then((module) => ({ default: module.MemoryPage })));
const IntegrationsPage = lazy(() =>
  import("@/pages/IntegrationsPage").then((module) => ({ default: module.IntegrationsPage })),
);
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const ProfilePage = lazy(() => import("@/pages/ProfilePage").then((module) => ({ default: module.ProfilePage })));
const SearchPage = lazy(() => import("@/pages/SearchPage").then((module) => ({ default: module.SearchPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    },
    mutations: { retry: 0 },
  },
});

function BootScreen() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <ParticleField />
      <div className="relative flex flex-col items-center">
        <Emblem size={92} glow animated />
        <p className="mt-6 font-display text-sm tracking-[0.34em] text-parchment">ASTA</p>
        <p className="mt-2 text-[0.62rem] uppercase tracking-[0.24em] text-ash/60">Opening the grimoire</p>
      </div>
    </div>
  );
}

function RouteFallback() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center" role="status" aria-label="Loading view">
      <Spinner size={22} />
    </div>
  );
}

function ProtectedShell() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === "loading" || status === "idle") return <BootScreen />;
  if (status !== "authenticated") {
    return <Navigate to="/auth" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <AppShell />;
}

function AppFrame() {
  const status = useAuthStore((s) => s.status);
  const clear = useAuthStore((s) => s.clear);
  const hydrate = useAuthStore((s) => s.hydrate);
  const navigate = useNavigate();
  const introSeen = useUIStore((s) => s.introSeen);
  const [introDone, setIntroDone] = useState(introSeen);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const onUnauthorized = () => {
      clear();
      if (window.location.pathname !== "/auth") {
        navigate("/auth", { replace: true, state: { from: `${window.location.pathname}${window.location.search}` } });
      }
    };
    window.addEventListener("asta:unauthorized", onUnauthorized);
    return () => window.removeEventListener("asta:unauthorized", onUnauthorized);
  }, [clear, navigate]);

  return (
    <>
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route
              path="/auth"
              element={status === "authenticated" ? <Navigate to="/" replace /> : <AuthPage />}
            />
            <Route element={<ProtectedShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/knowledge" element={<KnowledgePage />} />
              <Route path="/memory" element={<MemoryPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/learn" element={<ExperiencePage />} />
              <Route path="/work" element={<ExperiencePage />} />
              <Route path="/create" element={<ExperiencePage />} />
              <Route path="/companion" element={<ExperiencePage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/chat/:id" element={<ChatPage />} />
            </Route>
            <Route path="*" element={<Navigate to={status === "authenticated" ? "/" : "/auth"} replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      {!introDone && <GrimoireIntro onComplete={() => setIntroDone(true)} />}
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppFrame />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
