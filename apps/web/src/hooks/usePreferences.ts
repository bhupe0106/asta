import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import i18n, { applyDocumentLanguage } from "@/i18n";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

/** Loads preferences and applies them to the document root. */
export function usePreferences() {
  const status = useAuthStore((s) => s.status);
  const query = useQuery({
    queryKey: ["preferences"],
    queryFn: api.preferences,
    enabled: status === "authenticated",
    staleTime: 60_000,
  });

  useEffect(() => {
    const prefs = query.data;
    if (!prefs) return;
    const root = document.documentElement;
    root.dataset.text = prefs.text_scale;
    root.dataset.contrast = prefs.high_contrast ? "high" : "normal";
    root.dataset.motion = prefs.reduced_motion ? "reduced" : "full";
    if (prefs.app_language) {
      if (i18n.language !== prefs.app_language) void i18n.changeLanguage(prefs.app_language);
      applyDocumentLanguage(prefs.app_language);
    }
  }, [query.data]);

  return query;
}
