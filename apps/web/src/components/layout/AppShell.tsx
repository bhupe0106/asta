import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar, MobileSidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { ToastHost } from "@/components/common/ui";
import { useUIStore } from "@/stores/ui";

export function AppShell() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const setPalette = useUIStore((s) => s.setPalette);
  const setMobileNav = useUIStore((s) => s.setMobileNav);
  const location = useLocation();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPalette]);

  useEffect(() => {
    setMobileNav(false);
  }, [location.pathname, setMobileNav]);

  return (
    <div className="relative min-h-screen">
      <a href="#main-content" className="sr-only sr-only-focusable">
        Skip to main content
      </a>

      <div className="fixed inset-y-0 start-0 z-40 hidden md:block">
        <Sidebar />
      </div>
      <MobileSidebar />

      <div
        className="relative z-10 flex min-h-screen flex-col transition-[padding] duration-300"
        style={{ paddingInlineStart: "var(--asta-sidebar-width, 0px)" }}
      >
        <Topbar />
        <main id="main-content" className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
        <footer className="border-t border-line/50 px-6 py-4 text-center text-[0.65rem] uppercase tracking-[0.22em] text-ash/40">
          ASTA · Your intelligence. Your possibilities.
        </footer>
      </div>

      <CommandPalette />
      <ToastHost />
      <SidebarWidthSync collapsed={collapsed} />
    </div>
  );
}

/** Keeps content padding in sync with the fixed sidebar, including RTL. */
function SidebarWidthSync({ collapsed }: { collapsed: boolean }) {
  useEffect(() => {
    const update = () => {
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      document.documentElement.style.setProperty(
        "--asta-sidebar-width",
        isDesktop ? `${collapsed ? 76 : 270}px` : "0px",
      );
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [collapsed]);
  return null;
}
