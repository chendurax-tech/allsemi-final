import React from 'react';
import { useTheme } from '../lib/theme.js';

/*
  ThemeToggle - switches between the dark (default) and light theme.
  Shows the theme it switches to: a sun in the dark theme, a moon in
  the light one.
*/
export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme();
  const next = theme === 'light' ? 'dark' : 'light';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center border border-line-strong text-text-dim transition-colors hover:border-accent hover:text-accent focus:outline-none focus-visible:border-accent focus-visible:text-accent ${className}`}
    >
      {next === 'light' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
