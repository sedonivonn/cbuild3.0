import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { tr } from "./translations/tr";
import { en } from "./translations/en";

const STORAGE_KEY = "ucl_lang_v1";

function detectInitialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "tr" || saved === "en") return saved;
  } catch (_) { /* localStorage unavailable */ }
  return "tr"; // default
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
    },
    lng: detectInitialLanguage(),
    fallbackLng: "tr",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

// Persist any language change into localStorage automatically.
i18n.on("languageChanged", (lng) => {
  try { localStorage.setItem(STORAGE_KEY, lng); } catch (_) {}
});

export default i18n;
