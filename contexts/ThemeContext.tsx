'use client'
import { createContext, useState, useContext, useEffect, ReactNode } from "react";

export const AVAILABLE_AVATARS = [
  "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?auto=format&fit=crop&q=80&w=200",
  "https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&q=80&w=200",
  "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&q=80&w=200",
  "https://images.unsplash.com/photo-1614632537423-1e6c2e7e0aab?auto=format&fit=crop&q=80&w=200",
  "https://images.unsplash.com/photo-1556056504-5c7696c4c28d?auto=format&fit=crop&q=80&w=200",
  "https://images.unsplash.com/photo-1510566337590-2fc1f21d0faa?auto=format&fit=crop&q=80&w=200",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=player1",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=player2",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=player3",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=player4",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=player5",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=player6"
];

type ThemeContextType = {
  darkMode: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [darkMode, setDarkMode] = useState(false);

  // load from localStorage after mount
  useEffect(() => {
    const stored = localStorage.getItem("darkMode") === "true";

    setDarkMode(stored);
    document.documentElement.classList.toggle("dark", stored);
  }, []);

  const toggleTheme = () => {
    setDarkMode(prev => {
      const newMode = !prev;

      localStorage.setItem("darkMode", String(newMode));
      // document.documentElement.classList.toggle("dark", newMode);
      document.documentElement.classList[newMode ? "add" : "remove"]("dark");
      return newMode;
    });
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}