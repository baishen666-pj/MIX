import { useState, useCallback, useContext, createContext } from "react";
import en, { type TranslationKey } from "./en";
import zh from "./zh";

export type Locale = "en" | "zh";

const translations: Record<Locale, Record<TranslationKey, string>> = { en, zh };

function getStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem("mix-locale");
    if (stored === "en" || stored === "zh") return stored;
  } catch { /* ignore */ }
  return "en";
}

export function t(key: TranslationKey, locale: Locale = "en"): string {
  return translations[locale][key] ?? key;
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key) => en[key],
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem("mix-locale", l); } catch { /* ignore */ }
  }, []);

  const translate = useCallback((key: TranslationKey) => t(key, locale), [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: translate }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
