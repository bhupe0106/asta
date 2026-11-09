import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import ta from "./locales/ta.json";
import hi from "./locales/hi.json";
import es from "./locales/es.json";
import ar from "./locales/ar.json";
import fr from "./locales/fr.json";

export const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

const stored = localStorage.getItem("asta.lang") || "en";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ta: { translation: ta },
    hi: { translation: hi },
    es: { translation: es },
    ar: { translation: ar },
    fr: { translation: fr },
  },
  lng: stored,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function applyDocumentLanguage(language: string) {
  document.documentElement.lang = language;
  document.documentElement.dir = RTL_LANGUAGES.has(language) ? "rtl" : "ltr";
  localStorage.setItem("asta.lang", language);
}

applyDocumentLanguage(stored);

export default i18n;
