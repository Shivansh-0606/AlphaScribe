import { useTheme } from "@/lib/theme";
import { Sun, Moon } from "@phosphor-icons/react";

export default function ThemeToggle({ compact = false }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      data-testid="theme-toggle"
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={
        compact
          ? "p-1 text-muted-foreground hover:text-primary transition-none"
          : "flex items-center gap-2 mono text-[11px] uppercase tracking-widest px-3 h-8 border border-border text-muted-foreground hover:text-primary hover:border-primary"
      }
    >
      {isDark ? <Sun size={compact ? 14 : 12} /> : <Moon size={compact ? 14 : 12} />}
      {!compact && (isDark ? "Light" : "Dark")}
    </button>
  );
}
