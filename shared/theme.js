(() => {
  'use strict';
  const storageKey = 'itu-atlas-theme';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const validChoices = ['system', 'light', 'dark'];
  let preference = 'system';
  try {
    const saved = localStorage.getItem(storageKey);
    if (validChoices.includes(saved)) preference = saved;
  } catch {
    // Keep theme controls functional when browser storage is unavailable.
  }

  function applyTheme() {
    const theme = preference === 'system' ? (systemTheme.matches ? 'dark' : 'light') : preference;
    const dark = theme === 'dark';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const label = dark ? 'Açık temaya geç' : 'Koyu temaya geç';
      button.setAttribute('aria-checked', String(dark));
      button.setAttribute('aria-label', label);
      button.title = label;
    });
  }

  // Runs in the head before the stylesheet, avoiding an initial color flash.
  applyTheme();
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        try {
          localStorage.setItem(storageKey, preference);
        } catch {
          // Retain the manual choice in memory for this page.
        }
        applyTheme();
      });
    });
    applyTheme();
  });
  systemTheme.addEventListener('change', () => {
    if (preference === 'system') applyTheme();
  });
  window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    preference = validChoices.includes(event.newValue) ? event.newValue : 'system';
    applyTheme();
  });
})();
