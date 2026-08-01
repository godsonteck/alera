import React from "react";
import { Sun, Moon, Laptop, Eye } from "lucide-react";
import { useTheme, ThemeMode } from "@/contexts/ThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface ThemeSelectorProps {
  variant?: "dropdown" | "toggle" | "pills";
  className?: string;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ variant = "dropdown", className = "" }) => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  const options: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: "light", label: "Light", icon: <Sun className="h-4 w-4 text-amber-500" /> },
    { mode: "dark", label: "Dark", icon: <Moon className="h-4 w-4 text-sky-400" /> },
    { mode: "high-contrast", label: "Clinical High Contrast", icon: <Eye className="h-4 w-4 text-emerald-400" /> },
    { mode: "system", label: "System Default", icon: <Laptop className="h-4 w-4 text-slate-400" /> },
  ];

  if (variant === "toggle") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className={`relative h-9 w-9 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-high)] transition-all hover:bg-[var(--surface-secondary)] ${className}`}
        title={`Current theme: ${theme}. Click to switch.`}
        aria-label="Toggle theme"
      >
        {resolvedTheme === "light" && <Sun className="h-4 w-4 text-amber-400" />}
        {resolvedTheme === "dark" && <Moon className="h-4 w-4 text-sky-400" />}
        {resolvedTheme === "high-contrast" && <Eye className="h-4 w-4 text-emerald-400" />}
      </Button>
    );
  }

  if (variant === "pills") {
    return (
      <div className={`flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-1 ${className}`}>
        {options.map((opt) => (
          <button
            key={opt.mode}
            onClick={() => setTheme(opt.mode)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              theme === opt.mode
                ? "bg-[var(--brand-primary)] text-white shadow-sm"
                : "text-[var(--text-medium)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-high)]"
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-high)] transition-all hover:bg-[var(--surface-secondary)] ${className}`}
        >
          {resolvedTheme === "light" && <Sun className="h-4 w-4 text-amber-400" />}
          {resolvedTheme === "dark" && <Moon className="h-4 w-4 text-sky-400" />}
          {resolvedTheme === "high-contrast" && <Eye className="h-4 w-4 text-emerald-400" />}
          <span className="capitalize">{theme === "high-contrast" ? "High Contrast" : theme === "system" ? "System" : theme}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/95 p-1 text-[var(--text-high)] shadow-xl backdrop-blur-md">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.mode}
            onClick={() => setTheme(opt.mode)}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
              theme === opt.mode ? "bg-[var(--brand-primary)]/15 font-semibold text-[var(--brand-primary)]" : "text-[var(--text-high)] hover:bg-[var(--surface-secondary)]"
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeSelector;
