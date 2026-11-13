import { useCallback, useEffect, useState } from "react";
import { loadTheme, saveTheme, type ThemePreference } from "../lib/config";

export function useTheme(): { theme: ThemePreference; toggleTheme: () => void } {
  const [theme, setTheme] = useState<ThemePreference>(loadTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    saveTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggleTheme };
}
