'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('mocksnap_theme');
    const isDark = saved ? saved === 'dark' : true;
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('mocksnap_theme', next ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggle}
      className="fixed top-4 right-4 z-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
    >
      {dark ? 'Light' : 'Dark'}
    </button>
  );
}
