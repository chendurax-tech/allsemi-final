import { useSyncExternalStore } from 'react';

/*
  The admin's colour theme: 'dark' (the default) or 'light'. The public
  site is always dark.

  The theme is the data-theme attribute on <html>; the light palette is
  in styles/tailwind.css. On /admin routes index.html sets the attribute
  from the saved choice before the first paint, so a light page never
  flashes dark, and syncThemeArea applies it again when the admin is
  opened in-app and clears it when a public page is opened. The choice
  is kept in this browser's localStorage only; without one the admin is
  dark.
*/
export const THEME_KEY = 'allsemi-theme';
const THEME_COLORS = { dark: '#07070b', light: '#f6f5fa' };

const listeners = new Set();

export function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function applyTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark';
  if (next === 'light') document.documentElement.dataset.theme = next;
  else delete document.documentElement.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[next]);
  listeners.forEach((listener) => listener());
  return next;
}

export function setTheme(theme) {
  const next = applyTheme(theme);
  try {
    window.localStorage.setItem(THEME_KEY, next);
  } catch {
    // Storage blocked: the theme still applies to this page.
  }
}

// The admin shows the saved theme; every public page is dark.
export function syncThemeArea(isAdmin) {
  let saved = 'dark';
  if (isAdmin) {
    try {
      saved = window.localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      // Storage blocked: dark.
    }
  }
  applyTheme(saved);
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'dark');
  return { theme, toggle: () => setTheme(theme === 'light' ? 'dark' : 'light') };
}
