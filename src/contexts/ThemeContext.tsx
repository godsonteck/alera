import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system" | "high-contrast";

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark" | "high-contrast";
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "alera_theme";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (stored && ["light", "dark", "system", "high-contrast"].includes(stored)) {
        return stored;
      }
    }
    return "dark"; // Default to sleek dark mode
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark" | "high-contrast">("dark");

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (mode: ThemeMode) => {
      let active: "light" | "dark" | "high-contrast" = "dark";

      if (mode === "system") {
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        active = systemPrefersDark ? "dark" : "light";
      } else {
        active = mode;
      }

      setResolvedTheme(active);

      // Remove existing theme classes & attributes
      root.classList.remove("light", "dark", "high-contrast");
      root.removeAttribute("data-theme");

      // Apply new theme class and attribute
      root.classList.add(active);
      root.setAttribute("data-theme", active);

      // Also support color-scheme CSS attribute
      if (active === "dark" || active === "high-contrast") {
        root.style.colorScheme = "dark";
      } else {
        root.style.colorScheme = "light";
      }
    };

    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    // Listen for system changes if mode === "system"
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme("system");
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      if (prev === "dark") return "light";
      if (prev === "light") return "high-contrast";
      if (prev === "high-contrast") return "system";
      return "dark";
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
