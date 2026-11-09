import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, LogOut, MessageSquare, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { cn, relativeTime } from "@/lib/utils";
import { experienceNav, footerNav, primaryNav } from "@/lib/nav";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { Emblem } from "@/components/brand/Emblem";
import { StatusDot } from "@/components/common/ui";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.conversations(),
    staleTime: 20_000,
  });

  const createConversation = useMutation({
    mutationFn: () => api.createConversation({ experience: "companion" }),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate(`/chat/${conversation.id}`);
      onNavigate?.();
    },
  });

  const recent = (conversations.data ?? []).slice(0, 7);
  const isCollapsed = collapsed;

  async function signOut() {
    try {
      await api.logout();
    } catch {
      /* session may already be revoked */
    }
    clear();
    navigate("/auth");
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-line bg-coal/80 backdrop-blur-xl transition-[width] duration-300",
        isCollapsed ? "w-[76px]" : "w-[270px]",
      )}
      aria-label="Main navigation"
    >
      <div className={cn("flex h-16 items-center border-b border-line/70 px-4", isCollapsed ? "justify-center" : "justify-between")}>
        <button
          onClick={() => {
            navigate("/");
            onNavigate?.();
          }}
          className="flex items-center gap-2.5 focus-ring rounded-md"
          aria-label="ASTA home"
        >
          <Emblem size={30} glow />
          {!isCollapsed && (
            <div className="text-left">
              <div className="font-display text-sm font-semibold tracking-[0.3em] text-parchment">ASTA</div>
              <div className="text-[0.52rem] uppercase tracking-[0.2em] text-ash/70">Intelligence grimoire</div>
            </div>
          )}
        </button>
        {!isCollapsed && (
          <button onClick={toggleSidebar} className="btn-quiet hidden p-1.5 md:flex" aria-label="Collapse sidebar">
            <ChevronLeft size={15} />
          </button>
        )}
      </div>

      {isCollapsed && (
        <button onClick={toggleSidebar} className="btn-quiet mx-auto mt-3 hidden p-1.5 md:flex" aria-label="Expand sidebar">
          <ChevronRight size={15} />
        </button>
      )}

      <div className={cn("px-3 pt-4", isCollapsed && "px-2")}>
        <button
          onClick={() => createConversation.mutate()}
          disabled={createConversation.isPending}
          className={cn(
            "btn-primary w-full justify-start",
            isCollapsed && "justify-center px-0",
          )}
          aria-label={t("nav.newChat")}
          title={t("nav.newChat")}
        >
          <Plus size={16} aria-hidden />
          {!isCollapsed && <span>{t("nav.newChat")}</span>}
        </button>
      </div>

      <nav className={cn("mt-5 flex-1 overflow-y-auto px-3 pb-4", isCollapsed && "px-2")} aria-label="Workspace">
        {!isCollapsed && <p className="eyebrow mb-1.5 px-2">Grimoire</p>}
        <div className="space-y-0.5">
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              data-active={item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)}
              className={cn("nav-item", isCollapsed && "justify-center px-0 py-2.5")}
              title={t(item.key)}
            >
              <item.icon size={17} aria-hidden />
              {!isCollapsed && <span>{t(item.key)}</span>}
            </NavLink>
          ))}
        </div>

        {!isCollapsed && <p className="eyebrow mb-1.5 mt-5 px-2">Experiences</p>}
        <div className={cn("space-y-0.5", isCollapsed && "mt-4")}>
          {experienceNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              data-active={location.pathname.startsWith(item.to)}
              className={cn("nav-item", isCollapsed && "justify-center px-0 py-2.5")}
              title={t(item.key)}
            >
              <item.icon size={17} style={{ color: item.accent }} aria-hidden />
              {!isCollapsed && <span>{t(item.key)}</span>}
            </NavLink>
          ))}
        </div>

        {!isCollapsed && (
          <>
            <div className="mt-6 flex items-center justify-between px-2">
              <p className="eyebrow">Recent</p>
              <button
                onClick={() => navigate("/search")}
                className="text-[0.65rem] text-ash hover:text-parchment"
                aria-label="Search conversations"
              >
                All
              </button>
            </div>
            <div className="mt-1.5 space-y-0.5">
              {conversations.isLoading && <div className="skeleton mx-2 h-7 w-[85%]" />}
              {recent.map((conversation) => (
                <NavLink
                  key={conversation.id}
                  to={`/chat/${conversation.id}`}
                  onClick={onNavigate}
                  data-active={location.pathname === `/chat/${conversation.id}`}
                  className="nav-item gap-2 py-1.5 text-[0.8rem]"
                  title={conversation.title}
                >
                  <MessageSquare size={13} className="shrink-0 opacity-60" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{conversation.title}</span>
                  <span className="shrink-0 text-[0.6rem] text-ash/50">{relativeTime(conversation.updated_at)}</span>
                </NavLink>
              ))}
              {!conversations.isLoading && recent.length === 0 && (
                <p className="px-2 py-2 text-xs text-ash/60">No conversations yet.</p>
              )}
            </div>
          </>
        )}
      </nav>

      <div className={cn("border-t border-line/70 p-3", isCollapsed && "px-2")}>
        <div className={cn("space-y-0.5", !isCollapsed && "mb-2")}>
          {footerNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              data-active={location.pathname.startsWith(item.to)}
              className={cn("nav-item", isCollapsed && "justify-center px-0 py-2.5")}
              title={t(item.key)}
            >
              <item.icon size={16} aria-hidden />
              {!isCollapsed && <span>{t(item.key)}</span>}
            </NavLink>
          ))}
        </div>

        {!isCollapsed ? (
          <div className="flex items-center gap-2 rounded-lg border border-line bg-elevated/40 p-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-crimson to-arcane text-[0.62rem] font-semibold text-parchment">
              {(user?.display_name ?? "G").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-parchment">{user?.display_name ?? "Traveler"}</p>
              <p className="flex items-center gap-1 text-[0.6rem] text-ash">
                <StatusDot status="available" /> {user?.is_guest ? "Guest session" : "Free plan"}
              </p>
            </div>
            <button onClick={signOut} className="btn-quiet p-1.5" aria-label={t("nav.signOut")} title={t("nav.signOut")}>
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button onClick={signOut} className="btn-quiet mx-auto mt-2 flex p-2" aria-label={t("nav.signOut")}>
            <LogOut size={15} />
          </button>
        )}
      </div>
    </aside>
  );
}

export function MobileSidebar() {
  const open = useUIStore((s) => s.mobileNavOpen);
  const setOpen = useUIStore((s) => s.setMobileNav);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <motion.div
        className="absolute inset-0 bg-abyss/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <motion.div
        className="absolute inset-y-0 left-0 w-[280px] shadow-grimoire"
        initial={{ x: -290 }}
        animate={{ x: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
      >
        <Sidebar onNavigate={() => setOpen(false)} />
      </motion.div>
    </div>
  );
}
