import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextType {
  theme: ThemeMode;
  highContrast: boolean;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
  setHighContrast: (on: boolean) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "alera_theme";
const HC_STORAGE_KEY = "alera_high_contrast";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (stored && ["light", "dark", "system"].includes(stored)) return stored;
      // migrate old high-contrast stored value
      if (stored === "high-contrast") return "dark";
    }
    return "dark";
  });

  const [highContrast, setHighContrastState] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(HC_STORAGE_KEY) === "true";
    }
    return false;
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (mode: ThemeMode) => {
      let active: "light" | "dark" = "dark";
      if (mode === "system") {
        active = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } else {
        active = mode;
      }
      setResolvedTheme(active);

      root.classList.remove("light", "dark");
      root.setAttribute("data-theme", active);
      root.classList.add(active);
      root.style.colorScheme = active === "dark" ? "dark" : "light";
    };

    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme("system");
      mq.addEventListener("change", handleChange);
      return () => mq.removeEventListener("change", handleChange);
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (highContrast) {
      root.setAttribute("data-high-contrast", "true");
    } else {
      root.removeAttribute("data-high-contrast");
    }
    localStorage.setItem(HC_STORAGE_KEY, String(highContrast));
  }, [highContrast]);

  const setTheme = (newTheme: ThemeMode) => setThemeState(newTheme);
  const setHighContrast = (on: boolean) => setHighContrastState(on);

  const toggleTheme = () => {
    setThemeState((prev) => {
      if (prev === "dark") return "light";
      if (prev === "light") return "system";
      return "dark";
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, highContrast, resolvedTheme, setTheme, setHighContrast, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
